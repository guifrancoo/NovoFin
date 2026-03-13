const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');

const expensesRouter       = require('./routes/expenses');
const dashboardRouter      = require('./routes/dashboard');
const invoicesRouter       = require('./routes/invoices');
const reportsRouter        = require('./routes/reports');
const paymentMethodsRouter = require('./routes/payment-methods');
const categoriesRouter     = require('./routes/categories');
const cutoffDatesRouter    = require('./routes/cutoff-dates');
const subcategoriesRouter  = require('./routes/subcategories');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/expenses',        expensesRouter);
app.use('/api/dashboard',       dashboardRouter);
app.use('/api/invoices',        invoicesRouter);
app.use('/api/reports',         reportsRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/categories',      categoriesRouter);
app.use('/api/cutoff-dates',    cutoffDatesRouter);
app.use('/api/subcategories',   subcategoriesRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

initDatabase();
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
