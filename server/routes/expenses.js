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

// POST /api/expenses — amounts are stored as negative (expense convention)
router.post('/', (req, res) => {
  const {
    purchase_date,
    category,
    subcategory,
    location,
    payment_method,
    description,
    total_amount,
    installments = 1,
  } = req.body;

  if (!purchase_date || !category || !payment_method || total_amount == null) {
    return res.status(400).json({ error: 'purchase_date, category, payment_method and total_amount are required' });
  }

  const validMethod = db.prepare('SELECT 1 FROM payment_methods WHERE name = ?').get(payment_method);
  if (!validMethod) return res.status(400).json({ error: `Método de pagamento inválido: ${payment_method}` });

  const validCat = db.prepare('SELECT 1 FROM categories WHERE name = ?').get(category);
  if (!validCat) return res.status(400).json({ error: `Categoria inválida: ${category}` });

  if (Number(total_amount) === 0) return res.status(400).json({ error: 'total_amount cannot be zero' });

  // Expenses entered from the form are positive; store as negative
  const finalAmount = -Math.abs(parseFloat(total_amount));
  const numInstallments   = Math.max(1, parseInt(installments, 10) || 1);
  const installmentAmount = parseFloat((finalAmount / numInstallments).toFixed(2));
  const group_id          = randomUUID();
  const firstDueDate      = computeFirstDueDate(purchase_date, payment_method);

  const insert = db.prepare(`
    INSERT INTO expenses
      (group_id, purchase_date, due_date, category, subcategory, location, payment_method,
       description, total_amount, installments, installment_number, installment_amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < numInstallments; i++) {
    insert.run(
      group_id, purchase_date, addMonths(firstDueDate, i),
      category, subcategory || null, location || null, payment_method, description || null,
      finalAmount, numInstallments, i + 1, installmentAmount
    );
  }

  const created = db.prepare(
    'SELECT * FROM expenses WHERE group_id = ? ORDER BY installment_number'
  ).all(group_id);

  res.status(201).json(created);
});

// PATCH /api/expenses/group/:group_id – update all installments, recalculate due_dates
router.patch('/group/:group_id', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM expenses WHERE group_id = ? ORDER BY installment_number'
  ).all(req.params.group_id);

  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const first = rows[0];
  const merged = {
    purchase_date:  req.body.purchase_date  ?? first.purchase_date,
    category:       req.body.category       ?? first.category,
    subcategory:    req.body.subcategory !== undefined ? (req.body.subcategory || null) : first.subcategory,
    location:       req.body.location !== undefined ? (req.body.location || null) : first.location,
    payment_method: req.body.payment_method ?? first.payment_method,
    description:    req.body.description !== undefined ? (req.body.description || null) : first.description,
    total_amount:   req.body.total_amount != null ? parseFloat(req.body.total_amount) : first.total_amount,
  };

  const validCat = db.prepare('SELECT 1 FROM categories WHERE name = ?').get(merged.category);
  if (!validCat) return res.status(400).json({ error: `Categoria inválida: ${merged.category}` });

  const validMethod = db.prepare('SELECT 1 FROM payment_methods WHERE name = ?').get(merged.payment_method);
  if (!validMethod) return res.status(400).json({ error: `Método inválido: ${merged.payment_method}` });

  const installmentAmount = parseFloat((merged.total_amount / rows.length).toFixed(2));
  const firstDueDate = computeFirstDueDate(merged.purchase_date, merged.payment_method);

  const update = db.prepare(`
    UPDATE expenses
    SET purchase_date = ?, due_date = ?, category = ?, subcategory = ?, location = ?,
        payment_method = ?, description = ?, total_amount = ?, installment_amount = ?
    WHERE id = ?
  `);

  for (let i = 0; i < rows.length; i++) {
    update.run(
      merged.purchase_date,
      addMonths(firstDueDate, i),
      merged.category,
      merged.subcategory,
      merged.location,
      merged.payment_method,
      merged.description,
      merged.total_amount,
      installmentAmount,
      rows[i].id
    );
  }

  const updated = db.prepare(
    'SELECT * FROM expenses WHERE group_id = ? ORDER BY installment_number'
  ).all(req.params.group_id);

  res.json(updated);
});

// PATCH /api/expenses/:id  – update a single row
router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const merged = {
    purchase_date:      req.body.purchase_date      ?? existing.purchase_date,
    category:           req.body.category           ?? existing.category,
    subcategory:        req.body.subcategory !== undefined ? (req.body.subcategory || null) : existing.subcategory,
    location:           req.body.location           !== undefined ? (req.body.location || null) : existing.location,
    payment_method:     req.body.payment_method     ?? existing.payment_method,
    description:        req.body.description        !== undefined ? (req.body.description || null) : existing.description,
    installment_amount: req.body.installment_amount != null ? parseFloat(req.body.installment_amount) : existing.installment_amount,
  };

  const validCat = db.prepare('SELECT 1 FROM categories WHERE name = ?').get(merged.category);
  if (!validCat) return res.status(400).json({ error: `Categoria inválida: ${merged.category}` });

  const validMethod = db.prepare('SELECT 1 FROM payment_methods WHERE name = ?').get(merged.payment_method);
  if (!validMethod) return res.status(400).json({ error: `Método inválido: ${merged.payment_method}` });

  db.prepare(`
    UPDATE expenses
    SET purchase_date = ?, category = ?, subcategory = ?, location = ?,
        payment_method = ?, description = ?, installment_amount = ?
    WHERE id = ?
  `).run(
    merged.purchase_date, merged.category, merged.subcategory, merged.location,
    merged.payment_method, merged.description, merged.installment_amount,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id));
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
