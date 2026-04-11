const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/categories — returns global categories + user's own categories
router.get('/', (req, res) => {
  res.json(
    db.prepare(
      'SELECT * FROM categories WHERE (user_id = ? OR user_id IS NULL) ORDER BY name'
    ).all(req.user.id)
  );
});

// POST /api/categories  { name }
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  try {
    const info = db.prepare(
      'INSERT INTO categories (name, user_id) VALUES (?, ?)'
    ).run(name.trim(), req.user.id);
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Categoria já existe' });
    throw e;
  }
});

// DELETE /api/categories/:id — only own categories can be deleted (not global ones)
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!cat) return res.status(404).json({ error: 'Not found' });
  if (cat.user_id === null) return res.status(403).json({ error: 'Categorias globais não podem ser removidas' });
  if (cat.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

  const inUse = db.prepare(
    'SELECT 1 FROM expenses WHERE category = ? AND user_id = ? LIMIT 1'
  ).get(cat.name, req.user.id);
  if (inUse) return res.status(409).json({ error: 'Esta categoria está em uso em lançamentos existentes e não pode ser removida' });

  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ deleted: true });
});

module.exports = router;
