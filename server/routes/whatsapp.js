const express      = require('express');
const twilio       = require('twilio');
const { db }       = require('../database');
const waDb         = require('../database/whatsapp');
const { sendWhatsApp, downloadMedia } = require('../services/twilio');
const { parse }    = require('../services/parser');
const { transcribe } = require('../services/assemblyai');
const { processNFe } = require('../services/nf');
const whatsappAuth = require('../middleware/whatsapp-auth');

const router = express.Router();

// Twilio expects application/x-www-form-urlencoded
router.use(express.urlencoded({ extended: false }));

// ─── Signature validation ──────────────────────────────────────────────────────
function validateTwilioSignature(req, res, next) {
  // Skip in development if no base URL is configured
  if (!process.env.TWILIO_WEBHOOK_BASE_URL) {
    console.warn('[whatsapp] TWILIO_WEBHOOK_BASE_URL not set — skipping signature validation');
    return next();
  }

  const url       = `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/whatsapp`;
  const signature = req.headers['x-twilio-signature'] || '';
  const valid     = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body
  );

  if (!valid) return res.status(403).send('Forbidden');
  next();
}

// ─── Currency formatter ────────────────────────────────────────────────────────
function fmtBRL(n) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Date formatter ────────────────────────────────────────────────────────────
function fmtDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Save confirmed expense ────────────────────────────────────────────────────
function saveExpense(userId, data) {
  const { amount, location, category, date, type, paymentMethod = 'Dinheiro' } = data;
  const signedAmount = type === 'receita' ? Math.abs(amount) : -Math.abs(amount);
  const groupId      = `wa-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  db.prepare(`
    INSERT INTO expenses
      (group_id, purchase_date, due_date, category, location, payment_method,
       total_amount, installments, installment_number, installment_amount, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
  `).run(groupId, date, date, category, location, paymentMethod,
         signedAmount, signedAmount, userId);
}

// ─── Monthly balance query ─────────────────────────────────────────────────────
function getMonthBalance(userId) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const start = `${year}-${month}-01`;
  const end   = `${year}-${month}-31`;

  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN installment_amount > 0 THEN installment_amount ELSE 0 END), 0) AS receitas,
      COALESCE(SUM(CASE WHEN installment_amount < 0 THEN ABS(installment_amount) ELSE 0 END), 0) AS despesas
    FROM expenses
    WHERE user_id = ? AND purchase_date BETWEEN ? AND ?
  `).get(userId, start, end);

  return row;
}

// ─── Category summary query ────────────────────────────────────────────────────
function getCategorySummary(userId) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const start = `${year}-${month}-01`;
  const end   = `${year}-${month}-31`;

  return db.prepare(`
    SELECT category, SUM(ABS(installment_amount)) AS total
    FROM expenses
    WHERE user_id = ? AND purchase_date BETWEEN ? AND ? AND installment_amount < 0
    GROUP BY category
    ORDER BY total DESC
    LIMIT 8
  `).all(userId, start, end);
}

// ─── Confirmation message builder ──────────────────────────────────────────────
function buildConfirmationMessage(parsed) {
  const emoji = parsed.type === 'receita' ? '💰' : '💸';
  const tipo  = parsed.type === 'receita' ? 'Receita' : 'Despesa';
  const valor = parsed.amount ? fmtBRL(parsed.amount) : '❓ (não detectado)';

  return (
    `${emoji} *${tipo} detectada!*\n\n` +
    `📍 *Local:* ${parsed.location}\n` +
    `💵 *Valor:* ${valor}\n` +
    `📂 *Categoria:* ${parsed.category}\n` +
    `📅 *Data:* ${fmtDate(parsed.date)}\n` +
    `💳 *Método:* Dinheiro\n\n` +
    `Responda *sim* para confirmar ou *não* para cancelar.`
  );
}

// ─── Command handlers ──────────────────────────────────────────────────────────
async function handleVincular(phone, args) {
  const code = args.trim();
  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    return sendWhatsApp(phone,
      '⚠️ Código inválido. Use: `/vincular 123456`\n\nO código é gerado na seção *Perfil* do NovoFin e tem 6 dígitos.');
  }

  const user = waDb.linkUser(phone, code);
  if (!user) {
    return sendWhatsApp(phone,
      '❌ Código inválido ou expirado.\n\nGere um novo código em *Perfil → Vincular WhatsApp* no NovoFin.');
  }

  return sendWhatsApp(phone,
    `✅ *Conta vinculada com sucesso!*\n\nOlá, *${user.username}*! Agora você pode gerenciar suas finanças por aqui.\n\nDigite */ajuda* para ver os comandos disponíveis.`);
}

async function handleSaldo(userId, phone) {
  const bal = getMonthBalance(userId);
  const net = bal.receitas - bal.despesas;
  const now = new Date();
  const mes = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  return sendWhatsApp(phone,
    `📊 *Saldo — ${mes}*\n\n` +
    `💰 Receitas: ${fmtBRL(bal.receitas)}\n` +
    `💸 Despesas: ${fmtBRL(bal.despesas)}\n` +
    `─────────────────\n` +
    `${net >= 0 ? '✅' : '⚠️'} *Saldo: ${fmtBRL(net)}*`);
}

async function handleResumo(userId, phone) {
  const cats  = getCategorySummary(userId);
  const now   = new Date();
  const mes   = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  if (!cats.length) {
    return sendWhatsApp(phone, `📋 Nenhum gasto registrado em ${mes}.`);
  }

  const lines = cats.map((c, i) => `${i + 1}. ${c.category}: ${fmtBRL(c.total)}`);
  return sendWhatsApp(phone,
    `📋 *Resumo por categoria — ${mes}*\n\n${lines.join('\n')}`);
}

async function handleAjuda(phone) {
  return sendWhatsApp(phone,
    `🤖 *NovoFin Bot — Ajuda*\n\n` +
    `*Comandos disponíveis:*\n` +
    `📌 /vincular CODIGO — Vincula seu número ao NovoFin\n` +
    `💰 /saldo — Saldo do mês atual\n` +
    `📋 /resumo — Gastos por categoria\n` +
    `❓ /ajuda — Esta mensagem\n\n` +
    `*Registrar gastos:*\n` +
    `Envie uma mensagem de texto descrevendo o gasto:\n` +
    `_"paguei 45 reais no mercado hoje"_\n\n` +
    `*Áudio:*\n` +
    `Envie um áudio descrevendo o gasto — será transcrito automaticamente.\n\n` +
    `*Nota Fiscal:*\n` +
    `Envie uma foto do QR code da nota fiscal para extrair os dados automaticamente.`);
}

// ─── Text message handler ──────────────────────────────────────────────────────
async function handleText(body, phone, userId) {
  const lower = body.toLowerCase().trim();

  // Commands
  if (lower.startsWith('/vincular')) return handleVincular(phone, body.slice(9).trim());
  if (lower === '/saldo')  return handleSaldo(userId, phone);
  if (lower === '/resumo') return handleResumo(userId, phone);
  if (lower === '/ajuda')  return handleAjuda(phone);

  // Confirmation of pending transaction
  const pending = waDb.getPendingSession(phone);
  if (pending) {
    if (['sim', 's', 'yes', 'y', 'confirmar', '1'].includes(lower)) {
      saveExpense(userId, pending);
      waDb.clearSession(phone);
      return sendWhatsApp(phone, `✅ *Lançamento registrado!*\n\n${pending.type === 'receita' ? '💰' : '💸'} ${fmtBRL(pending.amount)} em ${pending.category}`);
    }
    if (['não', 'nao', 'n', 'no', 'cancelar', '0'].includes(lower)) {
      waDb.clearSession(phone);
      return sendWhatsApp(phone, '❌ Lançamento cancelado.');
    }
  }

  // Parse as new transaction
  const parsed = parse(body);
  if (!parsed.amount) {
    return sendWhatsApp(phone,
      `🤔 Não consegui identificar um valor.\n\nTente: _"paguei 50 reais no mercado"_\n\nOu use um dos comandos — */ajuda*`);
  }

  waDb.savePendingSession(phone, parsed);
  return sendWhatsApp(phone, buildConfirmationMessage(parsed));
}

// ─── Audio handler ─────────────────────────────────────────────────────────────
async function handleAudio(mediaUrl, phone, userId) {
  await sendWhatsApp(phone, '🎙️ Transcrevendo seu áudio...');
  try {
    const buffer = await downloadMedia(mediaUrl);
    const text   = await transcribe(buffer);
    await sendWhatsApp(phone, `📝 *Transcrição:* "${text}"`);

    const parsed = parse(text);
    if (!parsed.amount) {
      return sendWhatsApp(phone, '🤔 Não identifiquei um valor no áudio. Tente novamente ou envie uma mensagem de texto.');
    }

    waDb.savePendingSession(phone, parsed);
    return sendWhatsApp(phone, buildConfirmationMessage(parsed));
  } catch (err) {
    console.error('[whatsapp] audio error:', err);
    return sendWhatsApp(phone, '❌ Erro ao processar o áudio. Tente novamente ou envie uma mensagem de texto.');
  }
}

// ─── Image handler ─────────────────────────────────────────────────────────────
async function handleImage(mediaUrl, phone, userId) {
  await sendWhatsApp(phone, '🔍 Lendo a nota fiscal...');
  try {
    const buffer = await downloadMedia(mediaUrl);
    const nfe    = await processNFe(buffer);

    if (!nfe.valor && !nfe.estabelecimento) {
      return sendWhatsApp(phone,
        `📄 QR code lido!\n\nChave: \`${nfe.chave}\`\n\nNão foi possível obter os detalhes automaticamente. Envie o valor manualmente.`);
    }

    const parsed = {
      amount:   nfe.valor,
      location: nfe.estabelecimento || 'Nota Fiscal',
      category: 'Compras',
      date:     new Date().toISOString().split('T')[0],
      type:     'despesa',
    };

    waDb.savePendingSession(phone, parsed);
    return sendWhatsApp(phone, buildConfirmationMessage(parsed));
  } catch (err) {
    console.error('[whatsapp] image error:', err);
    return sendWhatsApp(phone, '❌ Não consegui ler o QR code. Certifique-se de que a foto está nítida e o QR code está visível.');
  }
}

// ─── Main webhook ──────────────────────────────────────────────────────────────
router.post('/',
  validateTwilioSignature,
  whatsappAuth,
  async (req, res) => {
    // Respond 200 immediately so Twilio doesn't retry
    res.sendStatus(200);

    const phone    = req.waPhone;
    const userId   = req.waUser?.id;
    const body     = (req.body.Body || '').trim();
    const numMedia = parseInt(req.body.NumMedia || '0', 10);

    try {
      if (numMedia > 0) {
        const contentType = (req.body.MediaContentType0 || '').toLowerCase();
        const mediaUrl    = req.body.MediaUrl0;

        if (contentType.startsWith('audio/')) {
          await handleAudio(mediaUrl, phone, userId);
        } else if (contentType.startsWith('image/')) {
          await handleImage(mediaUrl, phone, userId);
        } else {
          await sendWhatsApp(phone, '📎 Tipo de arquivo não suportado. Envie texto, áudio ou uma foto de nota fiscal.');
        }
      } else {
        await handleText(body, phone, userId);
      }
    } catch (err) {
      console.error('[whatsapp] unhandled error:', err);
      sendWhatsApp(phone, '⚠️ Ocorreu um erro inesperado. Tente novamente.').catch(console.error);
    }
  }
);

module.exports = router;
