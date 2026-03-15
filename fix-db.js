#!/usr/bin/env node
/**
 * fix-db.js
 * Faz checkpoint WAL e cria uma cópia limpa/consolidada do banco via VACUUM INTO.
 * O banco original (financeiro.db) nunca é modificado.
 * O arquivo gerado (financeiro-export.db) é o que deve ser enviado com upload-db.js.
 *
 * Uso:
 *   node --experimental-sqlite fix-db.js
 */

const { DatabaseSync } = require('node:sqlite');
const path   = require('path');
const fsReal = require('fs');

const DB_PATH     = path.join(__dirname, 'server', 'financeiro.db');
const EXPORT_PATH = path.join(__dirname, 'server', 'financeiro-export.db');

if (!fsReal.existsSync(DB_PATH)) {
  console.error('Banco não encontrado em:', DB_PATH);
  process.exit(1);
}

console.log('Banco original:', DB_PATH);
console.log('Tamanho original:', (fsReal.statSync(DB_PATH).size / 1024 / 1024).toFixed(2), 'MB');

const WAL_PATH = DB_PATH + '-wal';
if (fsReal.existsSync(WAL_PATH)) {
  console.log('WAL encontrado:', (fsReal.statSync(WAL_PATH).size / 1024 / 1024).toFixed(2), 'MB — será consolidado via checkpoint');
}

const db = new DatabaseSync(DB_PATH);

// Força checkpoint completo: consolida WAL no arquivo principal
const ckpt = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
console.log('Checkpoint resultado:', JSON.stringify(ckpt));

// Remove export antigo se existir (VACUUM INTO falha se o destino já existe)
if (fsReal.existsSync(EXPORT_PATH)) {
  fsReal.unlinkSync(EXPORT_PATH);
  console.log('Export anterior removido:', EXPORT_PATH);
}

// Cria cópia limpa e consolidada — NÃO altera o banco original
db.exec(`VACUUM INTO '${EXPORT_PATH.replace(/\\/g, '/')}'`);
console.log('VACUUM INTO concluído');

db.close();

// Valida o export
const exportDb = new DatabaseSync(EXPORT_PATH);
const integrity = exportDb.prepare('PRAGMA integrity_check').get();
const count     = exportDb.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
exportDb.close();

const exportSize = fsReal.statSync(EXPORT_PATH).size;
console.log('');
console.log('Export gerado:', EXPORT_PATH);
console.log('Tamanho export:', (exportSize / 1024 / 1024).toFixed(2), `MB (${exportSize} bytes)`);
console.log('Integridade:', integrity.integrity_check);
console.log('Registros (expenses):', count);
console.log('');
console.log('Pronto! Execute agora: node upload-db.js <URL> <ADMIN_KEY>');
