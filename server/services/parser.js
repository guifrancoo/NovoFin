const { db } = require('../database');

// ─── Category keyword map ──────────────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
  'Alimentação':   ['restaurante','lanche','almoço','jantar','café','cafeteria','comida',
                    'ifood','rappi','delivery','pizza','hambúrguer','hamburguer','sushi',
                    'padaria','sorveteria','bar','boteco','churrasco','feira','hortifruti',
                    'mercadinho','quitanda','açougue','peixaria','mercearia'],
  'Transporte':   ['uber','taxi','táxi','99','indriver','gasolina','combustível','etanol',
                    'estacionamento','pedágio','ônibus','metro','metrô','passagem','bilhete',
                    'bpk','posto','shell','ipiranga','revisão','oficina','mecânico','pneu',
                    'lavagem','autopeças','detran','multa','seguro auto','renavam'],
  'Compras':      ['mercado','supermercado','roupa','sapato','tênis',
                    'loja','shopping','amazon','americanas','magazine','casas bahia',
                    'extra','atacadão','assaí','carrefour','hiper'],
  'Saúde':        ['médico','consulta','exame','hospital','clínica','dentista','psicólogo',
                    'academia','plano de saúde','unimed','amil','bradesco saúde','fisio',
                    'farmácia','drogaria','droga','ultrafarma','pacheco','panvel','remédio'],
  'Lazer':        ['cinema','teatro','show','ingresso','netflix','spotify','disney',
                    'clube','passeio','viagem','hotel','pousada','airbnb','booking',
                    'jogo','steam','playstation','xbox','nintendo','game','livro','kindle'],
  'Contas':       ['luz','energia','gás','internet','telefone','celular','tim',
                    'claro','vivo','oi','aluguel','condomínio','iptu','ipva',
                    'água','conta de água','saneamento','caesb','sabesp','embasa'],
  'Educação':     ['curso','escola','faculdade','mensalidade','aula','udemy',
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

function getAllCreditCards(userId) {
  try {
    console.log('[parser] getAllCreditCards userId:', userId);
    const cards = db.prepare(
      'SELECT id, name FROM payment_methods WHERE is_card = 1 ORDER BY id ASC'
    ).all();
    console.log('[parser] cards found:', JSON.stringify(cards));
    return cards;
  } catch (err) {
    console.log('[parser] getAllCreditCards error:', err.message);
    return [];
  }
}

function detectExplicitPaymentMethod(text) {
  const lower = text.toLowerCase();

  // Cash keywords
  if (/\b(dinheiro|espécie|especie|pix|à vista|a vista)\b/.test(lower)) return 'Dinheiro';

  // Card name keywords — fetch from DB to match registered cards
  try {
    const cards = db.prepare('SELECT name FROM payment_methods WHERE is_card = 1').all();
    for (const card of cards) {
      if (lower.includes(card.name.toLowerCase())) return card.name;
    }
  } catch (_) {}

  // Generic card keywords — will still need selection if multiple cards
  if (/\b(cartão|cartao|crédito|credito|débito|debito)\b/.test(lower)) return '__CARD__';

  return null;
}

function detectInternational(text) {
  const lower = text.toLowerCase();
  const intlKeywords = [
    'dólar', 'dollar', 'usd', 'euro', 'eur', 'libra', 'gbp',
    'internacional', 'international', 'importado', 'exterior',
    'amazon.com', 'aliexpress', 'ebay', 'shein', 'shopee internacional',
    'steamgames', 'steam store', 'apple.com', 'google play',
    'netflix.com', 'spotify.com', 'adobe', 'microsoft',
  ];
  return intlKeywords.some(kw => lower.includes(kw));
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
    // Remove installment words not caught by the pattern above
    .replace(/\bparcelado\b/gi, '')
    .replace(/\bparcela(?:s|do|da|mento)?\b/gi, '')
    // Remove filler/action/connector words including price connectors
    .replace(/\b(hoje|ontem|paguei|gastei|comprei|recebi|fiz|no|na|em|de|do|da|um|uma|os|as|por|vezes|vez|reais|valor|parcelado|parcelada|parcela|parcelamento)\b/gi, '')
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
 * @param {number|null} userId
 * @returns {{ amount: number|null, location: string, category: string, date: string, type: 'despesa'|'receita', installments: number, paymentMethod: string, needsCardSelection: boolean, availableCards: Array, isInternational: boolean }}
 */
function parse(text, userId = null) {
  const amount       = parseAmount(text);
  const date         = parseDate(text);
  const category     = suggestCategory(text);
  const type         = detectType(text, category);
  const location     = extractLocation(text);
  const installments = parseInstallments(text);
  const isInternational = detectInternational(text);
  const explicitMethod  = detectExplicitPaymentMethod(text);

  let paymentMethod = null;
  let needsCardSelection = false;
  let availableCards = [];

  if (explicitMethod && explicitMethod !== '__CARD__') {
    paymentMethod = explicitMethod;
    needsCardSelection = false;
  } else if (installments > 1 || explicitMethod === '__CARD__') {
    // Parcelado or generic "cartão" mention — need to select card
    availableCards = getAllCreditCards(userId);
    if (availableCards.length === 1) {
      paymentMethod = availableCards[0].name;
    } else if (availableCards.length > 1) {
      paymentMethod = availableCards[0].name;
      needsCardSelection = true;
    }
    // else: no cards found — paymentMethod stays null, handled via default in whatsapp.js
  } else {
    // No explicit method, no installments — will use default (handled in whatsapp.js)
    paymentMethod = null;
  }

  console.log('[parser] installments:', installments, '| paymentMethod:', paymentMethod, '| needsCardSelection:', needsCardSelection);
  return { amount, location, category, date, type, installments, paymentMethod, needsCardSelection, availableCards, isInternational, explicitMethod };
}

module.exports = { parse };
