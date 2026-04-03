const jsQR = require('jsqr');

// ─── QR Code reader ────────────────────────────────────────────────────────────
/**
 * Reads a QR code from an image Buffer.
 * Returns the decoded string, or null if no QR code found.
 */
async function readQRCode(imageBuffer) {
  const sharp = require('sharp');
  const attempts = [
    // Attempt 1: grayscale + high contrast
    () => sharp(imageBuffer).grayscale().normalise().ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    // Attempt 2: grayscale + sharpen + threshold
    () => sharp(imageBuffer).grayscale().sharpen().threshold(128).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    // Attempt 3: resize larger + grayscale (helps with small QR codes)
    () => sharp(imageBuffer).resize(1200, 1200, { fit: 'inside' }).grayscale().normalise().ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    // Attempt 4: raw with no processing (original behavior)
    () => sharp(imageBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      const { data, info } = await attempts[i]();
      const code = jsQR(new Uint8ClampedArray(data.buffer), info.width, info.height);
      if (code) {
        console.log(`[nf] QR code found on attempt ${i + 1}`);
        return code.data;
      }
    } catch (err) {
      console.warn(`[nf] attempt ${i + 1} failed:`, err.message);
    }
  }
  return null;
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
      'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language':           'pt-BR,pt;q=0.9',
      'Accept-Encoding':           'gzip, deflate, br',
      'Connection':                'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    timeout: 15000,
  });
  const html = await res.text();
  console.log('[nf] SEFAZ status:', res.status);
  console.log('[nf] SEFAZ html preview:', html.substring(0, 500));
  if (!res.ok) throw new Error(`SEFAZ responded with ${res.status}`);
  return html;
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
  console.log('[nf] QR data:', qrData);
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
