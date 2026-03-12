const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// Todos os relatórios usam purchase_date (data da compra), não due_date.
// A tela de Faturas é a única que usa due_date.

// GET /api/reports/by-category?start=2026-01&end=2026-03
router.get('/by-category', (req, res) => {
  const { start, end } = req.query;
  const startDate = start ? `${start}-01` : '2000-01-01';
  const endDate   = end   ? `${end}-31`   : '2099-12-31';

  const rows = db.prepare(`
    SELECT category,
           COALESCE(SUM(installment_amount), 0) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
    GROUP BY category
    ORDER BY total DESC
  `).all(startDate, endDate);

  res.json(rows);
});

// GET /api/reports/by-month?start=2026-01&end=2026-06&category=Lazer
router.get('/by-month', (req, res) => {
  const { start, end, category, payment_method } = req.query;
  const startDate = start ? `${start}-01` : '2000-01-01';
  const endDate   = end   ? `${end}-31`   : '2099-12-31';

  let sql = `
    SELECT strftime('%Y-%m', purchase_date) AS month,
           COALESCE(SUM(installment_amount), 0) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
  `;
  const params = [startDate, endDate];

  if (category)       { sql += ` AND category = ?`;       params.push(category); }
  if (payment_method) { sql += ` AND payment_method = ?`; params.push(payment_method); }

  sql += ` GROUP BY month ORDER BY month`;
  res.json(db.prepare(sql).all(...params));
});

// GET /api/reports/by-payment-method?start=2026-01&end=2026-03
router.get('/by-payment-method', (req, res) => {
  const { start, end } = req.query;
  const startDate = start ? `${start}-01` : '2000-01-01';
  const endDate   = end   ? `${end}-31`   : '2099-12-31';

  const rows = db.prepare(`
    SELECT payment_method,
           COALESCE(SUM(installment_amount), 0) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
    GROUP BY payment_method
    ORDER BY total DESC
  `).all(startDate, endDate);

  res.json(rows);
});

// GET /api/reports/detail?start=2026-01&end=2026-03&category=Lazer&payment_method=TAM
router.get('/detail', (req, res) => {
  const { start, end, category, payment_method, location } = req.query;
  const startDate = start ? `${start}-01` : '2000-01-01';
  const endDate   = end   ? `${end}-31`   : '2099-12-31';

  let sql = `SELECT * FROM expenses WHERE purchase_date BETWEEN ? AND ?`;
  const params = [startDate, endDate];

  if (category)       { sql += ` AND category = ?`;       params.push(category); }
  if (payment_method) { sql += ` AND payment_method = ?`; params.push(payment_method); }
  if (location)       { sql += ` AND location LIKE ?`;    params.push(`%${location}%`); }

  sql += ` ORDER BY purchase_date DESC, group_id, installment_number`;
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
