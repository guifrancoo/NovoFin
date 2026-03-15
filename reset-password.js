#!/usr/bin/env node
/**
 * reset-password.js
 * Redefine a senha de um usuário no servidor Railway.
 *
 * Uso:
 *   node reset-password.js <URL_DO_RAILWAY> <ADMIN_KEY> <USERNAME> <NOVA_SENHA>
 *
 * Exemplo:
 *   node reset-password.js https://meu-app.up.railway.app minha-chave admin nova-senha-123
 */

const https = require('https');
const http  = require('http');

const [,, serverUrl, adminKey, username, newPassword] = process.argv;

if (!serverUrl || !adminKey || !username || !newPassword) {
  console.error('Uso: node reset-password.js <URL_DO_RAILWAY> <ADMIN_KEY> <USERNAME> <NOVA_SENHA>');
  process.exit(1);
}

const body = JSON.stringify({ username, new_password: newPassword });
const url  = new URL('/api/admin/reset-password', serverUrl);

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
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    if (res.statusCode === 200) {
      console.log('✓', json.message);
    } else {
      console.error('✗ Erro:', res.statusCode, json.error || data);
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
