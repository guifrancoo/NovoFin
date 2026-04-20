/**
 * migrate-v2.js
 * One-time fix: correct due_dates that overflowed because addMonths used
 * new Date(y, m+n, d) which lets JS roll over into the next month.
 * Only card expenses with purchase_date on day 29/30/31 can be affected.
 */

const { db, initDatabase } = require('./database');
initDatabase();

function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total      = (m - 1) + n;
  const targetYear = y + Math.floor(total / 12);
  const targetMon  = (total % 12) + 1;
  const lastDay    = new Date(targetYear, targetMon, 0).getDate();
  return `${targetYear}-${String(targetMon).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

function computeFirstDueDate(purchaseDateStr, methodId, isCard) {
  if (!isCard) return purchaseDateStr;
  const [year, month, day] = purchaseDateStr.split('-').map(Number);
  const cutoffRow = db.prepare(
    'SELECT cutoff_day FROM cutoff_dates WHERE payment_method_id = ? AND year = ? AND month = ?'
  ).get(methodId, year, month);
  const cutoff = cutoffRow ? cutoffRow.cutoff_day : 25;
  const n = day <= cutoff ? 0 : 1;
  return addMonths(purchaseDateStr, n);
}

// Only purchase days 29/30/31 can produce overflow
const candidates = db.prepare(`
  SELECT e.id, e.purchase_date, e.due_date, e.installment_number, e.payment_method,
         pm.id AS method_id, pm.is_card
  FROM expenses e
  JOIN payment_methods pm ON pm.name = e.payment_method
  WHERE pm.is_card = 1
    AND CAST(strftime('%d', e.purchase_date) AS INTEGER) >= 29
`).all();

console.log(`Checking ${candidates.length} candidate expense(s)...`);

const update = db.prepare('UPDATE expenses SET due_date = ? WHERE id = ?');
let fixed = 0;

for (const row of candidates) {
  const firstDue   = computeFirstDueDate(row.purchase_date, row.method_id, row.is_card);
  const correctDue = addMonths(firstDue, (row.installment_number || 1) - 1);
  if (correctDue !== row.due_date) {
    console.log(`  id=${row.id} ${row.payment_method} purchase=${row.purchase_date} installment=${row.installment_number} due: ${row.due_date} → ${correctDue}`);
    update.run(correctDue, row.id);
    fixed++;
  }
}

console.log(`Done. Fixed ${fixed} row(s).`);
