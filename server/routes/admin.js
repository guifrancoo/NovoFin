const { Router } = require('express');
const path = require('path');
const fs   = require('fs');
const jwt  = require('jsonwebtoken');
const { reopenDatabase, initDatabase, DB_PATH } = require('../database');

const router = Router();

// ── Admin JWT auth ────────────────────────────────────────────────────────────

// POST /api/admin/login
// Body: { key }  → returns a signed JWT with { role: 'admin' }
router.post('/login', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey)
    return res.status(500).json({ error: 'ADMIN_KEY não configurada no servidor' });

  const { key } = req.body;
  if (!key || key !== adminKey)
    return res.status(401).json({ error: 'Chave inválida' });

  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// Middleware that validates the admin JWT (separate from user JWT)
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Não autenticado' });

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    if (payload.role !== 'admin')
      return res.status(403).json({ error: 'Acesso negado' });
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// GET /api/admin/ping — protected route for testing
router.get('/ping', requireAdmin, (_req, res) => res.json({ ok: true }));

// GET /api/admin/stats — dashboard summary
router.get('/stats', requireAdmin, (_req, res) => {
  const { db } = require('../database');

  const totalUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

  const activeUsers = db.prepare(`
    SELECT COUNT(DISTINCT user_id) AS n FROM expenses
    WHERE purchase_date >= date('now', '-30 days')
  `).get().n;

  const totalTransactions = db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;

  const newUsersThisMonth = db.prepare(`
    SELECT COUNT(*) AS n FROM users
    WHERE created_at >= date('now', 'start of month')
  `).get().n;

  const fileSize = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  const dbSizeKB = Math.round(fileSize / 1024);

  const botErrors = db.prepare(`
    SELECT COUNT(*) AS n FROM bot_errors
    WHERE created_at >= datetime('now', '-24 hours')
  `).get().n;

  res.json({
    totalUsers,
    activeUsers,
    totalTransactions,
    dbSizeKB,
    botErrors,
    newUsersThisMonth,
  });
});

// GET /api/admin/users — full user list with activity data
router.get('/users', requireAdmin, (_req, res) => {
  const { db } = require('../database');

  // Ensure columns exist (safe on re-runs)
  try { db.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'"); } catch (_) {}
  try { db.exec('ALTER TABLE users ADD COLUMN whatsapp_number TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch (_) {}

  const users = db.prepare(`
    SELECT
      u.id,
      u.username  AS name,
      COALESCE(u.email, u.username) AS email,
      u.plan,
      u.whatsapp_number,
      u.created_at,
      COUNT(e.id)  AS transactionCount,
      MAX(e.created_at) AS lastActivity
    FROM users u
    LEFT JOIN expenses e ON e.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  res.json(users.map(u => ({
    id:               u.id,
    name:             u.name,
    email:            u.email     || null,
    plan:             u.plan      || 'free',
    whatsapp:         u.whatsapp_number || null,
    created_at:       u.created_at,
    transactionCount: u.transactionCount,
    lastActivity:     u.lastActivity || null,
  })));
});

// PATCH /api/admin/users/:id/plan — update user plan
router.patch('/users/:id/plan', requireAdmin, (req, res) => {
  const { db } = require('../database');
  const { plan } = req.body;
  const allowed = ['free', 'pro', 'suspended'];

  if (!allowed.includes(plan))
    return res.status(400).json({ error: `Plano inválido. Use: ${allowed.join(', ')}` });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user)
    return res.status(404).json({ error: 'Usuário não encontrado' });

  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.params.id);
  res.json({ ok: true });
});

// GET /api/admin/users/:id/subscription — subscription + last 10 payments
router.get('/users/:id/subscription', requireAdmin, (req, res) => {
  const { db } = require('../database');
  const userId = req.params.id;

  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId) || null;

  const payments = db.prepare(`
    SELECT * FROM payment_history
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(userId);

  res.json({ subscription: sub, payments });
});

// POST /api/admin/users/:id/payment — register a payment and upsert subscription
router.post('/users/:id/payment', requireAdmin, (req, res) => {
  const { db } = require('../database');
  const userId = req.params.id;
  const { amount, plan, months, notes } = req.body;

  if (!amount || !plan || !months)
    return res.status(400).json({ error: 'amount, plan e months são obrigatórios' });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const now        = new Date();
  const periodStart = now.toISOString();
  const periodEnd   = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO payment_history (user_id, amount, plan, period_start, period_end, method, notes)
    VALUES (?, ?, ?, ?, ?, 'manual', ?)
  `).run(userId, amount, plan, periodStart, periodEnd, notes || null);

  db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, started_at, expires_at, updated_at)
    VALUES (?, ?, 'active', ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      plan       = excluded.plan,
      status     = 'active',
      started_at = excluded.started_at,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).run(userId, plan, periodStart, periodEnd, periodStart);

  db.prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan, userId);

  const subscription = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  res.json({ ok: true, subscription });
});

// PATCH /api/admin/users/:id/subscription — update subscription status
router.patch('/users/:id/subscription', requireAdmin, (req, res) => {
  const { db } = require('../database');
  const userId  = req.params.id;
  const { status } = req.body;
  const allowed = ['active', 'expired', 'suspended'];

  if (!allowed.includes(status))
    return res.status(400).json({ error: `Status inválido. Use: ${allowed.join(', ')}` });

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const now = new Date().toISOString();

  // Upsert subscription with new status
  db.prepare(`
    INSERT INTO subscriptions (user_id, plan, status, updated_at)
    VALUES (?, 'free', ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      status     = excluded.status,
      updated_at = excluded.updated_at
  `).run(userId, status, now);

  // Reflect suspended in users.plan; active/expired leave plan as-is
  if (status === 'suspended') {
    db.prepare("UPDATE users SET plan = 'suspended' WHERE id = ?").run(userId);
  } else if (status === 'active') {
    const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(userId);
    if (sub) db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(sub.plan, userId);
  }

  const subscription = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
  res.json({ ok: true, subscription });
});

// GET /api/admin/db-health — database diagnostic
router.get('/db-health', requireAdmin, (_req, res) => {
  const { db } = require('../database');

  const fileSize           = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  const sizeKB             = Math.round(fileSize / 1024);
  const totalUsers         = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const totalTransactions  = db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
  const totalPaymentMethods= db.prepare('SELECT COUNT(*) AS n FROM payment_methods').get().n;
  const totalCategories    = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;

  const oldest = db.prepare('SELECT MIN(purchase_date) AS d FROM expenses').get().d || null;
  const newest = db.prepare('SELECT MAX(purchase_date) AS d FROM expenses').get().d || null;

  const integrityRow   = db.prepare('PRAGMA integrity_check').get();
  const integrityCheck = integrityRow?.integrity_check === 'ok' ? 'ok' : 'error';

  const walRow = db.prepare('PRAGMA journal_mode').get();
  const walMode = walRow ? Object.values(walRow)[0] : 'unknown';

  const uptimeSec = Math.floor(process.uptime());
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;
  const lastRestart = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

  res.json({
    sizeKB,
    totalUsers,
    totalTransactions,
    totalPaymentMethods,
    totalCategories,
    oldestTransaction: oldest,
    newestTransaction: newest,
    integrityCheck,
    walMode,
    lastRestart,
  });
});

// GET /api/admin/errors — last 50 bot errors
router.get('/errors', requireAdmin, (_req, res) => {
  const { db } = require('../database');

  const errors = db.prepare(`
    SELECT id, created_at, phone, user_id, message, error, stack
    FROM bot_errors
    ORDER BY created_at DESC
    LIMIT 50
  `).all();

  res.json(errors);
});

// ─────────────────────────────────────────────────────────────────────────────

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
