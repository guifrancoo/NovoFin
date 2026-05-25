// server/migrate-v1.js
// One-time migration: create GuiFranco user and import data from financeiro-pessoal.
// Run with: node --experimental-sqlite server/migrate-v1.js

'use strict';

const { DatabaseSync: Database } = require('node:sqlite');
const path   = require('path');
const fs     = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/app/server/data/financeiro.db'
  : path.join(__dirname, 'financeiro.db');

const EXPORT_PATH = 'C:\\Users\\lherm\\OneDrive\\Desktop\\financeiro-pessoal\\server\\data-export.json';

console.log('[migrate] DB path:     ', DB_PATH);
console.log('[migrate] Export path: ', EXPORT_PATH);

if (!fs.existsSync(DB_PATH))     { console.error('ERROR: DB not found at', DB_PATH); process.exit(1); }
if (!fs.existsSync(EXPORT_PATH)) { console.error('ERROR: export not found at', EXPORT_PATH); process.exit(1); }

const db = new Database(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

const data = JSON.parse(fs.readFileSync(EXPORT_PATH, 'utf8'));
console.log(`[migrate] Loaded export: ${data.expenses.length} expenses, ${data.categories.length} categories, ${data.payment_methods.length} payment methods, ${data.cutoff_dates.length} cutoff dates\n`);

let usersCreated       = 0;
let expensesImported   = 0;
let categoriesInserted = 0;
let pmInserted         = 0;
let cutoffInserted     = 0;

// ── 1. Create user GuiFranco ──────────────────────────────────────────────────
let userId;
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('GuiFranco');
if (existingUser) {
  userId = existingUser.id;
  console.log(`[user] GuiFranco already exists (id=${userId}), skipping creation`);
} else {
  const hash   = bcrypt.hashSync('980206', 10);
  const result = db.prepare(
    'INSERT INTO users (username, password, is_admin) VALUES (?, ?, 0)'
  ).run('GuiFranco', hash);
  userId = result.lastInsertRowid;
  usersCreated++;
  console.log(`[user] Created GuiFranco (id=${userId})`);
}

// ── Set plan = 'pro' in subscriptions ────────────────────────────────────────
const existingSub = db.prepare('SELECT id FROM subscriptions WHERE user_id = ?').get(userId);
if (!existingSub) {
  db.prepare(
    `INSERT INTO subscriptions (user_id, plan, status, started_at) VALUES (?, 'pro', 'active', datetime('now'))`
  ).run(userId);
  console.log('[subscription] Created pro subscription for GuiFranco');
} else {
  db.prepare(`UPDATE subscriptions SET plan = 'pro', status = 'active' WHERE user_id = ?`).run(userId);
  console.log('[subscription] Updated existing subscription to pro');
}

// ── 2. Insert categories with user_id = GuiFranco ────────────────────────────
// Schema has UNIQUE(name) globally, so INSERT OR IGNORE fires for any category
// whose name already exists as a global row (user_id IS NULL). Those are already
// visible to GuiFranco via the OR user_id IS NULL filter — no duplicate needed.
// Categories unique to GuiFranco (not in the global seed) are inserted with his
// user_id so they appear only for him.
const insertCat = db.prepare(
  'INSERT OR IGNORE INTO categories (name, exclude_from_reports, is_income, user_id) VALUES (?, ?, ?, ?)'
);
for (const cat of data.categories) {
  const r = insertCat.run(cat.name, cat.exclude_from_reports ?? 0, cat.is_income ?? 0, userId);
  if (r.changes > 0) {
    categoriesInserted++;
    console.log(`[categories]   + inserted user-specific: "${cat.name}"`);
  } else {
    console.log(`[categories]   ~ skipped (global exists): "${cat.name}"`);
  }
}
console.log(`[categories] Inserted ${categoriesInserted} user-specific, ${data.categories.length - categoriesInserted} already global\n`);

// ── 3. Insert payment methods with user_id = GuiFranco ───────────────────────
// Same logic as categories: UNIQUE(name) means global PMs are skipped silently.
// GuiFranco sees all global PMs via the OR user_id IS NULL filter.
const insertPM = db.prepare(
  'INSERT OR IGNORE INTO payment_methods (name, is_card, card_type, user_id) VALUES (?, ?, ?, ?)'
);
for (const pm of data.payment_methods) {
  const r = insertPM.run(pm.name, pm.is_card, pm.card_type ?? 'cash', userId);
  if (r.changes > 0) {
    pmInserted++;
    console.log(`[payment_methods]   + inserted user-specific: "${pm.name}"`);
  } else {
    console.log(`[payment_methods]   ~ skipped (global exists): "${pm.name}"`);
  }
}
console.log(`[payment_methods] Inserted ${pmInserted} user-specific, ${data.payment_methods.length - pmInserted} already global\n`);

// ── 4. Insert cutoff_dates ────────────────────────────────────────────────────
// Resolve: old export PM id → name → GuiFranco's PM id (user-specific first,
// fall back to global). ORDER BY user_id DESC puts non-NULL (user-specific) first
// in SQLite since NULL sorts lower than any integer.
const oldPmIdToName = {};
for (const pm of data.payment_methods) oldPmIdToName[pm.id] = pm.name;

const resolvePmId = db.prepare(`
  SELECT id FROM payment_methods
  WHERE name = ? AND (user_id = ? OR user_id IS NULL)
  ORDER BY user_id DESC
  LIMIT 1
`);

const insertCutoff = db.prepare(
  'INSERT OR IGNORE INTO cutoff_dates (payment_method_id, year, month, cutoff_day) VALUES (?, ?, ?, ?)'
);

for (const cd of data.cutoff_dates) {
  const pmName = oldPmIdToName[cd.payment_method_id];
  if (!pmName) {
    console.warn(`[cutoff] unknown export payment_method_id ${cd.payment_method_id} — skipping`);
    continue;
  }
  const row = resolvePmId.get(pmName, userId);
  if (!row) {
    console.warn(`[cutoff] payment method "${pmName}" not found for user ${userId} or globally — skipping`);
    continue;
  }
  const r = insertCutoff.run(row.id, cd.year, cd.month, cd.cutoff_day);
  if (r.changes > 0) {
    cutoffInserted++;
    console.log(`[cutoff]   + inserted: "${pmName}" (pm_id=${row.id}) ${cd.year}-${String(cd.month).padStart(2,'0')} cutoff=${cd.cutoff_day}`);
  } else {
    console.log(`[cutoff]   ~ skipped (already exists): "${pmName}" ${cd.year}-${String(cd.month).padStart(2,'0')}`);
  }
}
console.log(`[cutoff_dates] Inserted ${cutoffInserted} new (${data.cutoff_dates.length} total in export)\n`);

// ── 5. Import expenses (all mapped to GuiFranco's user_id) ────────────────────
// Expenses reference category and payment_method by TEXT name — no ID remapping needed.
const insertExpense = db.prepare(`
  INSERT INTO expenses
    (group_id, purchase_date, due_date, category, subcategory, location,
     payment_method, description, total_amount, installments, installment_number,
     installment_amount, created_at, user_id, is_international, is_checked, recorrente)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
`);

const importAll = db.transaction(() => {
  for (const e of data.expenses) {
    insertExpense.run(
      e.group_id,
      e.purchase_date,
      e.due_date,
      e.category,
      e.subcategory      ?? null,
      e.location         ?? null,
      e.payment_method,
      e.description      ?? null,
      e.total_amount,
      e.installments,
      e.installment_number,
      e.installment_amount,
      e.created_at,
      userId,
      e.is_international ?? 0,
      e.is_checked       ?? 0
    );
    expensesImported++;
  }
});
importAll();
console.log(`[expenses] Imported ${expensesImported}`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════');
console.log('       Migration Summary         ');
console.log('════════════════════════════════');
console.log(`  Users created:           ${usersCreated}`);
console.log(`  Expenses imported:       ${expensesImported}`);
console.log(`  Categories inserted:     ${categoriesInserted} user-specific`);
console.log(`  Payment methods:         ${pmInserted} user-specific`);
console.log(`  Cutoff dates:            ${cutoffInserted}`);
console.log('════════════════════════════════\n');

db.close();
