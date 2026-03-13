const { Router } = require('express');
const { db } = require('../database');

const router = Router();

// GET /api/subcategories?category_id=X
router.get('/', (req, res) => {
  const { category_id } = req.query;
  if (category_id) {
    const rows = db.prepare(
      'SELECT * FROM subcategories WHERE category_id = ? ORDER BY name'
    ).all(Number(category_id));
    return res.json(rows);
  }
  // Return all subcategories grouped by category
  const rows = db.prepare(`
    SELECT s.*, c.name AS category_name
    FROM subcategories s
    JOIN categories c ON c.id = s.category_id
    ORDER BY c.name, s.name
  `).all();
  res.json(rows);
});

// POST /api/subcategories
router.post('/', (req, res) => {
  const { category_id, name } = req.body;
  if (!category_id || !name?.trim()) {
    return res.status(400).json({ error: 'category_id and name are required' });
  }
  const cat = db.prepare('SELECT 1 FROM categories WHERE id = ?').get(Number(category_id));
  if (!cat) return res.status(400).json({ error: 'Categoria não encontrada' });

  try {
    const info = db.prepare(
      'INSERT INTO subcategories (category_id, name) VALUES (?, ?)'
    ).run(Number(category_id), name.trim());
    const row = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Subcategoria já existe' });
    }
    throw e;
  }
});

// DELETE /api/subcategories/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM subcategories WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: 1 });
});

module.exports = router;
