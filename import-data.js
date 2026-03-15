#!/usr/bin/env node
/**
 * import-data.js
 * Envia server/data-export.json para o Railway via POST /api/admin/import-json.
 *
 * Uso:
 *   node import-data.js <URL_DO_RAILWAY> <ADMIN_KEY>
 *
 * Exemplo:
 *   node import-data.js https://meu-app.up.railway.app minha-chave-secreta
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');

const [,, serverUrl, adminKey] = process.argv;

if (!serverUrl || !adminKey) {
  console.error('Uso: node import-data.js <URL_DO_RAILWAY> <ADMIN_KEY>');
  process.exit(1);
}

const EXPORT_PATH = path.join(__dirname, 'server', 'data-export.json');

if (!fs.existsSync(EXPORT_PATH)) {
  console.error('Export não encontrado em:', EXPORT_PATH);
  console.error('Execute primeiro: node --experimental-sqlite export-data.js');
  process.exit(1);
}

const raw    = fs.readFileSync(EXPORT_PATH, 'utf8');
const data   = JSON.parse(raw);
const tables = ['categories', 'subcategories', 'payment_methods', 'cutoff_dates', 'expenses', 'users'];

console.log('Dados a importar:');
for (const t of tables) {
  console.log(`  ${t}: ${(data[t] || []).length} registros`);
}
console.log('');
console.log('Enviando para:', serverUrl + '/api/admin/import-json ...');

const body    = JSON.stringify(data);
const url     = new URL('/api/admin/import-json', serverUrl);
const options = {
  hostname: url.hostname,
  port:     url.port || (url.protocol === 'https:' ? 443 : 80),
  path:     url.pathname,
  method:   'POST',
  headers: {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-admin-key':    adminKey,
  },
};

const transport = url.protocol === 'https:' ? https : http;

const req = transport.request(options, (res) => {
  let raw = '';
  res.on('data', (chunk) => { raw += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const json = JSON.parse(raw);
      console.log('✓ Importação concluída!');
      console.log('  Resultado por tabela:');
      for (const [table, count] of Object.entries(json.counts || {})) {
        console.log(`    ${table}: ${count} registros`);
      }
    } else {
      console.error('✗ Erro:', res.statusCode, raw);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('✗ Falha na conexão:', err.message);
  process.exit(1);
});

req.write(body);
req.end();
