const { Router }   = require('express');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const crypto       = require('crypto');
const { Resend }   = require('resend');
const { db }       = require('../database');
const requireAuth  = require('../middleware/auth');

const resend = new Resend(process.env.RESEND_API_KEY);

const resetEmailHtml = (resetUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:2rem 1rem;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#111827;padding:2rem;text-align:center;">
            <span style="font-size:28px;font-weight:500;color:#ffffff;letter-spacing:-0.5px;">gr<span style="color:#16a34a;">ã</span>o</span>
          </td>
        </tr>
        <tr>
          <td style="padding:2rem;">
            <h2 style="font-size:20px;font-weight:500;color:#111827;margin:0 0 0.75rem;">Redefinir sua senha</h2>
            <p style="font-size:14px;color:#6b7280;line-height:1.7;margin:0 0 1.5rem;">
              Recebemos uma solicitação para redefinir a senha da sua conta no grão. Clique no botão abaixo para criar uma nova senha.
            </p>
            <div style="text-align:center;margin:1.5rem 0;">
              <a href="${resetUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:15px;font-weight:500;">Redefinir minha senha</a>
            </div>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;font-size:12px;color:#9ca3af;line-height:1.6;margin-top:1.5rem;">
              🔒 Este link é válido por <strong>1 hora</strong>. Se você não solicitou a redefinição, ignore este e-mail.
            </div>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #f3f4f6;padding:1.25rem 2rem;text-align:center;font-size:12px;color:#9ca3af;">
            grão — controle financeiro pessoal<br>
            <a href="${process.env.APP_URL}" style="color:#16a34a;text-decoration:none;">${process.env.APP_URL}</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const router = Router();

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação',      is_income: 0 },
  { name: 'Transporte',       is_income: 0 },
  { name: 'Moradia',          is_income: 0 },
  { name: 'Saúde',            is_income: 0 },
  { name: 'Lazer',            is_income: 0 },
  { name: 'Compras',          is_income: 0 },
  { name: 'Educação',         is_income: 0 },
  { name: 'Contas',           is_income: 0 },
  { name: 'Cuidados Pessoais',is_income: 0 },
  { name: 'Salário',          is_income: 1 },
  { name: 'Freelance',        is_income: 1 },
  { name: 'Outros',           is_income: 1 },
];

function seedDefaultCategories(userId) {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO categories (name, is_income, user_id) VALUES (?, ?, ?)'
  );
  for (const { name, is_income } of DEFAULT_CATEGORIES) {
    stmt.run(name, is_income, userId);
  }
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'username e password são obrigatórios' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Usuário ou senha incorretos' });

  // Busca is_admin do banco após validar a senha — garante valor atualizado
  // mesmo que o SELECT anterior tenha retornado um valor defasado
  const freshRow = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(user.id);
  const isAdmin  = freshRow ? freshRow.is_admin === 1 : false;

  console.log(`[auth] login: user="${user.username}" id=${user.id} is_admin_db=${freshRow?.is_admin} isAdmin=${isAdmin}`);

  const token = jwt.sign(
    { id: user.id, username: user.username, is_admin: isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, username: user.username, is_admin: isAdmin });
});

// GET /api/auth/me  — verifica o token e retorna o usuário
// Sempre consulta o banco para garantir is_admin correto,
// mesmo em tokens antigos emitidos antes da coluna existir.
router.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token ausente' });

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ id: user.id, username: user.username, is_admin: user.is_admin === 1 });
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
});

// PUT /api/auth/profile — altera username e/ou senha do usuário autenticado
router.put('/profile', requireAuth, (req, res) => {
  const { current_password, new_username, new_password } = req.body;

  if (!current_password)
    return res.status(400).json({ error: 'Senha atual é obrigatória' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user)
    return res.status(404).json({ error: 'Usuário não encontrado' });

  if (!bcrypt.compareSync(current_password, user.password))
    return res.status(401).json({ error: 'Senha atual incorreta' });

  const updatedUsername = new_username?.trim() || user.username;
  const updatedPassword = new_password
    ? bcrypt.hashSync(new_password, 10)
    : user.password;

  // Verifica se o novo username já está em uso por outro usuário
  if (updatedUsername !== user.username) {
    const conflict = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(updatedUsername, user.id);
    if (conflict)
      return res.status(409).json({ error: 'Nome de usuário já está em uso' });
  }

  db.prepare('UPDATE users SET username = ?, password = ? WHERE id = ?')
    .run(updatedUsername, updatedPassword, user.id);

  // Emite novo token com o username atualizado
  const isAdmin = user.is_admin === 1;
  const token = jwt.sign(
    { id: user.id, username: updatedUsername, is_admin: isAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, username: updatedUsername, is_admin: isAdmin });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email é obrigatório' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(200).json({ ok: true });

  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
    .run(token, expires, user.id);

  const link = `${process.env.APP_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from:    'grão <graofin.contato@gmail.com>',
    to:      email,
    subject: 'Redefinir senha — grão',
    html:    resetEmailHtml(link),
  });

  res.status(200).json({ ok: true });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: 'token e newPassword são obrigatórios' });

  const now  = new Date().toISOString();
  const user = db.prepare(
    'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?'
  ).get(token, now);

  if (!user) return res.status(400).json({ error: 'Token inválido ou expirado' });

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare(
    'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL, must_change_password = 0 WHERE id = ?'
  ).run(hash, user.id);

  res.status(200).json({ ok: true });
});

// POST /api/auth/first-access  (reuses reset_token as invite token)
router.post('/first-access', async (req, res) => {
  const { token, username, newPassword, password } = req.body;
  const pwd = newPassword || password;
  if (!token || !username || !pwd)
    return res.status(400).json({ error: 'token, username e newPassword são obrigatórios' });

  const now  = new Date().toISOString();
  const user = db.prepare(
    'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?'
  ).get(token, now);

  if (!user) return res.status(400).json({ error: 'Convite inválido ou expirado' });

  const conflict = db.prepare('SELECT 1 FROM users WHERE username = ? AND id != ?').get(username, user.id);
  if (conflict) return res.status(400).json({ error: 'Este usuário já está em uso' });

  const hash = bcrypt.hashSync(pwd, 10);
  db.prepare(
    'UPDATE users SET password = ?, username = ?, reset_token = NULL, reset_token_expires = NULL, must_change_password = 0 WHERE id = ?'
  ).run(hash, username, user.id);

  seedDefaultCategories(user.id);

  res.status(200).json({ ok: true });
});

// POST /api/auth/forgot-username
router.post('/forgot-username', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email é obrigatório' });

  const user = db.prepare('SELECT username FROM users WHERE email = ?').get(email);

  if (user) {
    await resend.emails.send({
      from:    'grão <graofin.contato@gmail.com>',
      to:      email,
      subject: 'Seu usuário no grão',
      html:    `<p>Seu usuário de acesso ao grão é: <strong>${user.username}</strong></p>`,
    });
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
