const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database');
const { generateLinkCode, getUser, getDefaultPaymentMethod, setDefaultPaymentMethod } = require('../database/whatsapp');

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

// POST /api/users/whatsapp/link-code — generates a 6-digit code to link WhatsApp
router.post('/whatsapp/link-code', (req, res) => {
  const code   = generateLinkCode(req.user.id);
  const linked = getUser
    ? db.prepare('SELECT phone_number FROM whatsapp_users WHERE user_id = ?').get(req.user.id)
    : null;
  res.json({ code, linked_phone: linked?.phone_number || null });
});

// GET /api/users/whatsapp/status — returns current WhatsApp link status
router.get('/whatsapp/status', (req, res) => {
  const linked = db.prepare(
    'SELECT phone_number, created_at FROM whatsapp_users WHERE user_id = ?'
  ).get(req.user.id);
  res.json({ linked: !!linked, phone_number: linked?.phone_number || null });
});

// DELETE /api/users/whatsapp/unlink — unlinks the WhatsApp number
router.delete('/whatsapp/unlink', (req, res) => {
  db.prepare('DELETE FROM whatsapp_users WHERE user_id = ?').run(req.user.id);
  res.json({ unlinked: true });
});

// GET /api/users/whatsapp/default-method — get default payment method for linked number
router.get('/whatsapp/default-method', (req, res) => {
  const row = db.prepare('SELECT phone_number FROM whatsapp_users WHERE user_id = ?').get(req.user.id);
  if (!row) return res.json({ defaultMethod: null });
  res.json({ defaultMethod: getDefaultPaymentMethod(row.phone_number) });
});

// PUT /api/users/whatsapp/default-method — set default payment method
router.put('/whatsapp/default-method', (req, res) => {
  const { method } = req.body;
  if (!method) return res.status(400).json({ error: 'method is required' });

  const valid = db.prepare('SELECT 1 FROM payment_methods WHERE name = ?').get(method);
  if (!valid) return res.status(400).json({ error: 'Método de pagamento inválido' });

  const row = db.prepare('SELECT phone_number FROM whatsapp_users WHERE user_id = ?').get(req.user.id);
  if (!row) return res.status(404).json({ error: 'WhatsApp não vinculado' });

  setDefaultPaymentMethod(row.phone_number, method);
  res.json({ success: true });
});

module.exports = router;
