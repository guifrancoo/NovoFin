const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// Returns SQL snippet and params for user filtering.
// Admin sees all data; regular users see only their own.
function userFilter(req) {
  if (req.user.is_admin) return { sql: '', params: [] };
  return { sql: ' AND user_id = ?', params: [req.user.id] };
}

// GET /api/dashboard?month=2026-03
router.get('/', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const uf = userFilter(req);

  // Income and expense for the selected month (excluding card-bill-payment category)
  const totalRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
      COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
  `).get(month, ...uf.params);

  // Cash balance: sum of Dinheiro-only transactions up to end of selected month.
  const accRow = db.prepare(`
    SELECT COALESCE(SUM(installment_amount), 0) AS net_accumulated
    FROM expenses
    WHERE payment_method = 'Dinheiro'
      AND strftime('%Y-%m', purchase_date) <= ?
      ${uf.sql}
  `).get(month, ...uf.params);

  const byMethod = db.prepare(`
    SELECT payment_method,
      COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
      COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
    GROUP BY payment_method
    ORDER BY expense DESC
  `).all(month, ...uf.params);

  // Only show expenses in the category pie (negative amounts), excluding card-bill-payment
  const byCategory = db.prepare(`
    SELECT category,
           ABS(COALESCE(SUM(installment_amount), 0)) AS total
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
      AND installment_amount < 0
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
    GROUP BY category
    ORDER BY total DESC
  `).all(month, ...uf.params);

  // Only show installment_number = 1 (purchase month row)
  const recent = db.prepare(`
    SELECT * FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
      AND installment_number = 1
      ${uf.sql}
    ORDER BY purchase_date DESC, created_at DESC
  `).all(month, ...uf.params);

  const evolution = db.prepare(`
    SELECT strftime('%Y-%m', purchase_date) AS month,
           COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
           COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
    FROM expenses
    WHERE purchase_date >= date(?, '-5 months', 'start of month')
      AND purchase_date <  date(?, '+1 month',  'start of month')
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
    GROUP BY month
    ORDER BY month
  `).all(`${month}-01`, `${month}-01`, ...uf.params);

  res.json({
    month,
    income: totalRow.income,
    expense: totalRow.expense,
    net_accumulated: accRow.net_accumulated,
    by_payment_method: byMethod,
    by_category: byCategory,
    recent_expenses: recent,
    monthly_evolution: evolution,
  });
});

module.exports = router;
