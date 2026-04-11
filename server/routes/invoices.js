const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// Returns SQL snippet and params for user filtering.
function userFilter(req) {
  return { sql: ' AND user_id = ?', params: [req.user.id] };
}

// GET /api/invoices
// Retorna todos os meses que possuem pelo menos um lançamento,
// agrupados por cartão. Sem limite fixo de meses.
router.get('/', (req, res) => {
  const cardMethods = db.prepare(
    'SELECT * FROM payment_methods WHERE is_card = 1 AND (user_id = ? OR user_id IS NULL) ORDER BY name'
  ).all(req.user.id);
  const uf = userFilter(req);

  const result = {};
  for (const method of cardMethods) {
    // Busca os meses distintos que têm lançamentos para este cartão
    const months = db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', due_date) AS month
      FROM expenses
      WHERE payment_method = ?${uf.sql}
      ORDER BY month ASC
    `).all(method.name, ...uf.params).map((r) => r.month);

    result[method.name] = {};
    for (const month of months) {
      const rows = db.prepare(`
        SELECT * FROM expenses
        WHERE payment_method = ?
          AND strftime('%Y-%m', due_date) = ?
          ${uf.sql}
        ORDER BY due_date, group_id, installment_number
      `).all(method.name, month, ...uf.params);

      const total = rows.reduce((s, r) => s + r.installment_amount, 0);
      result[method.name][month] = { total: parseFloat(total.toFixed(2)), expenses: rows };
    }
  }

  res.json(result);
});

// GET /api/invoices/:payment_method/:month
router.get('/:payment_method/:month', (req, res) => {
  const { payment_method, month } = req.params;
  const uf = userFilter(req);

  const rows = db.prepare(`
    SELECT * FROM expenses
    WHERE payment_method = ?
      AND strftime('%Y-%m', due_date) = ?
      ${uf.sql}
    ORDER BY due_date, group_id, installment_number
  `).all(payment_method, month, ...uf.params);

  const total = rows.reduce((s, r) => s + r.installment_amount, 0);
  res.json({ payment_method, month, total: parseFloat(total.toFixed(2)), expenses: rows });
});

module.exports = router;
