const jsQR = require('jsqr');

// ─── QR Code reader ────────────────────────────────────────────────────────────
/**
 * Reads a QR code from an image Buffer.
 * Returns the decoded string, or null if no QR code found.
 */
async function readQRCode(imageBuffer) {
  const sharp = require('sharp');

  // Convert to raw RGBA pixels using sharp
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const code = jsQR(
    new Uint8ClampedArray(data.buffer),
    info.width,
    info.height
  );
  return code ? code.data : null;
}

// ─── Chave de acesso extractor ─────────────────────────────────────────────────
/**
 * Extracts the 44-digit chave de acesso from a NF-e/NFC-e URL.
 * The key can appear as a query param (p=, chave=, nfe=) or as a 44-digit sequence.
 */
function extractChave(url) {
  // Try common query-param names
  try {
    const u      = new URL(url);
    const params = ['p', 'chave', 'nfe', 'ch'];
    for (const param of params) {
      const v = u.searchParams.get(param);
      if (v) {
        const digits = v.replace(/\D/g, '').substring(0, 44);
        if (digits.length === 44) return digits;
        // Some URLs encode "CHAVE|version|..." — take first segment
        const seg = v.split('|')[0].replace(/\D/g, '');
        if (seg.length === 44) return seg;
      }
    }
  } catch (_) {}

  // Fallback: find any 44-digit sequence in the raw URL
  const m = url.match(/\d{44}/);
  return m ? m[0] : null;
}

// ─── SEFAZ state-level NFC-e query ────────────────────────────────────────────
/**
 * Attempts to fetch the NFC-e public URL (as encoded in the QR code).
 * State portals are designed to be publicly accessible without CAPTCHA.
 * Returns raw HTML/text from the state portal.
 */
async function fetchSefazUrl(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NovoFin/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`SEFAZ responded with ${res.status}`);
  return res.text();
}

// ─── Simple HTML value extractor ──────────────────────────────────────────────
function extractFromHtml(html) {
  // Extract total value — common pattern across state portals
  const valorMatch = html.match(/valor\s+total[^:]*:\s*R?\$?\s*([\d.,]+)/i)
    || html.match(/total\s+(?:a\s+pagar|nf)[^:]*:\s*R?\$?\s*([\d.,]+)/i)
    || html.match(/R\$\s*([\d.,]+)/i);
  const valor = valorMatch
    ? parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.'))
    : null;

  // Extract CNPJ
  const cnpjMatch = html.match(/cnpj[^:]*:\s*([\d.\/\-]+)/i);
  const cnpj = cnpjMatch ? cnpjMatch[1].replace(/\D/g, '') : null;

  // Extract establishment name — usually in an <h4> or after "Razão Social"
  const estabMatch = html.match(/raz[ãa]o\s+social[^:]*:\s*([^\n<]+)/i)
    || html.match(/<h[1-4][^>]*>([^<]{5,60})<\/h[1-4]>/i);
  const estabelecimento = estabMatch ? estabMatch[1].trim() : null;

  return { valor, cnpj, estabelecimento, items: [] };
}

// ─── Main export ───────────────────────────────────────────────────────────────
/**
 * Processes a NF-e image Buffer:
 * 1. Reads QR code
 * 2. Extracts chave de acesso
 * 3. Fetches state-level SEFAZ portal
 * 4. Returns { chave, url, valor, cnpj, estabelecimento, items }
 *
 * @param {Buffer} imageBuffer
 */
async function processNFe(imageBuffer) {
  const qrData = await readQRCode(imageBuffer);
  if (!qrData) throw new Error('Nenhum QR code encontrado na imagem');

  const chave = extractChave(qrData);
  if (!chave) throw new Error('Chave de acesso não encontrada no QR code');

  let sefazData = { valor: null, cnpj: null, estabelecimento: null, items: [] };

  // Try to fetch the URL directly (works for NFC-e state portals)
  if (qrData.startsWith('http')) {
    try {
      const html = await fetchSefazUrl(qrData);
      sefazData  = extractFromHtml(html);
    } catch (err) {
      console.warn('[nf] SEFAZ fetch failed:', err.message);
      // Non-fatal — return what we have (the chave itself is useful)
    }
  }

  return {
    chave,
    url: qrData.startsWith('http') ? qrData : null,
    ...sefazData,
  };
}

module.exports = { processNFe, readQRCode, extractChave };
