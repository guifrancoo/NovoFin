const { DatabaseSync: Database } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'financeiro.db');

const db = new Database(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

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

  // --- Users table ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  // --- Seed default admin user (once) ---
  const existingAdmin = db.prepare('SELECT 1 FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('financeiro123', 10);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('admin', hash);
    console.log('Default admin user created (admin / financeiro123)');
  }

  console.log('Database initialised at', DB_PATH);
}

module.exports = { db, initDatabase };
