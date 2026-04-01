const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// All reports use purchase_date. All aggregate over expenses (installment_amount < 0),
// displaying absolute values (ABS).

// Returns SQL snippet and params for user filtering.
function userFilter(req) {
  return { sql: ' AND user_id = ?', params: [req.user.id] };
}

// GET /api/reports/by-category?start=2026-01&end=2026-03
// Returns [{category, total, count, subcategories:[{subcategory,total,count}]}]
router.get('/by-category', (req, res) => {
  const { start, end } = req.query;
  const startDate = start ? `${start}-01` : '2000-01-01';
  const endDate   = end   ? `${end}-31`   : '2099-12-31';
  const uf = userFilter(req);

  const catRows = db.prepare(`
    SELECT category,
           COALESCE(SUM(installment_amount), 0) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
    GROUP BY category
    ORDER BY total ASC
  `).all(startDate, endDate, ...uf.params);

  // Subcategory breakdown per category
  const subRows = db.prepare(`
    SELECT category, subcategory,
           COALESCE(SUM(installment_amount), 0) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND subcategory IS NOT NULL
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
    GROUP BY category, subcategory
    ORDER BY category, total ASC
  `).all(startDate, endDate, ...uf.params);

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
  const uf = userFilter(req);

  let sql = `
    SELECT strftime('%Y-%m', purchase_date) AS month,
           ABS(COALESCE(SUM(installment_amount), 0)) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND installment_amount < 0
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
  `;
  const params = [startDate, endDate, ...uf.params];

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
  const uf = userFilter(req);

  const rows = db.prepare(`
    SELECT payment_method,
           ABS(COALESCE(SUM(installment_amount), 0)) AS total,
           COUNT(*) AS count
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND installment_amount < 0
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
    GROUP BY payment_method
    ORDER BY total DESC
  `).all(startDate, endDate, ...uf.params);

  res.json(rows);
});

// GET /api/reports/detail?start=2026-01&end=2026-03&category=Lazer&payment_method=TAM
router.get('/detail', (req, res) => {
  const { start, end, category, payment_method, location } = req.query;
  const startDate = start ? `${start}-01` : '2000-01-01';
  const endDate   = end   ? `${end}-31`   : '2099-12-31';
  const uf = userFilter(req);

  let sql = `SELECT * FROM expenses WHERE purchase_date BETWEEN ? AND ?${uf.sql}`;
  const params = [startDate, endDate, ...uf.params];

  if (category)       { sql += ` AND category = ?`;       params.push(category); }
  if (payment_method) { sql += ` AND payment_method = ?`; params.push(payment_method); }
  if (location)       { sql += ` AND location LIKE ?`;    params.push(`%${location}%`); }

  sql += ` ORDER BY purchase_date DESC, group_id, installment_number`;
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
