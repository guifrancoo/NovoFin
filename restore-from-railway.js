#!/usr/bin/env node
/**
 * restore-from-railway.js
 * Restaura o banco local a partir de server/data-railway.json
 * (arquivo gerado por: node download-db.js <URL> <ADMIN_KEY>)
 *
 * O banco local é deletado e recriado com o schema completo atual
 * antes da importação, garantindo que todas as colunas existam.
 *
 * Uso:
 *   node --experimental-sqlite restore-from-railway.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH   = path.join(__dirname, 'server', 'financeiro.db');
const JSON_PATH = path.join(__dirname, 'server', 'data-railway.json');

if (!fs.existsSync(JSON_PATH)) {
  console.error('Arquivo não encontrado:', JSON_PATH);
  console.error('Execute primeiro: node download-db.js <URL_DO_RAILWAY> <ADMIN_KEY>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// ─── recria o banco do zero ───────────────────────────────────────────────────

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Banco local anterior removido.');
}

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA foreign_keys = OFF;

  CREATE TABLE expenses (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id           TEXT    NOT NULL,
    purchase_date      TEXT    NOT NULL,
    due_date           TEXT    NOT NULL,
    category           TEXT    NOT NULL,
    subcategory        TEXT,
    location           TEXT,
    payment_method     TEXT    NOT NULL,
    description        TEXT,
    total_amount       REAL    NOT NULL,
    installments       INTEGER NOT NULL DEFAULT 1,
    installment_number INTEGER NOT NULL DEFAULT 1,
    installment_amount REAL    NOT NULL,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    user_id            INTEGER REFERENCES users(id),
    is_international   INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX idx_due_date        ON expenses(due_date);
  CREATE INDEX idx_purchase_date   ON expenses(purchase_date);
  CREATE INDEX idx_payment_method  ON expenses(payment_method);
  CREATE INDEX idx_category        ON expenses(category);
  CREATE INDEX idx_group_id        ON expenses(group_id);
  CREATE INDEX idx_expenses_user_id ON expenses(user_id);

  CREATE TABLE payment_methods (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    is_card    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE categories (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT    NOT NULL UNIQUE,
    exclude_from_reports INTEGER NOT NULL DEFAULT 0,
    is_income            INTEGER NOT NULL DEFAULT 0,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE subcategories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(category_id, name)
  );

  CREATE INDEX idx_subcategories_cat ON subcategories(category_id);

  CREATE TABLE cutoff_dates (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
    year              INTEGER NOT NULL,
    month             INTEGER NOT NULL,
    cutoff_day        INTEGER NOT NULL,
    UNIQUE(payment_method_id, year, month)
  );

  CREATE TABLE users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    is_admin   INTEGER NOT NULL DEFAULT 0
  );
`);

console.log('Schema criado.');

// ─── importa os dados ─────────────────────────────────────────────────────────

// Ordem respeitando dependências de FK: pais antes de filhos
const insertOrder = ['categories', 'payment_methods', 'subcategories', 'cutoff_dates', 'users', 'expenses'];

db.exec('BEGIN TRANSACTION');

try {
  const counts = {};

  for (const table of insertOrder) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      counts[table] = 0;
      continue;
    }

    const cols   = Object.keys(rows[0]);
    const params = cols.map(() => '?').join(', ');
    const stmt   = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${params})`);

    for (const row of rows) {
      stmt.run(...cols.map(c => row[c]));
    }

    counts[table] = rows.length;
  }

  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
  db.close();

  console.log('Importação concluída. Registros por tabela:');
  for (const table of insertOrder) {
    console.log(`  ${table}: ${counts[table]}`);
  }
  console.log('');
  console.log('Próximo passo: node --experimental-sqlite reprocess-due-dates.js');

} catch (err) {
  db.exec('ROLLBACK');
  db.close();
  console.error('Erro durante importação — ROLLBACK aplicado:', err.message);
  process.exit(1);
}
