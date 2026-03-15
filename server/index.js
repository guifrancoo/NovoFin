require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDatabase } = require('./database');

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
const requireAuth          = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3001;
const PROD = process.env.NODE_ENV === 'production';

// CORS apenas em desenvolvimento (em produção tudo vem do mesmo servidor)
if (!PROD) {
  app.use(cors({ origin: 'http://localhost:5173' }));
}

app.use(express.json({ limit: '100mb' }));

// Rotas públicas
app.use('/api/auth',  authRouter);
app.use('/api/admin', adminRouter);
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

// Servir frontend buildado (produção ou quando o dist existir)
const distPath = path.join(__dirname, '..', 'client', 'dist');
const distIndex = path.join(distPath, 'index.html');
const fs = require('fs');
if (PROD || fs.existsSync(distIndex)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(distIndex));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

initDatabase();
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
