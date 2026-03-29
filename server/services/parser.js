const { db } = require('../database');

// ─── Category keyword map ──────────────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
  'Alimentação':   ['restaurante','lanche','almoço','jantar','café','cafeteria','comida',
                    'ifood','rappi','delivery','pizza','hambúrguer','hamburguer','sushi',
                    'padaria','sorveteria','bar','boteco','churrasco','feira','hortifruti'],
  'Transporte':   ['uber','taxi','táxi','99','indriver','gasolina','combustível','etanol',
                    'estacionamento','pedágio','ônibus','metro','metrô','passagem','bilhete',
                    'bpk','posto','shell','ipiranga'],
  'Compras':      ['mercado','supermercado','farmácia','remédio','roupa','sapato','tênis',
                    'loja','shopping','amazon','americanas','magazine','casas bahia',
                    'extra','atacadão','assaí','carrefour','hiper'],
  'Saúde':        ['médico','consulta','exame','hospital','clínica','dentista','psicólogo',
                    'academia','plano de saúde','unimed','amil','bradesco saúde','fisio'],
  'Lazer':        ['cinema','teatro','show','ingresso','netflix','spotify','disney',
                    'clube','passeio','viagem','hotel','pousada','airbnb','booking'],
  'Contas':       ['luz','energia','água','gás','internet','telefone','celular','tim',
                    'claro','vivo','oi','aluguel','condomínio','iptu','ipva'],
  'Educação':     ['curso','livro','escola','faculdade','mensalidade','aula','udemy',
                    'coursera','senai','senac','clt'],
  'Cuidados Pessoais': ['salão','cabeleireiro','barbearia','manicure','spa','estética'],
  'Banco':        ['tarifa','iof','juros','anuidade','seguro'],
  'Salário':      ['salário','salario','pagamento recebido','freela','freelance','honorário'],
  'Outras Rendas':['aluguel recebido','dividendo','rendimento','cashback','reembolso'],
};

const INCOME_CATEGORIES = new Set(['Salário', 'Outras Rendas']);

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function parseAmount(text) {
  const patterns = [
    /R\$\s*([\d.,]+)/i,
    /([\d]+(?:[.,]\d{1,2})?)\s*reais/i,
    /valor\s+(?:de\s+)?R?\$?\s*([\d.,]+)/i,
    /([\d]+(?:[.,]\d{2})?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      // Handle both comma and dot as decimal separators
      let raw = m[1].replace(/\./g, '').replace(',', '.');
      const val = parseFloat(raw);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function parseDate(text) {
  const today = new Date();
  const lower = text.toLowerCase();

  if (lower.includes('ontem')) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }
  if (lower.includes('hoje') || !lower.match(/\d{1,2}[\/\-]\d{1,2}/)) {
    // Check for explicit date before defaulting
  }

  // DD/MM or DD/MM/YYYY or DD-MM-YYYY
  const dm = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dm) {
    const day   = parseInt(dm[1]);
    const month = parseInt(dm[2]) - 1;
    const year  = dm[3]
      ? (dm[3].length === 2 ? 2000 + parseInt(dm[3]) : parseInt(dm[3]))
      : today.getFullYear();
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return formatDate(d);
  }

  return formatDate(today);
}

function suggestCategory(text) {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return cat;
    }
  }
  return 'Compras';
}

function detectType(text, category) {
  if (INCOME_CATEGORIES.has(category)) return 'receita';
  const incomeWords = ['recebi','receita','renda','entrada','salário recebido'];
  const lower = text.toLowerCase();
  if (incomeWords.some(w => lower.includes(w))) return 'receita';
  return 'despesa';
}

function parseInstallments(text) {
  console.log('[parser] parseInstallments input:', JSON.stringify(text));
  const patterns = [
    /\bem\s+(\d+)\s+vezes\b/i,
    /\bparcelado\s+em\s+(\d+)\b/i,
    /\b(\d+)\s*x\b/i,
    /\b(\d+)\s+vezes\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 1 && n <= 72) return n;
    }
  }
  return 1;
}

function getCreditCardMethod() {
  try {
    const row = db.prepare(
      'SELECT name FROM payment_methods WHERE is_card = 1 ORDER BY id ASC LIMIT 1'
    ).get();
    console.log('[parser] getCreditCardMethod query result:', row);
    return row?.name || null;
  } catch (err) {
    console.log('[parser] getCreditCardMethod error:', err.message);
    return null;
  }
}

function extractLocation(text) {
  let clean = text
    // Remove installment patterns before anything else
    .replace(/\bparcelado\s+em\s+\d+\b/gi, '')
    .replace(/\bem\s+\d+\s*(?:vezes|x)\b/gi, '')
    .replace(/\b\d+\s*x\b/gi, '')
    .replace(/\b\d+\s+vezes\b/gi, '')
    // Remove amounts (R$, "reais")
    .replace(/R\$\s*[\d.,]+/gi, '')
    .replace(/[\d]+(?:[.,]\d{1,2})?\s*reais/gi, '')
    // Remove dates
    .replace(/\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?/g, '')
    // Remove filler/action/connector words including price connectors
    .replace(/\b(hoje|ontem|paguei|gastei|comprei|recebi|fiz|no|na|em|de|do|da|um|uma|os|as|por|vezes|reais|valor)\b/gi, '')
    // Remove any remaining bare numbers
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(/\s+/).filter(w => w.length > 1);
  const location = words.slice(0, 4).join(' ');
  return location || 'Sem identificação';
}

// ─── Main parse function ───────────────────────────────────────────────────────
/**
 * Parses a Portuguese text message and extracts financial transaction data.
 * @param {string} text
 * @returns {{ amount: number|null, location: string, category: string, date: string, type: 'despesa'|'receita', installments: number, paymentMethod: string }}
 */
function parse(text) {
  const amount       = parseAmount(text);
  const date         = parseDate(text);
  const category     = suggestCategory(text);
  const type         = detectType(text, category);
  const location     = extractLocation(text);
  const installments = parseInstallments(text);

  let paymentMethod = 'Dinheiro';
  if (installments > 1) {
    const card = getCreditCardMethod();
    if (card) {
      paymentMethod = card;
    } else {
      console.warn('[parser] parcelamento detectado mas nenhum cartão de crédito encontrado — usando Dinheiro');
    }
  }

  console.log('[parser] installments:', installments, '| paymentMethod:', paymentMethod);
  return { amount, location, category, date, type, installments, paymentMethod };
}

module.exports = { parse };
