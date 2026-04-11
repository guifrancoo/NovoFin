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
  if (!method || !method.is_card) {
    console.log(`[due_date] ${methodName} não é cartão → due_date = purchase_date (${purchaseDateStr})`);
    return purchaseDateStr;
  }

  const [year, month, day] = purchaseDateStr.split('-').map(Number);
  const cutoffRow = db.prepare(
    'SELECT cutoff_day FROM cutoff_dates WHERE payment_method_id = ? AND year = ? AND month = ?'
  ).get(method.id, year, month);

  // Regra: compra ATÉ o corte → fatura do mesmo mês (0); APÓS o corte → fatura do mês seguinte (+1)
  const cutoff = cutoffRow ? cutoffRow.cutoff_day : 25;
  const n = day <= cutoff ? 0 : 1;
  const dueDate = addMonths(purchaseDateStr, n);

  console.log(`[due_date] purchase=${purchaseDateStr} method=${methodName}(id=${method.id}) cutoff_row=${JSON.stringify(cutoffRow)} cutoff=${cutoff} day=${day} n=${n} → due_date=${dueDate}`);

  return dueDate;
}

// Returns SQL snippet and params array for user filtering.
function userFilter(req) {
  return { sql: ' AND user_id = ?', params: [req.user.id] };
}

// --- Routes ---

// GET /api/expenses?month=2026-03&payment_method=TAM&category=Lazer
router.get('/', (req, res) => {
  const { month, payment_method, category } = req.query;
  const uf = userFilter(req);
  let sql = `SELECT * FROM expenses WHERE 1=1`;
  const params = [];

  if (month)          { sql += ` AND strftime('%Y-%m', due_date) = ?`;  params.push(month); }
  if (payment_method) { sql += ` AND payment_method = ?`;               params.push(payment_method); }
  if (category)       { sql += ` AND category = ?`;                     params.push(category); }

  sql += uf.sql;
  params.push(...uf.params);
  sql += ` ORDER BY due_date ASC, group_id, installment_number`;
  res.json(db.prepare(sql).all(...params));
});

// GET /api/expenses/date-range — min and max purchase_date months in the DB
router.get('/date-range', (req, res) => {
  const uf = userFilter(req);
  const row = db.prepare(`
    SELECT
      strftime('%Y-%m', MIN(purchase_date)) AS min_month,
      strftime('%Y-%m', MAX(purchase_date)) AS max_month
    FROM expenses
    WHERE 1=1${uf.sql}
  `).get(...uf.params);
  res.json(row || { min_month: null, max_month: null });
});

// GET /api/expenses/:id
router.get('/:id', (req, res) => {
  const uf = userFilter(req);
  const row = db.prepare(`SELECT * FROM expenses WHERE id = ?${uf.sql}`).get(req.params.id, ...uf.params);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// POST /api/expenses — despesas armazenadas como negativo, receitas como positivo
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
    type = 'despesa', // 'despesa' | 'receita'
    is_international = 0,
    recorrente = 0,
    meses_recorrencia = 1,
  } = req.body;

  if (!purchase_date || !category || !payment_method || total_amount == null) {
    return res.status(400).json({ error: 'purchase_date, category, payment_method and total_amount are required' });
  }

  const validMethod = db.prepare('SELECT 1 FROM payment_methods WHERE name = ? AND (user_id = ? OR user_id IS NULL)').get(payment_method, req.user.id);
  if (!validMethod) return res.status(400).json({ error: `Método de pagamento inválido: ${payment_method}` });

  const validCat = db.prepare('SELECT 1 FROM categories WHERE name = ? AND (user_id = ? OR user_id IS NULL)').get(category, req.user.id);
  if (!validCat) return res.status(400).json({ error: `Categoria inválida: ${category}` });

  if (Number(total_amount) === 0) return res.status(400).json({ error: 'total_amount cannot be zero' });

  // Receitas são positivas; despesas são negativas
  const isIncome = type === 'receita';
  const finalAmount = isIncome
    ? Math.abs(parseFloat(total_amount))
    : -Math.abs(parseFloat(total_amount));
  // Receitas não têm parcelas
  const numInstallments = isIncome ? 1 : Math.max(1, parseInt(installments, 10) || 1);
  const installmentAmount = parseFloat((finalAmount / numInstallments).toFixed(2));
  const group_id          = randomUUID();
  const firstDueDate      = computeFirstDueDate(purchase_date, payment_method);

  const intl = is_international ? 1 : 0;
  const recr = recorrente ? 1 : 0;

  const insert = db.prepare(`
    INSERT INTO expenses
      (group_id, purchase_date, due_date, category, subcategory, location, payment_method,
       description, total_amount, installments, installment_number, installment_amount, user_id, is_international, recorrente)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < numInstallments; i++) {
    insert.run(
      group_id, purchase_date, addMonths(firstDueDate, i),
      category, subcategory || null, location || null, payment_method, description || null,
      finalAmount, numInstallments, i + 1, installmentAmount, req.user.id, intl, recr
    );
  }

  const created = db.prepare(
    'SELECT * FROM expenses WHERE group_id = ? ORDER BY installment_number'
  ).all(group_id);

  // Recurring: create (meses_recorrencia - 1) additional independent records
  const numMeses = recr ? Math.min(36, Math.max(1, parseInt(meses_recorrencia, 10) || 1)) : 1;
  if (recr && numMeses > 1) {
    const recurInsert = db.prepare(`
      INSERT INTO expenses
        (group_id, purchase_date, due_date, category, subcategory, location, payment_method,
         description, total_amount, installments, installment_number, installment_amount, user_id, is_international, recorrente)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, 1)
    `);
    for (let m = 1; m < numMeses; m++) {
      const recurPurchaseDate = addMonths(purchase_date, m);
      const recurDueDate      = computeFirstDueDate(recurPurchaseDate, payment_method);
      recurInsert.run(
        randomUUID(), recurPurchaseDate, recurDueDate,
        category, subcategory || null, location || null, payment_method, description || null,
        finalAmount, finalAmount, req.user.id, intl
      );
    }
  }

  res.status(201).json(created);
});

// PATCH /api/expenses/group/:group_id – update all installments, recalculate due_dates
router.patch('/group/:group_id', (req, res) => {
  const uf = userFilter(req);
  const rows = db.prepare(
    `SELECT * FROM expenses WHERE group_id = ?${uf.sql} ORDER BY installment_number`
  ).all(req.params.group_id, ...uf.params);

  if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

  const first = rows[0];
  const merged = {
    purchase_date:    req.body.purchase_date  ?? first.purchase_date,
    category:         req.body.category       ?? first.category,
    subcategory:      req.body.subcategory !== undefined ? (req.body.subcategory || null) : first.subcategory,
    location:         req.body.location !== undefined ? (req.body.location || null) : first.location,
    payment_method:   req.body.payment_method ?? first.payment_method,
    description:      req.body.description !== undefined ? (req.body.description || null) : first.description,
    total_amount:     req.body.total_amount != null ? parseFloat(req.body.total_amount) : first.total_amount,
    is_international: req.body.is_international !== undefined ? (req.body.is_international ? 1 : 0) : (first.is_international ?? 0),
    recorrente:       req.body.recorrente       !== undefined ? (req.body.recorrente       ? 1 : 0) : (first.recorrente       ?? 0),
  };

  const validCat = db.prepare('SELECT 1 FROM categories WHERE name = ? AND (user_id = ? OR user_id IS NULL)').get(merged.category, req.user.id);
  if (!validCat) return res.status(400).json({ error: `Categoria inválida: ${merged.category}` });

  const validMethod = db.prepare('SELECT 1 FROM payment_methods WHERE name = ? AND (user_id = ? OR user_id IS NULL)').get(merged.payment_method, req.user.id);
  if (!validMethod) return res.status(400).json({ error: `Método inválido: ${merged.payment_method}` });

  const installmentAmount = parseFloat((merged.total_amount / rows.length).toFixed(2));
  const firstDueDate = computeFirstDueDate(merged.purchase_date, merged.payment_method);

  const update = db.prepare(`
    UPDATE expenses
    SET purchase_date = ?, due_date = ?, category = ?, subcategory = ?, location = ?,
        payment_method = ?, description = ?, total_amount = ?, installment_amount = ?, is_international = ?, recorrente = ?
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
      merged.is_international,
      merged.recorrente,
      rows[i].id
    );
  }

  const updated = db.prepare(
    'SELECT * FROM expenses WHERE group_id = ? ORDER BY installment_number'
  ).all(req.params.group_id);

  res.json(updated);
});

// PATCH /api/expenses/:id/recorrente — set recorrente for a single record only
router.patch('/:id/recorrente', (req, res) => {
  const uf = userFilter(req);
  const existing = db.prepare(`SELECT id FROM expenses WHERE id = ?${uf.sql}`).get(req.params.id, ...uf.params);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const recorrente = req.body.recorrente ? 1 : 0;
  db.prepare('UPDATE expenses SET recorrente = ? WHERE id = ?').run(recorrente, req.params.id);
  res.json({ id: Number(req.params.id), recorrente });
});

// PATCH /api/expenses/:id/check  — toggle conferência
router.patch('/:id/check', (req, res) => {
  const uf = userFilter(req);
  const existing = db.prepare(`SELECT * FROM expenses WHERE id = ?${uf.sql}`).get(req.params.id, ...uf.params);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const newChecked = req.body.is_checked !== undefined
    ? (req.body.is_checked ? 1 : 0)
    : (existing.is_checked ? 0 : 1);
  db.prepare('UPDATE expenses SET is_checked = ? WHERE id = ?').run(newChecked, req.params.id);
  res.json({ id: Number(req.params.id), is_checked: newChecked });
});

// PATCH /api/expenses/:id  – update a single row
router.patch('/:id', (req, res) => {
  const uf = userFilter(req);
  const existing = db.prepare(`SELECT * FROM expenses WHERE id = ?${uf.sql}`).get(req.params.id, ...uf.params);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const merged = {
    purchase_date:      req.body.purchase_date      ?? existing.purchase_date,
    category:           req.body.category           ?? existing.category,
    subcategory:        req.body.subcategory !== undefined ? (req.body.subcategory || null) : existing.subcategory,
    location:           req.body.location           !== undefined ? (req.body.location || null) : existing.location,
    payment_method:     req.body.payment_method     ?? existing.payment_method,
    description:        req.body.description        !== undefined ? (req.body.description || null) : existing.description,
    installment_amount: req.body.installment_amount != null ? parseFloat(req.body.installment_amount) : existing.installment_amount,
    is_international:   req.body.is_international !== undefined ? (req.body.is_international ? 1 : 0) : (existing.is_international ?? 0),
    recorrente:         req.body.recorrente       !== undefined ? (req.body.recorrente       ? 1 : 0) : (existing.recorrente       ?? 0),
  };

  const validCat = db.prepare('SELECT 1 FROM categories WHERE name = ? AND (user_id = ? OR user_id IS NULL)').get(merged.category, req.user.id);
  if (!validCat) return res.status(400).json({ error: `Categoria inválida: ${merged.category}` });

  const validMethod = db.prepare('SELECT 1 FROM payment_methods WHERE name = ? AND (user_id = ? OR user_id IS NULL)').get(merged.payment_method, req.user.id);
  if (!validMethod) return res.status(400).json({ error: `Método inválido: ${merged.payment_method}` });

  const isSingle = (existing.installments || 1) === 1;
  const newTotalAmount = isSingle ? merged.installment_amount : existing.total_amount;

  db.prepare(`
    UPDATE expenses
    SET purchase_date = ?, category = ?, subcategory = ?, location = ?,
        payment_method = ?, description = ?, installment_amount = ?, total_amount = ?, is_international = ?, recorrente = ?
    WHERE id = ?
  `).run(
    merged.purchase_date, merged.category, merged.subcategory, merged.location,
    merged.payment_method, merged.description, merged.installment_amount, newTotalAmount, merged.is_international,
    merged.recorrente, req.params.id
  );

  res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id));
});

// DELETE /api/expenses/group/:group_id
router.delete('/group/:group_id', (req, res) => {
  const uf = userFilter(req);
  const info = db.prepare(`DELETE FROM expenses WHERE group_id = ?${uf.sql}`).run(req.params.group_id, ...uf.params);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: info.changes });
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res) => {
  const uf = userFilter(req);
  const info = db.prepare(`DELETE FROM expenses WHERE id = ?${uf.sql}`).run(req.params.id, ...uf.params);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: info.changes });
});

module.exports = router;
