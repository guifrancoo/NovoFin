const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');

const router = Router();

// Middleware: admin only
function requireAdmin(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  next();
}

// GET /api/users — list all users (admin only)
router.get('/', requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, username, is_admin, created_at FROM users ORDER BY created_at ASC'
  ).all();
  res.json(users);
});

// POST /api/users — create a new user (admin only)
router.post('/', requireAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password)
    return res.status(400).json({ error: 'username e password são obrigatórios' });
  if (password.length < 6)
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });

  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
  if (exists) return res.status(409).json({ error: 'Nome de usuário já está em uso' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (username, password, is_admin) VALUES (?, ?, 0)'
  ).run(username.trim(), hash);

  const created = db.prepare(
    'SELECT id, username, is_admin, created_at FROM users WHERE id = ?'
  ).get(info.lastInsertRowid);

  res.status(201).json(created);
});

// DELETE /api/users/:id — remove a user (admin only, cannot remove self)
router.delete('/:id', requireAdmin, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.user.id)
    return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (target.is_admin === 1)
    return res.status(400).json({ error: 'Não é possível excluir um administrador' });

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ deleted: true });
});

module.exports = router;
