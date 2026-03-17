const { Router } = require('express');
const path = require('path');
const fs   = require('fs');
const { reopenDatabase, initDatabase, DB_PATH } = require('../database');

const router = Router();

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

// POST /api/admin/import-json
// Header obrigatório: x-admin-key: <ADMIN_KEY do .env>
// Body: objeto JSON com arrays por tabela (gerado por export-data.js)
router.post('/import-json', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey)
    return res.status(500).json({ error: 'ADMIN_KEY não configurada no servidor' });

  if (req.headers['x-admin-key'] !== adminKey)
    return res.status(401).json({ error: 'Chave de admin inválida' });

  const payload = req.body;
  if (!payload || typeof payload !== 'object')
    return res.status(400).json({ error: 'Body JSON inválido' });

  const { db } = require('../database');

  // Log de diagnóstico: mostra qual arquivo está sendo usado
  const fileBefore = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : null;
  console.log('[admin] import-json iniciado');
  console.log('[admin] NODE_ENV  :', process.env.NODE_ENV || 'development');
  console.log('[admin] DB_PATH   :', DB_PATH);
  console.log('[admin] file size antes:', fileBefore != null ? `${fileBefore} bytes` : 'arquivo não existe');

  // Ordem respeita dependências de FK: primeiro pais, depois filhos
  // DELETE e INSERT ficam dentro da mesma transaction para garantir atomicidade:
  // se qualquer INSERT falhar, o ROLLBACK restaura os dados anteriores.
  const deleteOrder = ['expenses', 'cutoff_dates', 'subcategories', 'categories', 'payment_methods', 'users'];
  const insertOrder = ['categories', 'payment_methods', 'subcategories', 'cutoff_dates', 'expenses', 'users'];

  const counts = {};

  try {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN TRANSACTION');
    try {
      // Limpa na ordem inversa de dependência (dentro da transaction)
      for (const table of deleteOrder) {
        db.exec(`DELETE FROM ${table}`);
      }

      // Reimporta na ordem correta (pais antes de filhos)
      for (const table of insertOrder) {
        const rows = payload[table];
        if (!Array.isArray(rows) || rows.length === 0) {
          counts[table] = 0;
          continue;
        }

        const cols   = Object.keys(rows[0]);
        const params = cols.map(() => '?').join(', ');
        const stmt   = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${params})`);

        for (const row of rows) stmt.run(...cols.map(c => row[c]));

        counts[table] = rows.length;
        console.log(`[admin] import-json: ${table} — ${rows.length} registros`);
      }

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    db.exec('PRAGMA foreign_keys = ON');

    // Verifica o arquivo após o commit
    const fileAfter   = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : null;
    const fileExistsAfter = fs.existsSync(DB_PATH);
    console.log('[admin] import-json concluído com sucesso');
    console.log('[admin] file size depois:', fileAfter != null ? `${fileAfter} bytes` : 'ARQUIVO NÃO ENCONTRADO');
    if (!fileExistsAfter) {
      console.error('[admin] ALERTA: arquivo do banco não encontrado em', DB_PATH, '— volume pode não estar montado!');
    }

    res.json({
      ok: true,
      counts,
      diagnostics: {
        node_env:          process.env.NODE_ENV || 'development',
        db_path:           DB_PATH,
        file_size_before:  fileBefore,
        file_size_after:   fileAfter,
        file_exists_after: fileExistsAfter,
      },
    });
  } catch (err) {
    db.exec('PRAGMA foreign_keys = ON');
    console.error('[admin] erro no import-json:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/export-json
// Header obrigatório: x-admin-key: <ADMIN_KEY do .env>
// Retorna JSON com todos os registros de todas as tabelas
router.get('/export-json', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey)
    return res.status(500).json({ error: 'ADMIN_KEY não configurada no servidor' });

  if (req.headers['x-admin-key'] !== adminKey)
    return res.status(401).json({ error: 'Chave de admin inválida' });

  const { db } = require('../database');

  try {
    const tables = ['categories', 'subcategories', 'payment_methods', 'cutoff_dates', 'expenses', 'users'];
    const result = {};

    for (const table of tables) {
      result[table] = db.prepare(`SELECT * FROM ${table}`).all();
      console.log(`[admin] export-json: ${table} — ${result[table].length} registros`);
    }

    console.log('[admin] export-json concluído com sucesso');
    res.json(result);
  } catch (err) {
    console.error('[admin] erro no export-json:', err.message);
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
