#!/usr/bin/env node
const fs    = require('fs');
const path  = require('path');
const https = require('https');

const SERVER_URL  = 'https://graofin.up.railway.app';
const ADMIN_KEY   = 'financeiro2026@GuiFranco!admin';
const OUTPUT_PATH = path.join(__dirname, 'server', 'data-railway.json');

console.log('Baixando dados de:', SERVER_URL + '/api/admin/export-json ...');

const url     = new URL('/api/admin/export-json', SERVER_URL);
const options = {
  hostname: url.hostname,
  port:     443,
  path:     url.pathname,
  method:   'GET',
  headers:  { 'x-admin-key': ADMIN_KEY },
};

const req = https.request(options, (res) => {
  let raw = '';
  res.on('data', (chunk) => { raw += chunk; });
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('Erro:', res.statusCode, raw.slice(0, 200));
      process.exit(1);
    }
    let data;
    try { data = JSON.parse(raw); }
    catch (err) { console.error('JSON inválido:', err.message); process.exit(1); }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), 'utf8');
    const sizeMB = (Buffer.byteLength(raw, 'utf8') / 1024 / 1024).toFixed(2);
    const tables = ['users','categories','subcategories','payment_methods',
                    'cutoff_dates','expenses','installment_groups'];
    console.log(`\nDownload concluído! (${sizeMB} MB) → server/data-railway.json`);
    for (const t of tables) console.log(`  ${t}: ${(data[t]||[]).length}`);
  });
});

req.on('error', (err) => { console.error('Falha:', err.message); process.exit(1); });
req.end();
