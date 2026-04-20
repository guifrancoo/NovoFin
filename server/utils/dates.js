const { db } = require('../database');

function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const total      = (m - 1) + n;
  const targetYear = y + Math.floor(total / 12);
  const targetMon  = (total % 12) + 1;
  const lastDay    = new Date(targetYear, targetMon, 0).getDate();
  return `${targetYear}-${String(targetMon).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`;
}

function computeFirstDueDate(purchaseDateStr, methodName) {
  const method = db.prepare('SELECT * FROM payment_methods WHERE name = ?').get(methodName);
  if (!method || !method.is_card) {
    return purchaseDateStr;
  }

  const [year, month, day] = purchaseDateStr.split('-').map(Number);
  const cutoffRow = db.prepare(
    'SELECT cutoff_day FROM cutoff_dates WHERE payment_method_id = ? AND year = ? AND month = ?'
  ).get(method.id, year, month);

  const cutoff = cutoffRow ? cutoffRow.cutoff_day : 25;
  const n = day <= cutoff ? 0 : 1;
  const dueDate = addMonths(purchaseDateStr, n);
  return dueDate;
}

module.exports = { addMonths, computeFirstDueDate };
