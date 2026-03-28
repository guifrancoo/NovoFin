const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/payment-methods
router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM payment_methods ORDER BY name').all());
});

// POST /api/payment-methods  { name, card_type } or { name, is_card } (legacy)
router.post('/', (req, res) => {
  const { name, is_card, card_type } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  // card_type takes precedence; fall back to is_card boolean for legacy callers
  const finalCardType = card_type || (is_card ? 'credit' : 'cash');
  const finalIsCard   = finalCardType === 'credit' ? 1 : 0;

  try {
    const info = db.prepare(
      'INSERT INTO payment_methods (name, is_card, card_type) VALUES (?, ?, ?)'
    ).run(name.trim(), finalIsCard, finalCardType);
    const row = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Método já existe' });
    throw e;
  }
});

// DELETE /api/payment-methods/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const inUse = db.prepare('SELECT 1 FROM expenses WHERE payment_method = (SELECT name FROM payment_methods WHERE id = ?) LIMIT 1').get(id);
  if (inUse) return res.status(409).json({ error: 'Este método está em uso em lançamentos existentes e não pode ser removido' });

  const info = db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

module.exports = router;
