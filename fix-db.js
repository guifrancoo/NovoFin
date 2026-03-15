#!/usr/bin/env node
/**
 * fix-db.js
 * Consolida os arquivos WAL do SQLite no arquivo principal antes do upload.
 *
 * Uso:
 *   node --experimental-sqlite fix-db.js
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs   = require('path');
const fsReal = require('fs');

const DB_PATH  = path.join(__dirname, 'server', 'financeiro.db');
const WAL_PATH = DB_PATH + '-wal';
const SHM_PATH = DB_PATH + '-shm';

if (!fsReal.existsSync(DB_PATH)) {
  console.error('Banco não encontrado em:', DB_PATH);
  process.exit(1);
}

console.log('Banco:', DB_PATH);
console.log('Tamanho antes:', (fsReal.statSync(DB_PATH).size / 1024 / 1024).toFixed(2), 'MB');

if (fsReal.existsSync(WAL_PATH)) {
  console.log('WAL encontrado:', (fsReal.statSync(WAL_PATH).size / 1024 / 1024).toFixed(2), 'MB — será consolidado');
}

const db = new DatabaseSync(DB_PATH);

// Força checkpoint completo: move todos os frames do WAL para o banco principal
const ckpt = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
console.log('Checkpoint resultado:', JSON.stringify(ckpt));

// Desativa WAL — garante que o arquivo principal esteja completo e auto-contido
db.exec('PRAGMA journal_mode=DELETE');
console.log('journal_mode alterado para DELETE');

db.close();

// Remove arquivos auxiliares residuais
for (const f of [WAL_PATH, SHM_PATH]) {
  if (fsReal.existsSync(f)) {
    fsReal.unlinkSync(f);
    console.log('Removido:', f);
  }
}

const finalSize = fsReal.statSync(DB_PATH).size;
console.log('Tamanho final:', (finalSize / 1024 / 1024).toFixed(2), `MB (${finalSize} bytes)`);
console.log('Pronto! Banco consolidado. Pode executar upload-db.js agora.');
