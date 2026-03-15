const { Router }   = require('express');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const { db }       = require('../database');
const requireAuth  = require('../middleware/auth');

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

// PUT /api/auth/profile — altera username e/ou senha do usuário autenticado
router.put('/profile', requireAuth, (req, res) => {
  const { current_password, new_username, new_password } = req.body;

  if (!current_password)
    return res.status(400).json({ error: 'Senha atual é obrigatória' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user)
    return res.status(404).json({ error: 'Usuário não encontrado' });

  if (!bcrypt.compareSync(current_password, user.password))
    return res.status(401).json({ error: 'Senha atual incorreta' });

  const updatedUsername = new_username?.trim() || user.username;
  const updatedPassword = new_password
    ? bcrypt.hashSync(new_password, 10)
    : user.password;

  // Verifica se o novo username já está em uso por outro usuário
  if (updatedUsername !== user.username) {
    const conflict = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(updatedUsername, user.id);
    if (conflict)
      return res.status(409).json({ error: 'Nome de usuário já está em uso' });
  }

  db.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?')
    .run(updatedUsername, updatedPassword, user.id);

  // Emite novo token com o username atualizado
  const token = jwt.sign(
    { id: user.id, username: updatedUsername },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, username: updatedUsername });
});

module.exports = router;
