const { db, initDatabase } = require('../database');
const { addMonths, computeFirstDueDate } = require('../utils/dates');

initDatabase();

const guiFranco = db.prepare("SELECT id FROM users WHERE username = 'GuiFranco'").get();
if (!guiFranco) { console.error('User GuiFranco not found'); process.exit(1); }

const groups = db.prepare(`
  SELECT DISTINCT e.group_id
  FROM expenses e
  JOIN payment_methods pm ON e.payment_method = pm.name
  WHERE pm.is_card = 1
    AND e.installments > 1
    AND e.user_id = ?
`).all(guiFranco.id);

console.log(`Found ${groups.length} groups to reprocess`);

const updateStmt = db.prepare('UPDATE expenses SET due_date = ? WHERE id = ?');

let totalGroups = 0;
let totalRows = 0;
let skipped = 0;

db.exec('BEGIN');
try {
  for (const { group_id } of groups) {
    const installments = db.prepare(`
      SELECT id, purchase_date, payment_method, installment_number
      FROM expenses WHERE group_id = ? AND user_id = ?
      ORDER BY installment_number ASC
    `).all(group_id, guiFranco.id);

    const first = installments.find(e => e.installment_number === 1);
    if (!first) {
      console.warn(`  SKIP group ${group_id} — no installment_number = 1`);
      skipped++;
      continue;
    }

    const firstDueDate = computeFirstDueDate(first.purchase_date, first.payment_method);

    for (const exp of installments) {
      const newDue = addMonths(firstDueDate, exp.installment_number - 1);
      updateStmt.run(newDue, exp.id);
      totalRows++;
    }
    totalGroups++;
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('ERROR — rolled back:', err.message);
  process.exit(1);
}

console.log(`\nDone.`);
console.log(`  Groups processed : ${totalGroups}`);
console.log(`  Rows updated     : ${totalRows}`);
console.log(`  Groups skipped   : ${skipped}`);

// Spot-check: show remaining card installment groups where installment 1 has due_date = purchase_date
const stillWrong = db.prepare(`
  SELECT COUNT(*) as n FROM expenses e
  JOIN payment_methods pm ON e.payment_method = pm.name
  WHERE pm.is_card = 1 AND e.installments > 1 AND e.installment_number = 1
    AND e.due_date = e.purchase_date AND e.user_id = ?
`).get(guiFranco.id);
console.log(`\n  Installment-1 rows still with due_date = purchase_date: ${stillWrong.n}`);
console.log('  (non-zero is expected — these are purchases on or before cutoff day, same-month billing is correct)');
