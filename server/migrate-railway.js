// server/migrate-railway.js
// Imports expenses from data-railway.json into the local SQLite DB for GuiFranco.
// Usage: node --experimental-sqlite server/migrate-railway.js
//
// Safe to re-run: deletes all existing GuiFranco expenses before importing.

'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/app/server/data/financeiro.db'
  : path.join(__dirname, 'financeiro.db');

const EXPORT_PATH = 'C:/Users/lherm/OneDrive/Desktop/financeiro-pessoal/server/data-railway.json';

console.log('[migrate-railway] DB path:     ', DB_PATH);
console.log('[migrate-railway] Export path: ', EXPORT_PATH);

if (!fs.existsSync(DB_PATH))     { console.error('ERROR: DB not found at', DB_PATH);     process.exit(1); }
if (!fs.existsSync(EXPORT_PATH)) { console.error('ERROR: export not found at', EXPORT_PATH); process.exit(1); }

const db   = new DatabaseSync(DB_PATH);
const data = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));

console.log(`[migrate-railway] Loaded export: ${data.expenses.length} expenses\n`);

// ── 1. Resolve GuiFranco's user_id ────────────────────────────────────────────
const userRow = db.prepare("SELECT id FROM users WHERE username = 'GuiFranco'").get();
if (!userRow) {
  console.error("ERROR: user 'GuiFranco' not found in DB. Run migrate-v1.js first.");
  process.exit(1);
}
const userId = userRow.id;
console.log(`[migrate-railway] GuiFranco user_id = ${userId}`);

// ── 2. Delete existing GuiFranco expenses ─────────────────────────────────────
const deleted = db.prepare('DELETE FROM expenses WHERE user_id = ?').run(userId);
console.log(`[migrate-railway] Deleted ${deleted.changes} existing expenses for GuiFranco\n`);

// ── 3. Import expenses ────────────────────────────────────────────────────────
const insert = db.prepare(`
  INSERT INTO expenses
    (group_id, purchase_date, due_date, category, subcategory, location,
     payment_method, description, total_amount, installments, installment_number,
     installment_amount, created_at, user_id, is_international, is_checked, recorrente)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
`);

let imported = 0;
let skipped  = 0;

db.exec('BEGIN');
try {
  for (const e of data.expenses) {
    // location holds the merchant name in this export; description is null
    const location    = e.location    ?? e.description ?? null;
    const description = e.description ?? null;

    insert.run(
      e.group_id,
      e.purchase_date,
      e.due_date,
      e.category,
      e.subcategory          ?? null,
      location,
      e.payment_method,
      description,
      e.total_amount,
      e.installments,
      e.installment_number,
      e.installment_amount,
      e.created_at           ?? new Date().toISOString().replace('T', ' ').slice(0, 19),
      userId,
      e.is_international     ?? 0,
      e.is_checked           ?? 0,
    );
    imported++;
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('[migrate-railway] ERROR during import — rolled back:', err.message);
  process.exit(1);
}

db.close();

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('════════════════════════════════════');
console.log('      migrate-railway Summary        ');
console.log('════════════════════════════════════');
console.log(`  Expenses imported:  ${imported}`);
console.log(`  Expenses skipped:   ${skipped}`);
console.log('════════════════════════════════════');
console.log('\nNext: run push-to-prod.js to sync to Railway.');
