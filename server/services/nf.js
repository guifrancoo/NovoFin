const jsQR = require('jsqr');

// ─── QR Code reader ────────────────────────────────────────────────────────────
/**
 * Reads a QR code from an image Buffer.
 * Returns the decoded string, or null if no QR code found.
 */
async function readQRCode(imageBuffer) {
  const sharp = require('sharp');

  const strategies = [
    // Strategy 1: force RGBA explicitly
    async () => {
      const { data, info } = await sharp(imageBuffer)
        .flatten({ background: '#ffffff' })
        .toColorspace('srgb')
        .ensureAlpha(1)
        .raw()
        .toBuffer({ resolveWithObject: true });
      console.log('[nf] s1 channels:', info.channels, 'size:', info.width, 'x', info.height);
      return { data, info };
    },
    // Strategy 2: grayscale converted back to RGBA
    async () => {
      const { data: grayData, info: grayInfo } = await sharp(imageBuffer)
        .grayscale()
        .normalise()
        .toBuffer({ resolveWithObject: true });
      // Convert grayscale to RGBA manually
      const rgba = Buffer.alloc(grayInfo.width * grayInfo.height * 4);
      for (let i = 0; i < grayData.length; i++) {
        rgba[i * 4]     = grayData[i];
        rgba[i * 4 + 1] = grayData[i];
        rgba[i * 4 + 2] = grayData[i];
        rgba[i * 4 + 3] = 255;
      }
      return { data: rgba, info: { width: grayInfo.width, height: grayInfo.height, channels: 4 } };
    },
    // Strategy 3: resize to 1500px wide + grayscale to RGBA
    async () => {
      const { data: grayData, info: grayInfo } = await sharp(imageBuffer)
        .resize(1500, null)
        .grayscale()
        .normalise()
        .sharpen()
        .toBuffer({ resolveWithObject: true });
      const rgba = Buffer.alloc(grayInfo.width * grayInfo.height * 4);
      for (let i = 0; i < grayData.length; i++) {
        rgba[i * 4]     = grayData[i];
        rgba[i * 4 + 1] = grayData[i];
        rgba[i * 4 + 2] = grayData[i];
        rgba[i * 4 + 3] = 255;
      }
      return { data: rgba, info: { width: grayInfo.width, height: grayInfo.height, channels: 4 } };
    },
    // Strategy 4: threshold (black and white)
    async () => {
      const { data: grayData, info: grayInfo } = await sharp(imageBuffer)
        .resize(1500, null)
        .grayscale()
        .threshold(128)
        .toBuffer({ resolveWithObject: true });
      const rgba = Buffer.alloc(grayInfo.width * grayInfo.height * 4);
      for (let i = 0; i < grayData.length; i++) {
        rgba[i * 4]     = grayData[i];
        rgba[i * 4 + 1] = grayData[i];
        rgba[i * 4 + 2] = grayData[i];
        rgba[i * 4 + 3] = 255;
      }
      return { data: rgba, info: { width: grayInfo.width, height: grayInfo.height, channels: 4 } };
    },
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      const { data, info } = await strategies[i]();
      const code = jsQR(new Uint8ClampedArray(data.buffer), info.width, info.height);
      if (code) {
        console.log(`[nf] QR found on strategy ${i + 1}`);
        return code.data;
      }
      console.log(`[nf] strategy ${i + 1}: no QR found`);
    } catch (err) {
      console.warn(`[nf] strategy ${i + 1} failed:`, err.message);
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
