const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/cutoff-dates?payment_method_id=1  (optional — if omitted, returns all)
router.get('/', (req, res) => {
  const { payment_method_id } = req.query;

  if (payment_method_id) {
    const rows = db.prepare(`
      SELECT cd.*, pm.name AS payment_method_name
      FROM cutoff_dates cd
      JOIN payment_methods pm ON pm.id = cd.payment_method_id
      WHERE cd.payment_method_id = ?
      ORDER BY cd.year DESC, cd.month DESC
    `).all(payment_method_id);
    return res.json(rows);
  }

  // Return all cutoffs for all card methods
  const rows = db.prepare(`
    SELECT cd.*, pm.name AS payment_method_name
    FROM cutoff_dates cd
    JOIN payment_methods pm ON pm.id = cd.payment_method_id
    ORDER BY pm.name, cd.year DESC, cd.month DESC
  `).all();

  res.json(rows);
});

// POST /api/cutoff-dates  { payment_method_id, year, month, cutoff_day }
// Upserts: inserts or replaces if (payment_method_id, year, month) already exists
router.post('/', (req, res) => {
  const { payment_method_id, year, month, cutoff_day } = req.body;

  if (!payment_method_id || !year || !month || !cutoff_day) {
    return res.status(400).json({ error: 'payment_method_id, year, month and cutoff_day are required' });
  }

  const day = parseInt(cutoff_day, 10);
  if (day < 1 || day > 31) return res.status(400).json({ error: 'cutoff_day must be between 1 and 31' });

  const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND is_card = 1').get(payment_method_id);
  if (!method) return res.status(404).json({ error: 'Card payment method not found' });

  db.prepare(`
    INSERT INTO cutoff_dates (payment_method_id, year, month, cutoff_day)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(payment_method_id, year, month) DO UPDATE SET cutoff_day = excluded.cutoff_day
  `).run(payment_method_id, parseInt(year, 10), parseInt(month, 10), day);

  const row = db.prepare(`
    SELECT cd.*, pm.name AS payment_method_name
    FROM cutoff_dates cd
    JOIN payment_methods pm ON pm.id = cd.payment_method_id
    WHERE cd.payment_method_id = ? AND cd.year = ? AND cd.month = ?
  `).get(payment_method_id, parseInt(year, 10), parseInt(month, 10));

  res.status(201).json(row);
});

// PATCH /api/cutoff-dates/:id  { year, month, day }
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { year, month, day } = req.body;

  if (!year || !month || !day) {
    return res.status(400).json({ error: 'year, month and day are required' });
  }

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);

  if (d < 1 || d > 31) return res.status(400).json({ error: 'day must be between 1 and 31' });
  if (m < 1 || m > 12) return res.status(400).json({ error: 'month must be between 1 and 12' });

  const existing = db.prepare(`
    SELECT cd.*, pm.user_id AS pm_user_id
    FROM cutoff_dates cd
    JOIN payment_methods pm ON pm.id = cd.payment_method_id
    WHERE cd.id = ?
  `).get(id);

  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.pm_user_id !== null && existing.pm_user_id !== req.user.id) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  db.prepare('UPDATE cutoff_dates SET year = ?, month = ?, cutoff_day = ? WHERE id = ?')
    .run(y, m, d, id);

  const row = db.prepare(`
    SELECT cd.*, pm.name AS payment_method_name
    FROM cutoff_dates cd
    JOIN payment_methods pm ON pm.id = cd.payment_method_id
    WHERE cd.id = ?
  `).get(id);

  res.json({ ok: true, cutoffDate: row });
});

// DELETE /api/cutoff-dates/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM cutoff_dates WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

module.exports = router;
