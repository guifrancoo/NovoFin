const express      = require('express');
const twilio       = require('twilio');
const { db }       = require('../database');
const waDb         = require('../database/whatsapp');
const { getDefaultPaymentMethod, setDefaultPaymentMethod, logBotError } = require('../database/whatsapp');
const { sendWhatsApp, downloadMedia } = require('../services/twilio');
const { parse }    = require('../services/parser');
const { transcribe } = require('../services/assemblyai');
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

// ─── Payment method list ───────────────────────────────────────────────────────
function getAllPaymentMethods() {
  return db.prepare('SELECT id, name FROM payment_methods ORDER BY is_card DESC, id ASC').all();
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
function addMonths(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, d);
  return dt.toISOString().split('T')[0];
}

function saveExpense(userId, data) {
  const { amount, location, category, date, type,
          paymentMethod = 'Dinheiro', installments = 1, isInternational = false } = data;
  const signedAmount      = type === 'receita' ? Math.abs(amount) : -Math.abs(amount);
  const installmentAmount = signedAmount / installments;
  const groupId           = `wa-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const stmt = db.prepare(`
    INSERT INTO expenses
      (group_id, purchase_date, due_date, category, location, payment_method,
       total_amount, installments, installment_number, installment_amount, user_id, is_international)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < installments; i++) {
    const dueDate = i === 0 ? date : addMonths(date, i);
    stmt.run(groupId, date, dueDate, category, location, paymentMethod,
             signedAmount, installments, i + 1, installmentAmount, userId, isInternational ? 1 : 0);
  }
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
  const emoji  = parsed.type === 'receita' ? '💰' : '💸';
  const tipo   = parsed.type === 'receita' ? 'Receita' : 'Despesa';
  const valor  = parsed.amount ? fmtBRL(parsed.amount) : '❓ (não detectado)';
  const method = parsed.paymentMethod || 'Dinheiro';
  const installments = parsed.installments || 1;

  const localLine = parsed.location ? `📍 *Local:* ${parsed.location}\n` : '';
  const intlLine = parsed.isInternational ? '🌍 *Internacional:* Sim\n' : '';

  const installmentLine = installments > 1
    ? `🔢 *Parcelas:* ${installments}x de ${fmtBRL(parsed.amount / installments)}\n`
    : '';

  return (
    `${emoji} *${tipo} detectada!*\n\n` +
    localLine +
    `💵 *Valor:* ${valor}\n` +
    `📂 *Categoria:* ${parsed.category}\n` +
    `📅 *Data:* ${fmtDate(parsed.date)}\n` +
    `💳 *Método:* ${method}\n` +
    intlLine +
    installmentLine +
    `\nResponda *sim* para confirmar ou *não* para cancelar.`
  );
}

// ─── Command handlers ──────────────────────────────────────────────────────────
async function handleVincular(phone, args) {
  const code = args.trim();
  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    return sendWhatsApp(phone,
      '⚠️ Código inválido. Use: `/vincular 123456`\n\nO código é gerado na seção *Perfil* do grão e tem 6 dígitos.');
  }

  const user = waDb.linkUser(phone, code);
  if (!user) {
    return sendWhatsApp(phone,
      '❌ Código inválido ou expirado.\n\nGere um novo código em *Perfil → Vincular WhatsApp* no grão.');
  }

  return sendWhatsApp(phone,
    `✅ *Conta vinculada com sucesso!*\n\nOlá, *${user.username}*! Agora você pode registrar seus gastos por aqui.\n\nDigite */ajuda* para ver os comandos disponíveis.`);
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
    `🌾 *grão — Ajuda*\n\n` +
    `*Comandos disponíveis:*\n` +
    `📌 /vincular CODIGO — Vincula seu número ao grão\n` +
    `💰 /saldo — Saldo do mês atual\n` +
    `📋 /resumo — Gastos por categoria\n` +
    `💳 /padrao — Ver ou alterar método de pagamento padrão\n` +
    `❓ /ajuda — Esta mensagem\n\n` +
    `*Registrar gastos:*\n` +
    `Envie uma mensagem de texto descrevendo o gasto:\n` +
    `_"paguei 45 reais no mercado hoje"_\n\n` +
    `*Áudio:*\n` +
    `Envie um áudio descrevendo o gasto — será transcrito automaticamente.`);
}

async function handlePadrao(phone, args) {
  const methods = getAllPaymentMethods();

  // If user sent a number as argument (e.g. "/padrao 2")
  const num = parseInt(args.trim());
  if (!isNaN(num) && num >= 1 && num <= methods.length) {
    const chosen = methods[num - 1].name;
    setDefaultPaymentMethod(phone, chosen);
    return sendWhatsApp(phone, `✅ Método padrão atualizado para *${chosen}*!`);
  }

  // Show current default and list
  const current = getDefaultPaymentMethod(phone);
  const methodList = methods.map((m, i) => `${i + 1}. ${m.name}${current === m.name ? ' ✅' : ''}`).join('\n');

  return sendWhatsApp(phone,
    `💳 *Método de pagamento padrão*\n\n` +
    `${current ? `Atual: *${current}*` : 'Nenhum definido'}\n\n` +
    `${methodList}\n\n` +
    `Responda com o número para alterar.\nEx: */padrao 2*`
  );
}

// ─── Text message handler ──────────────────────────────────────────────────────
async function handleText(body, phone, userId) {
  const lower = body.toLowerCase().trim();

  // Commands
  if (lower.startsWith('/vincular')) return handleVincular(phone, body.slice(9).trim());
  if (lower === '/saldo')  return handleSaldo(userId, phone);
  if (lower === '/resumo') return handleResumo(userId, phone);
  if (lower === '/ajuda')  return handleAjuda(phone);
  if (lower.startsWith('/padrao')) return handlePadrao(phone, body.slice(7).trim());

  // Confirmation of pending transaction
  const pending = waDb.getPendingSession(phone);
  if (pending) {
    // Awaiting default payment method selection
    if (pending.awaitingDefault && /^[1-9]$/.test(lower)) {
      const methods = getAllPaymentMethods();
      const idx = parseInt(lower) - 1;
      if (idx >= 0 && idx < methods.length) {
        const chosen = methods[idx].name;
        setDefaultPaymentMethod(phone, chosen);
        pending.paymentMethod = chosen;
        pending.awaitingDefault = false;
        waDb.savePendingSession(phone, pending);
        return sendWhatsApp(phone, `✅ *${chosen}* definido como padrão!\n\n` + buildConfirmationMessage(pending));
      }
    }

    // Card selection response (number 1, 2, 3...)
    if (pending.needsCardSelection && /^[1-9]$/.test(lower)) {
      const idx = parseInt(lower) - 1;
      if (idx < pending.availableCards.length) {
        pending.paymentMethod = pending.availableCards[idx].name;
        pending.needsCardSelection = false;
        waDb.savePendingSession(phone, pending);
        return sendWhatsApp(phone, buildConfirmationMessage(pending));
      }
    }

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
  const parsed = parse(body, userId);
  if (!parsed.amount) {
    return sendWhatsApp(phone,
      `🤔 Não consegui identificar um valor.\n\nTente: _"paguei 50 reais no mercado"_\n\nOu use um dos comandos — */ajuda*`);
  }

  // Resolve payment method via user default when parser didn't set one
  if (!parsed.paymentMethod && !parsed.needsCardSelection) {
    const defaultMethod = getDefaultPaymentMethod(phone);
    if (defaultMethod) {
      parsed.paymentMethod = defaultMethod;
    } else {
      const methods = getAllPaymentMethods();
      const methodList = methods.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
      waDb.savePendingSession(phone, { ...parsed, awaitingDefault: true, availableMethods: methods });
      return sendWhatsApp(phone,
        `💳 *Qual seu método de pagamento padrão?*\n\n${methodList}\n\nResponda com o número. Vou lembrar para as próximas transações!`
      );
    }
  }

  waDb.savePendingSession(phone, parsed);
  if (parsed.needsCardSelection) {
    if (parsed.availableCards && parsed.availableCards.length > 0) {
      const cardList = parsed.availableCards
        .map((c, i) => `${i + 1}. ${c.name}`)
        .join('\n');
      return sendWhatsApp(phone,
        `💳 *Qual cartão usar?*\n\n${cardList}\n\nResponda com o número do cartão (ex: *1*)`
      );
    } else {
      return sendWhatsApp(phone,
        `💳 *Qual cartão de crédito foi usado?*\n\nDigite o nome do cartão (ex: Nubank, Inter, Itaú...)`
      );
    }
  }
  return sendWhatsApp(phone, buildConfirmationMessage(parsed));
}

// ─── Audio handler ─────────────────────────────────────────────────────────────
async function handleAudio(mediaUrl, phone, userId) {
  await sendWhatsApp(phone, '🎙️ Transcrevendo seu áudio...');
  try {
    const buffer = await downloadMedia(mediaUrl);
    const text   = await transcribe(buffer);
    await sendWhatsApp(phone, `📝 *Transcrição:* "${text}"`);

    const parsed = parse(text, userId);
    if (!parsed.amount) {
      return sendWhatsApp(phone, '🤔 Não identifiquei um valor no áudio. Tente novamente ou envie uma mensagem de texto.');
    }

    // Resolve payment method via user default when parser didn't set one
    if (!parsed.paymentMethod && !parsed.needsCardSelection) {
      const defaultMethod = getDefaultPaymentMethod(phone);
      if (defaultMethod) {
        parsed.paymentMethod = defaultMethod;
      } else {
        const methods = getAllPaymentMethods();
        const methodList = methods.map((m, i) => `${i + 1}. ${m.name}`).join('\n');
        waDb.savePendingSession(phone, { ...parsed, awaitingDefault: true, availableMethods: methods });
        return sendWhatsApp(phone,
          `💳 *Qual seu método de pagamento padrão?*\n\n${methodList}\n\nResponda com o número. Vou lembrar para as próximas transações!`
        );
      }
    }

    waDb.savePendingSession(phone, parsed);
    if (parsed.needsCardSelection) {
      if (parsed.availableCards && parsed.availableCards.length > 0) {
        const cardList = parsed.availableCards
          .map((c, i) => `${i + 1}. ${c.name}`)
          .join('\n');
        return sendWhatsApp(phone,
          `💳 *Qual cartão usar?*\n\n${cardList}\n\nResponda com o número do cartão (ex: *1*)`
        );
      } else {
        return sendWhatsApp(phone,
          `💳 *Qual cartão de crédito foi usado?*\n\nDigite o nome do cartão (ex: Nubank, Inter, Itaú...)`
        );
      }
    }
    return sendWhatsApp(phone, buildConfirmationMessage(parsed));
  } catch (err) {
    console.error('[whatsapp] audio error:', err);
    return sendWhatsApp(phone, '❌ Erro ao processar o áudio. Tente novamente ou envie uma mensagem de texto.');
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

    // ── Subscription gate ────────────────────────────────────────────────────
    if (userId) {
      const sub = db.prepare('SELECT plan, status, expires_at FROM subscriptions WHERE user_id = ?').get(userId);
      if (sub && sub.plan !== 'free') {
        const isExpired    = sub.expires_at && new Date(sub.expires_at) < new Date();
        const isSuspended  = sub.status === 'suspended';
        const wasExpired   = sub.status === 'expired';

        if (isSuspended || wasExpired || isExpired) {
          if (isExpired && sub.status === 'active') {
            db.prepare("UPDATE subscriptions SET status='expired', updated_at=? WHERE user_id=?")
              .run(new Date().toISOString(), userId);
          }
          return sendWhatsApp(phone,
            '⚠️ Seu acesso ao grão expirou.\n\nPara continuar registrando seus gastos, renove sua assinatura em graofin.com.br'
          ).catch(console.error);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      if (numMedia > 0) {
        const contentType = (req.body.MediaContentType0 || '').toLowerCase();
        const mediaUrl    = req.body.MediaUrl0;

        if (contentType.startsWith('audio/')) {
          await handleAudio(mediaUrl, phone, userId);
        } else {
          await sendWhatsApp(phone, '📎 Tipo de arquivo não suportado. Envie texto ou áudio.');
        }
      } else {
        await handleText(body, phone, userId);
      }
    } catch (err) {
      console.error('[whatsapp] unhandled error:', err);
      logBotError(phone, userId, body, err);
      sendWhatsApp(phone, '⚠️ Ocorreu um erro inesperado. Tente novamente.').catch(console.error);
    }
  }
);

module.exports = router;
