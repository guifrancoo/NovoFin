const { Router } = require('express');
const { randomUUID } = require('crypto');
const { db } = require('../database');

const router = Router();

// --- Helpers ---

function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1 + n, d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Computes the due_date for the FIRST installment.
 * - Non-card (e.g. Dinheiro): due_date = purchase_date
 * - Card: looks up cutoff for that card/month; default 25
 *   - purchase_day <= cutoff → +1 month
 *   - purchase_day >  cutoff → +2 months
 */
function computeFirstDueDate(purchaseDateStr, methodName) {
  const method = db.prepare('SELECT * FROM payment_methods WHERE name = ?').get(methodName);
  if (!method || !method.is_card) return purchaseDateStr;

  const [year, month, day] = purchaseDateStr.split('-').map(Number);
  const cutoffRow = db.prepare(
    'SELECT cutoff_day FROM cutoff_dates WHERE payment_method_id = ? AND year = ? AND month = ?'
  ).get(method.id, year, month);

  const cutoff = cutoffRow ? cutoffRow.cutoff_day : 25;
  return addMonths(purchaseDateStr, day <= cutoff ? 1 : 2);
}

// --- Routes ---

// GET /api/expenses?month=2026-03&payment_method=TAM&category=Lazer
router.get('/', (req, res) => {
  const { month, payment_method, category } = req.query;
  let sql = `SELECT * FROM expenses WHERE 1=1`;
  const params = [];

  if (month)          { sql += ` AND strftime('%Y-%m', due_date) = ?`;  params.push(month); }
  if (payment_method) { sql += ` AND payment_method = ?`;               params.push(payment_method); }
  if (category)       { sql += ` AND category = ?`;                     params.push(category); }

  sql += ` ORDER BY due_date ASC, group_id, installment_number`;
  res.json(db.prepare(sql).all(...params));
});

// GET /api/expenses/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST /api/expenses
router.post('/', (req, res) => {
  const {
    purchase_date,
    category,
    location,
    payment_method,
    description,
    total_amount,
    installments = 1,
  } = req.body;

  if (!purchase_date || !category || !payment_method || total_amount == null) {
    return res.status(400).json({ error: 'purchase_date, category, payment_method and total_amount are required' });
  }

  // Validate against DB
  const validMethod = db.prepare('SELECT 1 FROM payment_methods WHERE name = ?').get(payment_method);
  if (!validMethod) return res.status(400).json({ error: `Método de pagamento inválido: ${payment_method}` });

  const validCat = db.prepare('SELECT 1 FROM categories WHERE name = ?').get(category);
  if (!validCat) return res.status(400).json({ error: `Categoria inválida: ${category}` });

  if (Number(total_amount) <= 0) return res.status(400).json({ error: 'total_amount must be positive' });

  const numInstallments    = Math.max(1, parseInt(installments, 10) || 1);
  const installmentAmount  = parseFloat((total_amount / numInstallments).toFixed(2));
  const group_id           = randomUUID();
  const firstDueDate       = computeFirstDueDate(purchase_date, payment_method);

  const insert = db.prepare(`
    INSERT INTO expenses
      (group_id, purchase_date, due_date, category, location, payment_method,
       description, total_amount, installments, installment_number, installment_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < numInstallments; i++) {
    insert.run(
      group_id, purchase_date, addMonths(firstDueDate, i),
      category, location || null, payment_method, description || null,
      parseFloat(total_amount), numInstallments, i + 1, installmentAmount
    );
  }

  const created = db.prepare(
    'SELECT * FROM expenses WHERE group_id = ? ORDER BY installment_number'
  ).all(group_id);

  res.status(201).json(created);
});

// DELETE /api/expenses/group/:group_id
router.delete('/group/:group_id', (req, res) => {
  const info = db.prepare('DELETE FROM expenses WHERE group_id = ?').run(req.params.group_id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: info.changes });
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: info.changes });
});

module.exports = router;
