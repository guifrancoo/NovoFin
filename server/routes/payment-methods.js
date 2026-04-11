const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/payment-methods — returns global methods + user's own methods
router.get('/', (req, res) => {
  res.json(
    db.prepare(
      'SELECT * FROM payment_methods WHERE (user_id = ? OR user_id IS NULL) ORDER BY name'
    ).all(req.user.id)
  );
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
      'INSERT INTO payment_methods (name, is_card, card_type, user_id) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), finalIsCard, finalCardType, req.user.id);
    const row = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Método já existe' });
    throw e;
  }
});

// DELETE /api/payment-methods/:id — only own methods can be deleted (not global ones)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const method = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(id);
  if (!method) return res.status(404).json({ error: 'Not found' });
  if (method.user_id === null) return res.status(403).json({ error: 'Métodos globais não podem ser removidos' });
  if (method.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

  const inUse = db.prepare(
    'SELECT 1 FROM expenses WHERE payment_method = ? AND user_id = ? LIMIT 1'
  ).get(method.name, req.user.id);
  if (inUse) return res.status(409).json({ error: 'Este método está em uso em lançamentos existentes e não pode ser removido' });

  db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
  res.json({ deleted: true });
});

module.exports = router;
