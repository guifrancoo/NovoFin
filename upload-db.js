#!/usr/bin/env node
/**
 * upload-db.js
 * Envia o banco de dados local (server/financeiro.db) para o servidor Railway.
 *
 * Uso:
 *   node upload-db.js <URL_DO_RAILWAY> <ADMIN_KEY>
 *
 * Exemplo:
 *   node upload-db.js https://meu-app.up.railway.app minha-chave-secreta
 *
 * A ADMIN_KEY deve ser a mesma configurada na variável de ambiente ADMIN_KEY
 * no Railway.
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');

const [,, serverUrl, adminKey] = process.argv;

if (!serverUrl || !adminKey) {
  console.error('Uso: node upload-db.js <URL_DO_RAILWAY> <ADMIN_KEY>');
  console.error('Ex:  node upload-db.js https://meu-app.up.railway.app minha-chave-secreta');
  process.exit(1);
}

const EXPORT_PATH = path.join(__dirname, 'server', 'financeiro-export.db');

if (!fs.existsSync(EXPORT_PATH)) {
  console.error('');
  console.error('Export não encontrado em:', EXPORT_PATH);
  console.error('');
  console.error('Execute primeiro:');
  console.error('  node --experimental-sqlite fix-db.js');
  console.error('');
  process.exit(1);
}

const dbBuffer = fs.readFileSync(EXPORT_PATH);
const dbBase64 = dbBuffer.toString('base64');
const sizeMB   = (dbBuffer.length / 1024 / 1024).toFixed(2);

console.log(`Banco export: ${EXPORT_PATH} (${sizeMB} MB)`);
console.log(`Enviando para: ${serverUrl}/api/admin/restore-db ...`);

const body = JSON.stringify({ db: dbBase64 });
const url  = new URL('/api/admin/restore-db', serverUrl);

const options = {
  hostname: url.hostname,
  port:     url.port || (url.protocol === 'https:' ? 443 : 80),
  path:     url.pathname,
  method:   'POST',
  headers: {
    'Content-Type':  'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-admin-key':   adminKey,
  },
};

const transport = url.protocol === 'https:' ? https : http;

const req = transport.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      const json = JSON.parse(data);
      console.log('✓ Banco enviado com sucesso!');
      console.log('  Tamanho recebido:', json.size_bytes, 'bytes');
      console.log('  O servidor irá reiniciar automaticamente.');
    } else {
      console.error('✗ Erro:', res.statusCode, data);
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
