const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/categories
router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name').all());
});

// POST /api/categories  { name }
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Categoria já existe' });
    throw e;
  }
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const inUse = db.prepare('SELECT 1 FROM expenses WHERE category = (SELECT name FROM categories WHERE id = ?) LIMIT 1').get(id);
  if (inUse) return res.status(409).json({ error: 'Esta categoria está em uso em lançamentos existentes e não pode ser removida' });

  const info = db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

module.exports = router;
