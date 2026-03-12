const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/dashboard?month=2026-03
// Agrupa por purchase_date (data da compra), não due_date
router.get('/', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(installment_amount), 0) AS total
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
  `).get(month);

  const byMethod = db.prepare(`
    SELECT payment_method, COALESCE(SUM(installment_amount), 0) AS total
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
    GROUP BY payment_method
    ORDER BY total DESC
  `).all(month);

  const byCategory = db.prepare(`
    SELECT category, COALESCE(SUM(installment_amount), 0) AS total
    FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
    GROUP BY category
    ORDER BY total DESC
  `).all(month);

  const recent = db.prepare(`
    SELECT * FROM expenses
    WHERE strftime('%Y-%m', purchase_date) = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(month);

  const evolution = db.prepare(`
    SELECT strftime('%Y-%m', purchase_date) AS month,
           COALESCE(SUM(installment_amount), 0) AS total
    FROM expenses
    WHERE purchase_date >= date(?, '-5 months', 'start of month')
      AND purchase_date <  date(?, '+1 month',  'start of month')
    GROUP BY month
    ORDER BY month
  `).all(`${month}-01`, `${month}-01`);

  res.json({
    month,
    total: totalRow.total,
    by_payment_method: byMethod,
    by_category: byCategory,
    recent_expenses: recent,
    monthly_evolution: evolution,
  });
});

module.exports = router;
