const { Router } = require('express');
const { db } = require('../database');

const router = Router();

function userFilter(req) {
  return { sql: ' AND user_id = ?', params: [req.user.id] };
}

// GET /api/dashboard
//   Single-month mode : ?month=2026-03
//   Range mode        : ?start=2026-01&end=2026-03
router.get('/', (req, res) => {
  const { month, start, end } = req.query;
  const now = new Date().toISOString().slice(0, 7);

  const isRange    = start && end;
  const startMonth = isRange ? start : (month || now);
  const endMonth   = isRange ? end   : (month || now);
  const startDate  = `${startMonth}-01`;
  const endDate    = `${endMonth}-31`;
  const uf = userFilter(req);

  // Receita e despesa do período
  const totalRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
      COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
  `).get(startDate, endDate, ...uf.params);

  // Saldo de caixa acumulado até o final do período
  const accRow = db.prepare(`
    SELECT COALESCE(SUM(installment_amount), 0) AS net_accumulated
    FROM expenses
    WHERE payment_method = 'Dinheiro'
      AND purchase_date <= ?
      ${uf.sql}
  `).get(endDate, ...uf.params);

  const byMethod = db.prepare(`
    SELECT payment_method,
      COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
      COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
    GROUP BY payment_method
    ORDER BY expense DESC
  `).all(startDate, endDate, ...uf.params);

  const byCategory = db.prepare(`
    SELECT category,
           COALESCE(SUM(installment_amount), 0) AS total
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
      ${uf.sql}
    GROUP BY category
    ORDER BY total ASC
  `).all(startDate, endDate, ...uf.params);

  const recent = db.prepare(`
    SELECT * FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND installment_number = 1
      ${uf.sql}
    ORDER BY purchase_date DESC, created_at DESC
  `).all(startDate, endDate, ...uf.params);

  // Evolução mensal:
  //   - modo período  → mostra os meses do intervalo selecionado
  //   - modo mês único → mantém contexto dos 5 meses anteriores
  let evolution;
  if (isRange) {
    evolution = db.prepare(`
      SELECT strftime('%Y-%m', purchase_date) AS month,
             COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
             COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
      FROM expenses
      WHERE purchase_date BETWEEN ? AND ?
        AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
        ${uf.sql}
      GROUP BY month
      ORDER BY month
    `).all(startDate, endDate, ...uf.params);
  } else {
    evolution = db.prepare(`
      SELECT strftime('%Y-%m', purchase_date) AS month,
             COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS income,
             COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0) AS expense
      FROM expenses
      WHERE purchase_date >= date(?, '-5 months', 'start of month')
        AND purchase_date <  date(?, '+1 month',  'start of month')
        AND category NOT IN (SELECT name FROM categories WHERE exclude_from_reports = 1)
        ${uf.sql}
      GROUP BY month
      ORDER BY month
    `).all(`${startMonth}-01`, `${startMonth}-01`, ...uf.params);
  }

  res.json({
    start: startMonth,
    end:   endMonth,
    month: startMonth, // backward compat
    income:          totalRow.income,
    expense:         totalRow.expense,
    net_accumulated: accRow.net_accumulated,
    by_payment_method: byMethod,
    by_category:       byCategory,
    recent_expenses:   recent,
    monthly_evolution: evolution,
  });
});

module.exports = router;
