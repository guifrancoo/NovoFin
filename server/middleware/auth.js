const jwt = require('jsonwebtoken');
const { db } = require('../database');

module.exports = function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Não autenticado' });

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    // Sempre busca is_admin do banco — tokens antigos não têm o campo no payload
    const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(payload.id);
    req.user = { ...payload, is_admin: row ? row.is_admin === 1 : false };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
