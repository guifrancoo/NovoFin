const { Router } = require('express');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { db } = require('../database');

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username e password são obrigatórios' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Usuário ou senha incorretos' });

  const token = jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, username: user.username });
});

// GET /api/auth/me  — verifica o token e retorna o usuário
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token ausente' });

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    res.json({ id: payload.id, username: payload.username });
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
});

module.exports = router;
