const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/dashboard?month=2026-03
router.get('/', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  // Income and expense for the selected month (excluding card-bill-payment category)
  const totalRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
      COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
  `).get(month);

  // Cash balance: sum of Dinheiro-only transactions up to end of selected month.
  // The Excel SALDO column tracks only cash (Dinheiro) movements:
  //   income (salary, etc.) = positive Dinheiro
  //   cash expenses          = negative Dinheiro
  //   card bill payments     = negative Dinheiro ("Pagamentos Cartões")
  // Card purchases themselves do NOT move cash — they are excluded here.
  const accRow = db.prepare(`
    SELECT COALESCE(SUM(installment_amount), 0) AS net_accumulated
    FROM expenses
    WHERE payment_method = 'Dinheiro'
      AND strftime('%Y-%m', purchase_date) <= ?
  `).get(month);

  const byMethod = db.prepare(`
    SELECT payment_method,
      COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
      COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
    GROUP BY payment_method
    ORDER BY expense DESC
  `).all(month);

  // Only show expenses in the category pie (negative amounts), excluding card-bill-payment
  const byCategory = db.prepare(`
    SELECT category,
           ABS(COALESCE(SUM(installment_amount), 0)) AS total
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
      AND installment_amount < 0
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
    GROUP BY category
    ORDER BY total DESC
  `).all(month);

  // Only show installment_number = 1 (purchase month row)
  const recent = db.prepare(`
    SELECT * FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
      AND installment_number = 1
    ORDER BY purchase_date DESC, created_at DESC
  `).all(month);

  const evolution = db.prepare(`
    SELECT strftime('%Y-%m', purchase_date) AS month,
           COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
           COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
    FROM expenses
    WHERE purchase_date >= date(?, '-5 months', 'start of month')
      AND purchase_date <  date(?, '+1 month',  'start of month')
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
    GROUP BY month
    ORDER BY month
  `).all(`${month}-01`, `${month}-01`);

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
