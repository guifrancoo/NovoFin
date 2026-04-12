// server/push-to-prod.js
// Dumps the local SQLite DB and pushes it to Railway production via the admin API.
// Usage: node --experimental-sqlite server/push-to-prod.js <ADMIN_KEY>

'use strict';

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');
const https = require('https');

const PROD_URL = 'https://graofin.up.railway.app/api/admin/import-json';

const ADMIN_KEY = process.argv[2];
if (!ADMIN_KEY) {
  console.error('Usage: node --experimental-sqlite server/push-to-prod.js <ADMIN_KEY>');
  process.exit(1);
}

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/app/server/data/financeiro.db'
  : path.join(__dirname, 'financeiro.db');

if (!fs.existsSync(DB_PATH)) {
  console.error('ERROR: local DB not found at', DB_PATH);
  process.exit(1);
}

console.log('[push] Reading local DB:', DB_PATH);
const db = new DatabaseSync(DB_PATH);

// ── Dump all tables ───────────────────────────────────────────────────────────
const TABLES = [
  'users',
  'categories',
  'subcategories',
  'payment_methods',
  'subscriptions',
  'cutoff_dates',
  'expenses',
  'whatsapp_users',
];

const payload = {};
for (const table of TABLES) {
  try {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    payload[table] = rows;
    console.log(`[push]   ${table}: ${rows.length} rows`);
  } catch (err) {
    console.warn(`[push]   ${table}: skipped (${err.message})`);
    payload[table] = [];
  }
}

db.close();

const body = JSON.stringify(payload);
const bodyBytes = Buffer.byteLength(body, 'utf8');
console.log(`\n[push] Payload size: ${(bodyBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`[push] POSTing to: ${PROD_URL}\n`);

// ── POST to Railway ───────────────────────────────────────────────────────────
const url = new URL(PROD_URL);
const options = {
  hostname: url.hostname,
  path:     url.pathname,
  method:   'POST',
  headers: {
    'Content-Type':  'application/json',
    'Content-Length': bodyBytes,
    'x-admin-key':   ADMIN_KEY,
  },
  timeout: 120_000,
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`[push] HTTP ${res.statusCode}`);
    try {
      const json = JSON.parse(data);
      if (json.ok) {
        console.log('[push] ✓ Import successful');
        if (json.counts) {
          console.log('[push] Counts imported:');
          for (const [table, n] of Object.entries(json.counts)) {
            console.log(`         ${table}: ${n}`);
          }
        }
        if (json.diagnostics) {
          console.log('[push] Diagnostics:', JSON.stringify(json.diagnostics, null, 2));
        }
      } else {
        console.error('[push] ✗ Import failed:', json.error || data);
      }
    } catch {
      console.log('[push] Raw response:', data);
    }
  });
});

req.on('timeout', () => {
  console.error('[push] Request timed out (120s)');
  req.destroy();
});

req.on('error', (err) => {
  console.error('[push] Request error:', err.message);
  process.exit(1);
});

req.write(body);
req.end();
