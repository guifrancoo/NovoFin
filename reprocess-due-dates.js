#!/usr/bin/env node
/**
 * reprocess-due-dates.js
 * Reprocessa o due_date de todos os lançamentos do banco local
 * usando a regra correta de data de corte:
 *
 *   - Cartão, dia <= corte → fatura do mesmo mês da compra  + (parcela-1) meses
 *   - Cartão, dia  > corte → fatura do mês seguinte da compra + (parcela-1) meses
 *   - Dinheiro             → due_date = purchase_date (sem alteração)
 *
 * Uso:
 *   node --experimental-sqlite reprocess-due-dates.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'server', 'financeiro.db');

if (!fs.existsSync(DB_PATH)) {
  console.error('Banco não encontrado em:', DB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);

// ─── helpers ────────────────────────────────────────────────────────────────

function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1 + n, d);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

// Retorna o due_date da 1ª parcela dado purchase_date e o cartão (método + cutoffs map)
function firstDueDate(purchaseDateStr, methodId, cutoffsMap) {
  const [year, month, day] = purchaseDateStr.split('-').map(Number);
  const key = `${methodId}:${year}:${month}`;
  const cutoff = cutoffsMap.has(key) ? cutoffsMap.get(key) : 25;
  return addMonths(purchaseDateStr, day <= cutoff ? 0 : 1);
}

// ─── carrega dados base ──────────────────────────────────────────────────────

// Mapa id → { name, is_card }
const methods = new Map(
  db.prepare('SELECT id, name, is_card FROM payment_methods').all()
    .map(r => [r.id, r])
);

// Mapa "method_id:year:month" → cutoff_day
const cutoffsMap = new Map(
  db.prepare('SELECT payment_method_id, year, month, cutoff_day FROM cutoff_dates').all()
    .map(r => [`${r.payment_method_id}:${r.year}:${r.month}`, r.cutoff_day])
);

// Todos os expenses ordenados por group_id e parcela
const expenses = db.prepare(
  'SELECT id, group_id, purchase_date, due_date, payment_method, installment_number FROM expenses ORDER BY group_id, installment_number'
).all();

console.log(`Total de lançamentos: ${expenses.length}`);
console.log(`Cartões cadastrados:  ${[...methods.values()].filter(m => m.is_card).map(m => m.name).join(', ')}`);
console.log(`Datas de corte:       ${cutoffsMap.size} entradas`);
console.log('');

// ─── reprocessa ─────────────────────────────────────────────────────────────

const updateStmt = db.prepare('UPDATE expenses SET due_date = ? WHERE id = ?');

let updated = 0;
let skipped = 0;
let byMethod = {};

// Agrupa por group_id para calcular a 1ª parcela uma só vez por grupo
const groups = new Map();
for (const e of expenses) {
  if (!groups.has(e.group_id)) groups.set(e.group_id, []);
  groups.get(e.group_id).push(e);
}

db.exec('BEGIN TRANSACTION');
try {
  for (const [, rows] of groups) {
    const first = rows[0];
    const method = [...methods.values()].find(m => m.name === first.payment_method);

    // Dinheiro ou método desconhecido: due_date = purchase_date
    const base = (!method || !method.is_card)
      ? first.purchase_date
      : firstDueDate(first.purchase_date, method.id, cutoffsMap);

    for (const row of rows) {
      // Parcela i (0-indexed) → base + i meses
      const newDue = addMonths(base, row.installment_number - 1);

      if (newDue === row.due_date) {
        skipped++;
        continue;
      }

      updateStmt.run(newDue, row.id);
      updated++;

      byMethod[first.payment_method] = (byMethod[first.payment_method] || 0) + 1;
    }
  }

  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Erro durante reprocessamento — ROLLBACK aplicado:', err.message);
  db.close();
  process.exit(1);
}

db.close();

// ─── relatório ───────────────────────────────────────────────────────────────

console.log(`Atualizados: ${updated}`);
console.log(`Sem mudança: ${skipped}`);
if (updated > 0) {
  console.log('Por método de pagamento:');
  for (const [name, count] of Object.entries(byMethod)) {
    console.log(`  ${name}: ${count}`);
  }
}
console.log('');
console.log('Pronto! Execute agora para enviar ao Railway:');
console.log('  node --experimental-sqlite export-data.js');
console.log('  node import-data.js <URL_DO_RAILWAY> <ADMIN_KEY>');
