const { getUser }       = require('../database/whatsapp');
const { sendWhatsApp }  = require('../services/twilio');

const HELP_UNLINKED = `👋 Olá! Sou o assistente financeiro do *NovoFin*.

Para começar, você precisa vincular este número ao seu perfil:

1. Acesse o NovoFin → *Perfil*
2. Clique em *Vincular WhatsApp*
3. Copie o código de 6 dígitos
4. Envie aqui: \`/vincular CODIGO\`

Precisa de ajuda? Digite */ajuda*`;

/**
 * Middleware that validates the phone number is linked to a NovoFin user.
 * Attaches `req.waUser` and `req.waPhone` if authenticated.
 * Allows the /vincular command and /ajuda to pass through unauthenticated.
 */
function whatsappAuth(req, res, next) {
  const from = req.body.From || '';
  // Normalise to E.164: strip 'whatsapp:' prefix
  const phone = from.replace('whatsapp:', '').trim();
  const body  = (req.body.Body || '').trim().toLowerCase();

  req.waPhone = phone;

  // Always allow /vincular and /ajuda without authentication
  if (body.startsWith('/vincular') || body.startsWith('/ajuda')) {
    return next();
  }

  const user = getUser(phone);
  if (!user) {
    sendWhatsApp(phone, HELP_UNLINKED).catch(console.error);
    return res.sendStatus(200);
  }

  req.waUser = user;
  next();
}

module.exports = whatsappAuth;
