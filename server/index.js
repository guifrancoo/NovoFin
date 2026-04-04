require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { initDatabase, DB_PATH, db } = require('./database');

const authRouter           = require('./routes/auth');
const adminRouter          = require('./routes/admin');
const expensesRouter       = require('./routes/expenses');
const dashboardRouter      = require('./routes/dashboard');
const invoicesRouter       = require('./routes/invoices');
const reportsRouter        = require('./routes/reports');
const paymentMethodsRouter = require('./routes/payment-methods');
const categoriesRouter     = require('./routes/categories');
const cutoffDatesRouter    = require('./routes/cutoff-dates');
const subcategoriesRouter  = require('./routes/subcategories');
const usersRouter          = require('./routes/users');
const whatsappRouter       = require('./routes/whatsapp');
const requireAuth          = require('./middleware/auth');
const { initWhatsappTables } = require('./database/whatsapp');

const app  = express();
const PORT = process.env.PORT || 3001;
const PROD = process.env.NODE_ENV === 'production';

// CORS apenas em desenvolvimento (em produção tudo vem do mesmo servidor)
if (!PROD) {
  app.use(cors({ origin: 'http://localhost:5173' }));
}

app.use(express.json({ limit: '100mb' }));

// ⚠️  TEMPORARY — remove after use
app.post('/api/temp-reset', (req, res) => {
  const { resetKey, username, newPassword } = req.body;
  if (resetKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(newPassword, 10);
    const info = db.prepare('UPDATE users SET password = ? WHERE username = ?').run(hash, username);
    if (info.changes === 0) {
      const users = db.prepare('SELECT id, username FROM users').all();
      return res.json({ error: 'User not found', users });
    }
    res.json({ success: true, message: `Password updated for ${username}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas públicas
app.use('/api/auth',      authRouter);
app.use('/api/admin',     adminRouter);
app.use('/api/whatsapp',  whatsappRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Rotas protegidas
app.use('/api/expenses',        requireAuth, expensesRouter);
app.use('/api/dashboard',       requireAuth, dashboardRouter);
app.use('/api/invoices',        requireAuth, invoicesRouter);
app.use('/api/reports',         requireAuth, reportsRouter);
app.use('/api/payment-methods', requireAuth, paymentMethodsRouter);
app.use('/api/categories',      requireAuth, categoriesRouter);
app.use('/api/cutoff-dates',    requireAuth, cutoffDatesRouter);
app.use('/api/subcategories',   requireAuth, subcategoriesRouter);
app.use('/api/users',           requireAuth, usersRouter);

// Servir frontend buildado (produção ou quando o dist existir)
const distPath = path.join(__dirname, '..', 'client', 'dist');
const distIndex = path.join(distPath, 'index.html');
if (PROD || fs.existsSync(distIndex)) {
  app.use(express.static(distPath));
  // Nunca faz cache do index.html — garante que o browser
  // carregue o build mais recente (os assets JS/CSS têm hash no nome)
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(distIndex);
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Diagnóstico do banco antes de inicializar ─────────────────────────────────
console.log('=== STARTUP DIAGNOSTICS ===');
console.log('NODE_ENV  :', process.env.NODE_ENV || 'development');
console.log('DB_PATH   :', DB_PATH);
const dbExists   = fs.existsSync(DB_PATH);
const dbSizeBytes = dbExists ? fs.statSync(DB_PATH).size : 0;
console.log('DB exists :', dbExists);
console.log('DB size   :', dbExists ? `${(dbSizeBytes / 1024 / 1024).toFixed(2)} MB (${dbSizeBytes} bytes)` : 'n/a');
try {
  const dirContents = fs.readdirSync(path.dirname(DB_PATH));
  console.log('Dir contents:', dirContents);
} catch (e) {
  console.log('Dir contents: (erro ao listar)', e.message);
}
console.log('===========================');
// ─────────────────────────────────────────────────────────────────────────────

initDatabase();
initWhatsappTables();

// ── Diagnóstico pós-init: conta registros para confirmar que o volume foi lido ─
console.log('=== POST-INIT DIAGNOSTICS ===');
try {
  const expensesCount = db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
  const usersCount    = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  const dbSizePost    = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
  console.log('DB_PATH        :', DB_PATH);
  console.log('DB size (post) :', dbSizePost ? `${(dbSizePost / 1024 / 1024).toFixed(2)} MB (${dbSizePost} bytes)` : 'n/a');
  console.log('expenses count :', expensesCount);
  console.log('users count    :', usersCount);
  if (expensesCount === 0) {
    console.warn('AVISO: tabela expenses vazia — volume pode não estar montado ou banco é novo.');
  }
} catch (e) {
  console.error('Erro no diagnóstico pós-init:', e.message);
}
console.log('=============================');
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
