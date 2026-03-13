/**
 * import-excel.js
 * Importa histórico de gastos da planilha Excel para o SQLite.
 *
 * Uso:
 *   node --no-warnings=ExperimentalWarning import-excel.js
 *   node --no-warnings=ExperimentalWarning import-excel.js --dry-run
 */

const XLSX    = require('xlsx');
const path    = require('path');
const { randomUUID } = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DRY_RUN   = process.argv.includes('--dry-run');
const XLSX_FILE = path.join(__dirname, 'Planilha de gasto-v.2024 1 (1).xlsx');
const DB_PATH   = path.join(__dirname, 'server', 'financeiro.db');

// ─── Payment method mapping ───────────────────────────────────────────────────
function mapMethod(raw) {
  const s = String(raw).trim().toUpperCase();
  if (s === 'CARTÃO TAM' || s === 'TAM' || s === 'CARTAO TAM') return 'TAM';
  if (s === 'DINHEIRO')                                          return 'Dinheiro';
  if (s.startsWith('CARTÃO') || s.startsWith('CARTAO'))         return 'Outro Cartão';
  return null; // não é pagamento reconhecível — pular
}

// Normaliza o nome da categoria: "CUIDADOS PESSOAIS" → "Cuidados Pessoais"
function normalizeCategory(raw) {
  return raw.trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function buildDate(day, month, year) {
  const d = String(Math.round(day)).padStart(2, '0');
  const m = String(Math.round(month)).padStart(2, '0');
  const y = String(Math.round(year));
  if (!d || !m || !y || y.length !== 4) return null;
  const iso = `${y}-${m}-${d}`;
  if (isNaN(Date.parse(iso))) return null;
  return iso;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const MONTH_SHEET = /^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\d{2}$/;

console.log('Lendo planilha:', XLSX_FILE);
const wb = XLSX.readFile(XLSX_FILE);

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");
// Ensure subcategory column exists (migration)
try { db.exec('ALTER TABLE expenses ADD COLUMN subcategory TEXT'); } catch (_) {}

// Cache de categorias e métodos para evitar queries repetidas
const knownCategories = new Set(
  db.prepare('SELECT name FROM categories').all().map((r) => r.name)
);
const knownMethods = new Set(
  db.prepare('SELECT name FROM payment_methods').all().map((r) => r.name)
);

function ensureCategory(name) {
  if (knownCategories.has(name)) return;
  db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(name);
  knownCategories.add(name);
}

function ensureMethod(name, isCard) {
  if (knownMethods.has(name)) return;
  db.prepare('INSERT OR IGNORE INTO payment_methods (name, is_card) VALUES (?, ?)').run(name, isCard ? 1 : 0);
  knownMethods.add(name);
}

const insertExpense = db.prepare(`
  INSERT INTO expenses
    (group_id, purchase_date, due_date, category, subcategory, location, payment_method,
     description, total_amount, installments, installment_number, installment_amount)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const stats = { sheets: 0, imported: 0, skipped: 0, byYear: {} };
const skippedReasons = {};

function countSkip(reason) {
  skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
  stats.skipped++;
}

for (const sheetName of wb.SheetNames) {
  if (!MONTH_SHEET.test(sheetName)) continue;
  stats.sheets++;

  const ws   = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Encontra o cabeçalho dinamicamente
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].includes('CATEGORIA')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) { countSkip(`[${sheetName}] sem header`); continue; }

  let sheetImported = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];

    const day     = r[1];
    const month   = r[2];
    const year    = r[3];
    const catRaw  = String(r[17]).trim();
    const local   = String(r[18]).trim() || null;
    const methRaw = r[19];
    const valRaw  = r[20];
    const parcRaw = r[22];

    // Pula linhas em branco
    if (!day && !catRaw && !methRaw) continue;

    // Data
    const purchaseDate = buildDate(day, month, year);
    if (!purchaseDate) { countSkip('data inválida'); continue; }

    // Valor: preservar sinal original (negativo = despesa, positivo = receita). Pular apenas zero.
    const rawNum = parseFloat(valRaw);
    if (!valRaw || isNaN(rawNum) || rawNum === 0) { countSkip('valor zero'); continue; }
    const totalAmount = rawNum;

    // Categoria: não pode ser vazia nem numérica (linhas de total/subtotal)
    if (!catRaw || catRaw === '0' || !isNaN(Number(catRaw))) {
      countSkip('categoria vazia ou numérica'); continue;
    }
    const category = normalizeCategory(catRaw);

    // Método de pagamento
    const paymentMethod = mapMethod(methRaw);
    if (!paymentMethod) { countSkip('método inválido: ' + methRaw); continue; }

    // Parcelas
    const installments      = Math.max(1, Math.round(Number(parcRaw)) || 1);
    const installmentAmount = parseFloat((totalAmount / installments).toFixed(2));

    if (!DRY_RUN) {
      ensureCategory(category);
      ensureMethod(paymentMethod, paymentMethod !== 'Dinheiro');
    }

    const groupId = randomUUID();
    const year4   = purchaseDate.split('-')[0];

    for (let p = 0; p < installments; p++) {
      const dueDate = addMonths(purchaseDate, p);
      if (!DRY_RUN) {
        insertExpense.run(
          groupId, purchaseDate, dueDate,
          category, null, local, paymentMethod,
          null, totalAmount, installments, p + 1, installmentAmount
        );
      }
    }

    sheetImported++;
    stats.imported++;
    stats.byYear[year4] = (stats.byYear[year4] || 0) + 1;
  }

  if (sheetImported > 0) {
    process.stdout.write(`  ${sheetName}: ${sheetImported} lançamento(s)\n`);
  }
}

// ─── Resumo ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(DRY_RUN ? '*** DRY RUN — nada foi gravado ***' : '*** IMPORTAÇÃO CONCLUÍDA ***');
console.log(`Abas processadas : ${stats.sheets}`);
console.log(`Importados       : ${stats.imported} lançamentos`);
console.log(`Ignorados        : ${stats.skipped}`);
console.log('\nPor ano:');
for (const [yr, n] of Object.entries(stats.byYear).sort()) {
  console.log(`  ${yr}: ${n}`);
}
if (Object.keys(skippedReasons).length) {
  console.log('\nMotivos de exclusão:');
  for (const [reason, n] of Object.entries(skippedReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}x  ${reason}`);
  }
}
