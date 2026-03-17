#!/usr/bin/env node
/**
 * download-db.js
 * Baixa todos os dados do Railway via GET /api/admin/export-json
 * e salva em server/data-railway.json.
 *
 * Uso:
 *   node download-db.js <URL_DO_RAILWAY> <ADMIN_KEY>
 *
 * Exemplo:
 *   node download-db.js https://meu-app.up.railway.app minha-chave-secreta
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');

const [,, serverUrl, adminKey] = process.argv;

if (!serverUrl || !adminKey) {
  console.error('Uso: node download-db.js <URL_DO_RAILWAY> <ADMIN_KEY>');
  process.exit(1);
}

const OUTPUT_PATH = path.join(__dirname, 'server', 'data-railway.json');

console.log('Baixando dados de:', serverUrl + '/api/admin/export-json ...');

const url     = new URL('/api/admin/export-json', serverUrl);
const options = {
  hostname: url.hostname,
  port:     url.port || (url.protocol === 'https:' ? 443 : 80),
  path:     url.pathname,
  method:   'GET',
  headers: {
    'x-admin-key': adminKey,
  },
};

const transport = url.protocol === 'https:' ? https : http;

const req = transport.request(options, (res) => {
  let raw = '';
  res.on('data', (chunk) => { raw += chunk; });
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('✗ Erro:', res.statusCode, raw);
      process.exit(1);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error('✗ Resposta inválida (não é JSON):', err.message);
      process.exit(1);
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), 'utf8');

    const sizeMB = (Buffer.byteLength(raw, 'utf8') / 1024 / 1024).toFixed(2);
    const tables = ['categories', 'subcategories', 'payment_methods', 'cutoff_dates', 'expenses', 'users'];

    console.log('✓ Download concluído! Salvo em: server/data-railway.json (' + sizeMB + ' MB)');
    console.log('  Registros por tabela:');
    for (const t of tables) {
      console.log(`    ${t}: ${(data[t] || []).length} registros`);
    }
  });
});

req.on('error', (err) => {
  console.error('✗ Falha na conexão:', err.message);
  process.exit(1);
});

req.end();
