#!/usr/bin/env node
/**
 * export-data.js
 * Exporta todos os dados do banco local para server/data-export.json.
 *
 * Uso:
 *   node --experimental-sqlite export-data.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('fs');

const DB_PATH     = path.join(__dirname, 'server', 'financeiro.db');
const EXPORT_PATH = path.join(__dirname, 'server', 'data-export.json');

if (!fs.existsSync(DB_PATH)) {
  console.error('Banco não encontrado em:', DB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);

const tables = ['categories', 'subcategories', 'payment_methods', 'cutoff_dates', 'expenses', 'users'];
const output = { exported_at: new Date().toISOString() };

for (const table of tables) {
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  output[table] = rows;
  console.log(`  ${table}: ${rows.length} registros`);
}

db.close();

fs.writeFileSync(EXPORT_PATH, JSON.stringify(output, null, 2));

const sizeMB = (fs.statSync(EXPORT_PATH).size / 1024 / 1024).toFixed(2);
console.log('');
console.log('Export gerado:', EXPORT_PATH, `(${sizeMB} MB)`);
console.log('Pronto! Execute agora: node import-data.js <URL> <ADMIN_KEY>');
