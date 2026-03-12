const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/invoices?months=6
// Retorna apenas meses com pelo menos um lançamento (total > 0).
// Faturas continuam usando due_date (data de cobrança no cartão).
router.get('/', (req, res) => {
  const months = Math.min(Math.max(parseInt(req.query.months, 10) || 6, 1), 24);
  const now = new Date();

  const monthList = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const cardMethods = db.prepare(
    'SELECT * FROM payment_methods WHERE is_card = 1 ORDER BY name'
  ).all();

  const result = {};
  for (const method of cardMethods) {
    result[method.name] = {};
    for (const month of monthList) {
      const rows = db.prepare(`
        SELECT * FROM expenses
        WHERE payment_method = ?
          AND strftime('%Y-%m', due_date) = ?
        ORDER BY due_date, group_id, installment_number
      `).all(method.name, month);

      // Só inclui o mês se houver lançamentos
      if (rows.length === 0) continue;

      const total = rows.reduce((s, r) => s + r.installment_amount, 0);
      result[method.name][month] = { total: parseFloat(total.toFixed(2)), expenses: rows };
    }
  }

  res.json(result);
});

// GET /api/invoices/:payment_method/:month
router.get('/:payment_method/:month', (req, res) => {
  const { payment_method, month } = req.params;

  const rows = db.prepare(`
    SELECT * FROM expenses
    WHERE payment_method = ?
      AND strftime('%Y-%m', due_date) = ?
    ORDER BY due_date, group_id, installment_number
  `).all(payment_method, month);

  const total = rows.reduce((s, r) => s + r.installment_amount, 0);
  res.json({ payment_method, month, total: parseFloat(total.toFixed(2)), expenses: rows });
});

module.exports = router;
