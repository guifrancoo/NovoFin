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
  const uf  = userFilter(req);
  const uid = req.user.id;
  const CE  = `(SELECT name FROM categories WHERE exclude_from_reports = 1 AND (user_id = ? OR user_id IS NULL))`;

  // Receita e despesa do período
  const totalRow = db.prepare(`
    SELECT
      ROUND(COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0), 2) AS income,
      ROUND(COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0), 2) AS expense
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND category NOT IN ${CE}
      ${uf.sql}
  `).get(startDate, endDate, uid, ...uf.params);

  // Saldo de caixa acumulado até o final do período
  const accRow = db.prepare(`
    SELECT ROUND(COALESCE(SUM(installment_amount), 0), 2) AS net_accumulated
    FROM expenses
    WHERE payment_method = 'Dinheiro'
      AND purchase_date <= ?
      ${uf.sql}
  `).get(endDate, ...uf.params);

  const byMethod = db.prepare(`
    SELECT payment_method,
      ROUND(COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0), 2) AS income,
      ROUND(COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0), 2) AS expense
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND category NOT IN ${CE}
      ${uf.sql}
    GROUP BY payment_method
    ORDER BY expense DESC
  `).all(startDate, endDate, uid, ...uf.params);

  const byCategory = db.prepare(`
    SELECT category,
           ROUND(COALESCE(SUM(installment_amount), 0), 2) AS total
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND category NOT IN ${CE}
      ${uf.sql}
    GROUP BY category
    ORDER BY total ASC
  `).all(startDate, endDate, uid, ...uf.params);

  const bySubcategory = db.prepare(`
    SELECT category, subcategory,
           ROUND(COALESCE(SUM(installment_amount), 0), 2) AS total
    FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      AND subcategory IS NOT NULL AND subcategory != ''
      AND category NOT IN ${CE}
      ${uf.sql}
    GROUP BY category, subcategory
    ORDER BY category, total ASC
  `).all(startDate, endDate, uid, ...uf.params);

  const recent = db.prepare(`
    SELECT * FROM expenses
    WHERE purchase_date BETWEEN ? AND ?
      ${uf.sql}
    GROUP BY COALESCE(group_id, CAST(id AS TEXT))
    ORDER BY purchase_date DESC, created_at DESC
  `).all(startDate, endDate, ...uf.params);

  // Evolução mensal:
  //   - modo período  → mostra os meses do intervalo selecionado
  //   - modo mês único → mantém contexto dos 5 meses anteriores
  let evolution;
  if (isRange) {
    evolution = db.prepare(`
      SELECT strftime('%Y-%m', purchase_date) AS month,
             ROUND(COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0), 2) AS income,
             ROUND(COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0), 2) AS expense
      FROM expenses
      WHERE purchase_date BETWEEN ? AND ?
        AND category NOT IN ${CE}
        ${uf.sql}
      GROUP BY month
      ORDER BY month
    `).all(startDate, endDate, uid, ...uf.params);
  } else {
    evolution = db.prepare(`
      SELECT strftime('%Y-%m', purchase_date) AS month,
             ROUND(COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0), 2) AS income,
             ROUND(COALESCE(ABS(SUM(CASE WHEN installment_amount < 0 THEN installment_amount ELSE 0 END)), 0), 2) AS expense
      FROM expenses
      WHERE purchase_date >= date(?, '-5 months', 'start of month')
        AND purchase_date <  date(?, '+1 month',  'start of month')
        AND category NOT IN ${CE}
        ${uf.sql}
      GROUP BY month
      ORDER BY month
    `).all(`${startMonth}-01`, `${startMonth}-01`, uid, ...uf.params);
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
    by_subcategory:    bySubcategory,
    recent_expenses:   recent,
    monthly_evolution: evolution,
  });
});

module.exports = router;
