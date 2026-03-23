const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'

/**
 * Sends a WhatsApp message via Twilio.
 * @param {string} to  - recipient number, with or without 'whatsapp:' prefix
 * @param {string} body - message text
 */
async function sendWhatsApp(to, body) {
  const normalised = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  return client.messages.create({ from: FROM, to: normalised, body });
}

/**
 * Downloads a Twilio media URL using HTTP Basic Auth (SID:TOKEN).
 * Returns a Buffer with the file contents.
 */
async function downloadMedia(url) {
  const fetch = require('node-fetch');
  const creds = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${creds}` },
  });

  if (!res.ok) throw new Error(`Failed to download media: ${res.status}`);
  return res.buffer();
}

module.exports = { client, sendWhatsApp, downloadMedia };
