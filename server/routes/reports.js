const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// All reports use purchase_date. All aggregate over expenses (installment_amount < 0),
// displaying absolute values (ABS).

// GET /api/reports/by-category?start=2026-01&end=2026-03
// Returns [{category, total, count, subcategories:[{subcategory,total,count}]}]
router.get('/by-category', (req, res) => {
  const { start, end } = req.query;
  const startDate = start ? `${start}-01` : '2000-01-01';
  const endDate   = end   ? `${end}-31`   : '2099-12-31';

  const catRows = db.prepare(`
    SELECT category,
           ABS(COALESCE(SUM(installment_amount), 0)) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND installment_amount < 0
    GROUP BY category
    ORDER BY total DESC
  `).all(startDate, endDate);

  // Subcategory breakdown per category
  const subRows = db.prepare(`
    SELECT category, subcategory,
           ABS(COALESCE(SUM(installment_amount), 0)) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND installment_amount < 0
      AND subcategory IS NOT NULL
    GROUP BY category, subcategory
    ORDER BY category, total DESC
  `).all(startDate, endDate);

  const subMap = {};
  for (const r of subRows) {
    if (!subMap[r.category]) subMap[r.category] = [];
    subMap[r.category].push({ subcategory: r.subcategory, total: r.total, count: r.count });
  }

  const result = catRows.map((r) => ({
    ...r,
    subcategories: subMap[r.category] || [],
  }));

  res.json(result);
});

// GET /api/reports/by-month?start=2026-01&end=2026-06&category=Lazer
router.get('/by-month', (req, res) => {
  const { start, end, category, payment_method } = req.query;
  const startDate = start ? `${start}-01` : '2000-01-01';
  const endDate   = end   ? `${end}-31`   : '2099-12-31';

  let sql = `
    SELECT strftime('%Y-%m', purchase_date) AS month,
           ABS(COALESCE(SUM(installment_amount), 0)) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND installment_amount < 0
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
           ABS(COALESCE(SUM(installment_amount), 0)) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND installment_amount < 0
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
