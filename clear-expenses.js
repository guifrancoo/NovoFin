/**
 * clear-expenses.js
 * Remove todos os registros da tabela expenses.
 * Uso: node --no-warnings=ExperimentalWarning clear-expenses.js
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'server', 'financeiro.db'));
const info = db.prepare('DELETE FROM expenses').run();
// Reset autoincrement counter
db.prepare("DELETE FROM sqlite_sequence WHERE name = 'expenses'").run();
console.log(`Removidos: ${info.changes} registros.`);
