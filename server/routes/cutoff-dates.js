const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/cutoff-dates?payment_method_id=1
router.get('/', (req, res) => {
  const { payment_method_id } = req.query;
  if (!payment_method_id) return res.status(400).json({ error: 'payment_method_id is required' });

  const rows = db.prepare(`
    SELECT cd.*, pm.name AS payment_method_name
    FROM cutoff_dates cd
    JOIN payment_methods pm ON pm.id = cd.payment_method_id
    WHERE cd.payment_method_id = ?
    ORDER BY cd.year DESC, cd.month DESC
  `).all(payment_method_id);

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

// DELETE /api/cutoff-dates/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM cutoff_dates WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

module.exports = router;
