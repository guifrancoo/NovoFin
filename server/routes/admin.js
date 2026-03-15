const { Router } = require('express');
const path = require('path');
const fs   = require('fs');

const router = Router();

const DB_PATH = path.join(__dirname, '..', 'financeiro.db');

// POST /api/admin/restore-db
// Header obrigatório: x-admin-key: <ADMIN_KEY do .env>
// Body: { db: "<base64 do arquivo .db>" }
router.post('/restore-db', (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey)
    return res.status(500).json({ error: 'ADMIN_KEY não configurada no servidor' });

  if (req.headers['x-admin-key'] !== adminKey)
    return res.status(401).json({ error: 'Chave de admin inválida' });

  const { db: dbBase64 } = req.body;
  if (!dbBase64)
    return res.status(400).json({ error: 'Campo "db" (base64) ausente no body' });

  let buffer;
  try {
    buffer = Buffer.from(dbBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Base64 inválido' });
  }

  // Validação mínima: SQLite começa com "SQLite format 3\0"
  if (!buffer.slice(0, 16).toString('ascii').startsWith('SQLite format 3')) {
    return res.status(400).json({ error: 'Arquivo não parece ser um banco SQLite válido' });
  }

  // Salva com backup do anterior
  const backupPath = DB_PATH + '.bak';
  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backupPath);
  }

  fs.writeFileSync(DB_PATH, buffer);

  const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`[admin] banco restaurado (${sizeMB} MB) — reiniciando processo...`);

  res.json({ ok: true, size_bytes: buffer.length, message: 'Banco restaurado. Reinicie o servidor para aplicar.' });

  // Encerra o processo para o Railway reiniciar com o novo banco
  setTimeout(() => process.exit(0), 300);
});

module.exports = router;
