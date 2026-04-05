const { DatabaseSync: Database } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/app/server/data/financeiro.db'
  : path.join(__dirname, 'financeiro.db');

// Garante que o diretório existe (necessário no Railway na primeira execução)
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

function _openRawDatabase() {
  const instance = new Database(DB_PATH);
  instance.exec("PRAGMA journal_mode=WAL");
  instance.exec("PRAGMA foreign_keys = ON");
  return instance;
}

// Verifica integridade do banco.
// Só deleta e recria se o arquivo NÃO puder ser aberto (corrompido/ilegível).
// Se o arquivo existir e abrir normalmente, usa ele como está — nunca descarta dados.
function _ensureHealthyDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('[db] nenhum banco encontrado, criando novo em', DB_PATH);
    return _openRawDatabase();
  }

  let testDb = null;
  try {
    testDb = new Database(DB_PATH);
    const row = testDb.prepare('PRAGMA integrity_check').get();
    testDb.close();
    testDb = null;
    if (row && row.integrity_check !== 'ok') {
      console.warn('[db] integrity_check retornou:', row.integrity_check, '— abrindo mesmo assim');
    } else {
      console.log('[db] banco íntegro, abrindo:', DB_PATH);
    }
  } catch (err) {
    // Só chega aqui se o arquivo for completamente ilegível (header corrompido, etc.)
    console.error('[db] arquivo ilegível, deletando e criando novo:', err.message);
    try { if (testDb) testDb.close(); } catch (_) {}
    try { fs.unlinkSync(DB_PATH); } catch (_) {}
    const fresh = _openRawDatabase();
    console.log('[db] novo banco criado com sucesso');
    return fresh;
  }

  return _openRawDatabase();
}

let _db = _ensureHealthyDatabase();

// Proxy que sempre delega para a instância atual de _db.
// Permite que as rotas mantenham uma referência a `db` mesmo após
// um reopenDatabase(), sem precisar alterar nenhum arquivo de rota.
const db = new Proxy({}, {
  get(_, prop) {
    const val = _db[prop];
    return typeof val === 'function' ? val.bind(_db) : val;
  },
});

// Fecha e reabre a conexão com o arquivo em disco (ex: após restore).
// NÃO chama initDatabase() — quem precisa disso chama explicitamente.
function reopenDatabase() {
  try { _db.close(); } catch (_) {}
  _db = new Database(DB_PATH);
  _db.exec("PRAGMA foreign_keys = ON");
  console.log('[db] conexão reaberta com o banco em', DB_PATH);
}

function initDatabase() {
  // --- Core tables ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id           TEXT NOT NULL,
      purchase_date      TEXT NOT NULL,
      due_date           TEXT NOT NULL,
      category           TEXT NOT NULL,
      subcategory        TEXT,
      location           TEXT,
      payment_method     TEXT NOT NULL,
      description        TEXT,
      total_amount       REAL NOT NULL,
      installments       INTEGER NOT NULL DEFAULT 1,
      installment_number INTEGER NOT NULL DEFAULT 1,
      installment_amount REAL NOT NULL,
      created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_due_date       ON expenses(due_date);
    CREATE INDEX IF NOT EXISTS idx_purchase_date  ON expenses(purchase_date);
    CREATE INDEX IF NOT EXISTS idx_payment_method ON expenses(payment_method);
    CREATE INDEX IF NOT EXISTS idx_category       ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_group_id       ON expenses(group_id);
  `);

  // Migrate: add subcategory column if it doesn't exist yet (safe to call multiple times)
  try { db.exec('ALTER TABLE expenses ADD COLUMN subcategory TEXT'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_subcategory ON expenses(subcategory)'); } catch (_) {}

  // --- Supporting tables ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_methods (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      is_card    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      name                 TEXT NOT NULL UNIQUE,
      exclude_from_reports INTEGER NOT NULL DEFAULT 0,
      created_at           TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS subcategories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      UNIQUE(category_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_subcategories_cat ON subcategories(category_id);

    CREATE TABLE IF NOT EXISTS cutoff_dates (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
      year              INTEGER NOT NULL,
      month             INTEGER NOT NULL,
      cutoff_day        INTEGER NOT NULL,
      UNIQUE(payment_method_id, year, month)
    );
  `);

  // Migrate: add exclude_from_reports to categories for existing DBs (safe, try/catch)
  try { db.exec('ALTER TABLE categories ADD COLUMN exclude_from_reports INTEGER NOT NULL DEFAULT 0'); } catch (_) {}

  // Migrate: add is_income to categories for existing DBs (safe, try/catch)
  try { db.exec('ALTER TABLE categories ADD COLUMN is_income INTEGER NOT NULL DEFAULT 0'); } catch (_) {}

  // --- Seed default payment methods (once) ---
  const defaultMethods = [
    { name: 'TAM',         is_card: 1 },
    { name: 'Dinheiro',    is_card: 0 },
    { name: 'Outro Cartão',is_card: 1 },
  ];
  const insertMethod = db.prepare(
    'INSERT OR IGNORE INTO payment_methods (name, is_card) VALUES (?, ?)'
  );
  for (const m of defaultMethods) insertMethod.run(m.name, m.is_card);

  // --- Seed default categories (once) ---
  const defaultCategories = [
    'Moradia', 'Lazer', 'Compras', 'Saúde', 'Despesas do Trabalho',
    'Viagem', 'Presentes', 'Educação', 'Cuidados Pessoais', 'Contas', 'Banco', 'Saques',
  ];
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
  for (const c of defaultCategories) insertCat.run(c);

  // Ensure "Pagamentos Cartões" category exists and is flagged to exclude from reports
  db.prepare("INSERT OR IGNORE INTO categories (name, exclude_from_reports) VALUES ('Pagamentos Cartões', 1)").run();
  // Mark any existing variation (case-insensitive LIKE) — catches "Pagamentos CartõEs" etc.
  db.prepare("UPDATE categories SET exclude_from_reports = 1 WHERE LOWER(name) LIKE '%pagamentos cart%'").run();

  // Seed income categories
  db.prepare("INSERT OR IGNORE INTO categories (name, is_income) VALUES ('Salário', 1)").run();
  db.prepare("INSERT OR IGNORE INTO categories (name, is_income) VALUES ('Outras Rendas', 1)").run();
  // Ensure existing rows have the flag set (idempotent)
  db.prepare("UPDATE categories SET is_income = 1 WHERE name IN ('Salário', 'Outras Rendas')").run();

  // --- Users table ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  // Migrate: add is_admin column to users (safe, idempotent)
  try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0'); } catch (_) {}

  // --- Seed default admin user (once) ---
  const existingAdmin = db.prepare('SELECT 1 FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('financeiro123', 10);
    db.prepare('INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)').run('admin', hash);
    console.log('Default admin user created (admin / financeiro123)');
  }
  // Ensure the admin user always has is_admin = 1 (idempotent)
  db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'admin'").run();
  const adminCheck = db.prepare("SELECT id, username, is_admin FROM users WHERE username = 'admin'").get();
  console.log('[db] admin user state:', adminCheck);

  // Migrate: add user_id column to expenses (safe, idempotent)
  try { db.exec('ALTER TABLE expenses ADD COLUMN user_id INTEGER REFERENCES users(id)'); } catch (_) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id)'); } catch (_) {}

  // Migrate: add is_international column to expenses (safe, idempotent)
  try { db.exec('ALTER TABLE expenses ADD COLUMN is_international INTEGER NOT NULL DEFAULT 0'); } catch (_) {}

  // Migrate: add is_checked column to expenses (safe, idempotent)
  try { db.exec('ALTER TABLE expenses ADD COLUMN is_checked INTEGER NOT NULL DEFAULT 0'); } catch (_) {}

  // Migrate: add recorrente column to expenses (safe, idempotent)
  try { db.exec('ALTER TABLE expenses ADD COLUMN recorrente INTEGER NOT NULL DEFAULT 0'); } catch (_) {}

  // Migrate: add card_type column to payment_methods (safe, idempotent)
  try { db.exec("ALTER TABLE payment_methods ADD COLUMN card_type TEXT NOT NULL DEFAULT 'cash'"); } catch (_) {}
  // Set card_type = 'credit' for existing credit cards
  try { db.exec("UPDATE payment_methods SET card_type = 'credit' WHERE is_card = 1 AND card_type = 'cash'"); } catch (_) {}

  // Assign existing expenses without user_id to the admin user
  db.prepare(`
    UPDATE expenses
    SET user_id = (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
    WHERE user_id IS NULL
  `).run();

  // --- Subscription tables ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER UNIQUE NOT NULL,
      plan       TEXT    DEFAULT 'free',
      status     TEXT    DEFAULT 'active',
      started_at DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_history (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      amount       REAL    NOT NULL,
      currency     TEXT    DEFAULT 'BRL',
      plan         TEXT    NOT NULL,
      period_start DATETIME,
      period_end   DATETIME,
      method       TEXT    DEFAULT 'manual',
      notes        TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Database initialised at', DB_PATH);
}

module.exports = { db, DB_PATH, initDatabase, reopenDatabase };
