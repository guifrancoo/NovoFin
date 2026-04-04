// One-time admin password reset script
// Run on Railway: node server/scripts/reset-admin.js
// Remove this file after use.

const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('/app/server/data/financeiro.db');

const hash = bcrypt.hashSync('NovoFin2026!', 10);
const info = db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, 'admin');
console.log('Updated rows:', info.changes);

if (info.changes === 0) {
  const users = db.prepare('SELECT id, username FROM users').all();
  console.log('Users in DB:', JSON.stringify(users));
}

db.close();
