const { db } = require('../database');

// ─── Table initialisation ──────────────────────────────────────────────────────
function initWhatsappTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_users (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id                INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phone_number           TEXT    NOT NULL UNIQUE,
      default_payment_method TEXT    DEFAULT NULL,
      created_at             TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_wa_users_phone ON whatsapp_users(phone_number);
    CREATE INDEX IF NOT EXISTS idx_wa_users_uid   ON whatsapp_users(user_id);

    CREATE TABLE IF NOT EXISTS whatsapp_link_codes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code       TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL UNIQUE,
      pending_data TEXT NOT NULL,
      expires_at   TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_wa_sessions_phone ON whatsapp_sessions(phone_number);

    CREATE TABLE IF NOT EXISTS bot_errors (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      phone      TEXT,
      user_id    INTEGER,
      message    TEXT,
      error      TEXT,
      stack      TEXT
    );
  `);

  // Migration for existing tables
  try { db.prepare('ALTER TABLE whatsapp_users ADD COLUMN default_payment_method TEXT DEFAULT NULL').run(); } catch (_) {}

  // Backfill whatsapp_number for users linked before this column existed
  db.prepare(`
    UPDATE users
    SET whatsapp_number = (
      SELECT phone_number FROM whatsapp_users WHERE whatsapp_users.user_id = users.id
    )
    WHERE EXISTS (
      SELECT 1 FROM whatsapp_users WHERE whatsapp_users.user_id = users.id
    )
  `).run();
}

// ─── Linking ───────────────────────────────────────────────────────────────────

/**
 * Generates a 6-digit linking code for a user (valid 15 minutes).
 * Replaces any existing code for that user.
 */
function generateLinkCode(userId) {
  const code      = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  db.prepare('DELETE FROM whatsapp_link_codes WHERE user_id = ?').run(userId);
  db.prepare(
    'INSERT INTO whatsapp_link_codes (user_id, code, expires_at) VALUES (?, ?, ?)'
  ).run(userId, code, expiresAt);

  return code;
}

/**
 * Links a phone number to a user account using a link code.
 * Returns the linked user row, or null if the code is invalid/expired.
 */
function linkUser(phoneNumber, code) {
  const row = db.prepare(`
    SELECT user_id FROM whatsapp_link_codes
    WHERE code = ? AND expires_at > datetime('now')
  `).get(code);

  if (!row) return null;

  db.prepare(
    'INSERT OR REPLACE INTO whatsapp_users (user_id, phone_number) VALUES (?, ?)'
  ).run(row.user_id, phoneNumber);
  db.prepare('UPDATE users SET whatsapp_number = ? WHERE id = ?').run(phoneNumber, row.user_id);
  db.prepare('DELETE FROM whatsapp_link_codes WHERE code = ?').run(code);

  return getUser(phoneNumber);
}

/**
 * Returns the NovoFin user linked to a phone number, or null.
 */
function getUser(phoneNumber) {
  return db.prepare(`
    SELECT u.id, u.username, u.is_admin, wu.phone_number
    FROM whatsapp_users wu
    JOIN users u ON u.id = wu.user_id
    WHERE wu.phone_number = ?
  `).get(phoneNumber);
}

// ─── Sessions (pending confirmations) ─────────────────────────────────────────

/**
 * Saves a pending transaction awaiting user confirmation (expires in 10 minutes).
 */
function savePendingSession(phoneNumber, data) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO whatsapp_sessions (phone_number, pending_data, expires_at)
    VALUES (?, ?, ?)
  `).run(phoneNumber, JSON.stringify(data), expiresAt);
}

/**
 * Returns the pending session for a phone number, or null if expired/missing.
 */
function getPendingSession(phoneNumber) {
  const row = db.prepare(`
    SELECT pending_data FROM whatsapp_sessions
    WHERE phone_number = ? AND expires_at > datetime('now')
  `).get(phoneNumber);
  if (!row) return null;
  try { return JSON.parse(row.pending_data); } catch (_) { return null; }
}

/**
 * Deletes the pending session for a phone number.
 */
function clearSession(phoneNumber) {
  db.prepare('DELETE FROM whatsapp_sessions WHERE phone_number = ?').run(phoneNumber);
}

// ─── Default payment method ────────────────────────────────────────────────────

function getDefaultPaymentMethod(phone) {
  const row = db.prepare('SELECT default_payment_method FROM whatsapp_users WHERE phone_number = ?').get(phone);
  return row?.default_payment_method || null;
}

function setDefaultPaymentMethod(phone, method) {
  db.prepare('UPDATE whatsapp_users SET default_payment_method = ? WHERE phone_number = ?').run(method, phone);
}

// ─── Bot error logging ─────────────────────────────────────────────────────────

function logBotError(phone, userId, message, err) {
  try {
    db.prepare(
      'INSERT INTO bot_errors (phone, user_id, message, error, stack) VALUES (?, ?, ?, ?, ?)'
    ).run(
      phone   || null,
      userId  || null,
      message || null,
      err?.message || String(err),
      err?.stack   || null,
    );
  } catch (e) {
    console.error('[whatsapp] failed to log bot error:', e.message);
  }
}

module.exports = {
  initWhatsappTables,
  generateLinkCode,
  linkUser,
  getUser,
  savePendingSession,
  getPendingSession,
  clearSession,
  getDefaultPaymentMethod,
  setDefaultPaymentMethod,
  logBotError,
};
