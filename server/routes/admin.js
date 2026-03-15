const { Router } = require('express');
const path = require('path');
const fs   = require('fs');
const { reopenDatabase, initDatabase } = require('../database');

const router = Router();

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/app/server/data/financeiro.db'
  : path.join(__dirname, '..', 'financeiro.db');

// POST /api/admin/restore-db
// Header obrigatório: x-admin-key: <ADMIN_KEY do .env>
// Body: { db: "<base64 do arquivo .db>" }
router.post('/restore-db', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey)
    return res.status(500).json({ error: 'ADMIN_KEY não configurada no servidor' });

  if (req.headers['x-admin-key'] !== adminKey)
    return res.status(401).json({ error: 'Chave de admin inválida' });

  const { db: dbBase64 } = req.body;
  if (!dbBase64)
    return res.status(400).json({ error: 'Campo "db" (base64) ausente no body' });

  let buffer;
  try {
    buffer = Buffer.from(dbBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Base64 inválido' });
  }

  // Validação mínima: SQLite começa com "SQLite format 3\0"
  if (!buffer.slice(0, 16).toString('ascii').startsWith('SQLite format 3')) {
    return res.status(400).json({ error: 'Arquivo não parece ser um banco SQLite válido' });
  }

  // Salva com backup do anterior
  const backupPath = DB_PATH + '.bak';
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backupPath);
  }

  fs.writeFileSync(DB_PATH, buffer);
  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`[admin] arquivo gravado em disco (${sizeMB} MB)`);

  // Diagnóstico: abre conexão SEPARADA direto no arquivo recém-gravado
  let diagExpenses = null, diagUsers = null, diagIntegrity = null, diagError = null;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const diagDb = new DatabaseSync(DB_PATH);
    diagIntegrity = diagDb.prepare('PRAGMA integrity_check').get();
    diagExpenses  = diagDb.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
    diagUsers     = diagDb.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    diagDb.close();
    console.log('[admin] diagnóstico pós-gravação:', { integrity: diagIntegrity, expenses: diagExpenses, users: diagUsers });
  } catch (err) {
    diagError = err.message;
    console.error('[admin] erro no diagnóstico pós-gravação:', err.message);
  }

  reopenDatabase();
  console.log('[admin] reopenDatabase() concluído');

  // Conta novamente via proxy após reopen
  let postExpenses = null, postUsers = null, postError = null;
  try {
    const { db } = require('../database');
    postExpenses = db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
    postUsers    = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    console.log('[admin] contagem pós-reopen via proxy:', { expenses: postExpenses, users: postUsers });
  } catch (err) {
    postError = err.message;
    console.error('[admin] erro na contagem pós-reopen:', err.message);
  }

  res.json({
    ok: true,
    size_bytes: buffer.length,
    message: 'Banco restaurado com sucesso.',
    diag_post_write:  { integrity: diagIntegrity, expenses: diagExpenses, users: diagUsers, error: diagError },
    diag_post_reopen: { expenses: postExpenses, users: postUsers, error: postError },
  });
});

// GET /api/admin/check-db
router.get('/check-db', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey)
    return res.status(500).json({ error: 'ADMIN_KEY não configurada no servidor' });

  if (req.headers['x-admin-key'] !== adminKey)
    return res.status(401).json({ error: 'Chave de admin inválida' });

  const { db } = require('../database');

  const fileExists = fs.existsSync(DB_PATH);
  const fileSize   = fileExists ? fs.statSync(DB_PATH).size : null;

  let expenses = null, users = null, dbError = null;
  try {
    expenses = db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
    users    = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  } catch (err) {
    dbError = err.message;
  }

  res.json({
    node_env:      process.env.NODE_ENV || 'development',
    db_path:       DB_PATH,
    file_exists:   fileExists,
    file_size_bytes: fileSize,
    file_size_mb:  fileSize ? (fileSize / 1024 / 1024).toFixed(2) : null,
    expenses_count: expenses,
    users_count:    users,
    db_error:       dbError,
  });
});

// GET /api/admin/delete-db
// Header obrigatório: x-admin-key: <ADMIN_KEY do .env>
// Fecha a conexão, deleta o arquivo do banco e recria um banco vazio inicializado.
router.get('/delete-db', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey)
    return res.status(500).json({ error: 'ADMIN_KEY não configurada no servidor' });

  if (req.headers['x-admin-key'] !== adminKey)
    return res.status(401).json({ error: 'Chave de admin inválida' });

  try {
    // Fecha a conexão atual antes de deletar
    const { db } = require('../database');
    try { db.close?.(); } catch (_) {}

    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
      console.log('[admin] arquivo do banco deletado:', DB_PATH);
    } else {
      console.log('[admin] arquivo do banco não existia:', DB_PATH);
    }

    // Reabre criando banco vazio e inicializa o schema
    reopenDatabase();
    initDatabase();

    console.log('[admin] banco recriado e inicializado com sucesso');
    res.json({ ok: true, message: 'Banco deletado e recriado com sucesso.' });
  } catch (err) {
    console.error('[admin] erro ao deletar banco:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/reset-password
// Body: { username, new_password }
router.post('/reset-password', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey)
    return res.status(500).json({ error: 'ADMIN_KEY não configurada no servidor' });

  if (req.headers['x-admin-key'] !== adminKey)
    return res.status(401).json({ error: 'Chave de admin inválida' });

  const { username, new_password } = req.body;
  if (!username || !new_password)
    return res.status(400).json({ error: 'username e new_password são obrigatórios' });

  const bcrypt = require('bcryptjs');
  const { db } = require('../database');

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (!user)
    return res.status(404).json({ error: `Usuário "${username}" não encontrado` });

  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);

  console.log(`[admin] senha do usuário "${username}" redefinida`);
  res.json({ ok: true, message: `Senha do usuário "${username}" atualizada com sucesso` });
});

module.exports = router;
