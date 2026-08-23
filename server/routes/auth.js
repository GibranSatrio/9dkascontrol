const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { signToken, requireAuth, COOKIE_NAME } = require('../middleware/auth');
const { logAction } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { assert, isNonEmptyString } = require('../utils/validate');

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const loginLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 8),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS', message: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
});

function cookieOptions() {
  const hours = Number(process.env.SESSION_HOURS || 12);
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: hours * 60 * 60 * 1000,
    path: '/'
  };
}

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { absen, password } = req.body || {};
  assert(isNonEmptyString(absen, 50), 'Nomor absen wajib diisi.', { absen: 'required' });
  assert(isNonEmptyString(password, 200), 'Password wajib diisi.', { password: 'required' });

  const cleanAbsen = String(absen).trim();
  const member = db.prepare('SELECT * FROM members WHERE absen = ?').get(cleanAbsen);

  const genericError = () => res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Nomor absen atau password salah.' });

  if (!member) {
    logAction({ actor: null, action: 'LOGIN_FAILED', targetType: 'member', targetId: cleanAbsen, details: { reason: 'not_found' }, ip: req.ip });
    return genericError();
  }

  if (member.locked_until && new Date(member.locked_until).getTime() > Date.now()) {
    logAction({ actor: member, action: 'LOGIN_BLOCKED', targetType: 'member', targetId: member.id, details: { reason: 'locked' }, ip: req.ip });
    return res.status(423).json({ error: 'ACCOUNT_LOCKED', message: 'Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi nanti.' });
  }

  if (!member.active) {
    return res.status(403).json({ error: 'ACCOUNT_DISABLED', message: 'Akun tidak aktif. Hubungi admin kelas.' });
  }

  const valid = await bcrypt.compare(password, member.password_hash);
  if (!valid) {
    const failedCount = member.failed_login_count + 1;
    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      db.prepare('UPDATE members SET failed_login_count = 0, locked_until = ? WHERE id = ?').run(lockedUntil, member.id);
      logAction({ actor: member, action: 'ACCOUNT_LOCKED', targetType: 'member', targetId: member.id, details: { until: lockedUntil }, ip: req.ip });
    } else {
      db.prepare('UPDATE members SET failed_login_count = ? WHERE id = ?').run(failedCount, member.id);
    }
    logAction({ actor: member, action: 'LOGIN_FAILED', targetType: 'member', targetId: member.id, details: { reason: 'bad_password' }, ip: req.ip });
    return genericError();
  }

  // Success - reset failure counter, create a revocable session, sign JWT.
  db.prepare('UPDATE members SET failed_login_count = 0, locked_until = NULL WHERE id = ?').run(member.id);

  const sessionId = crypto.randomUUID();
  const hours = Number(process.env.SESSION_HOURS || 12);
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO sessions (id, member_id, user_agent, ip, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, member.id, req.get('user-agent') || null, req.ip, expiresAt);

  const token = signToken({ sub: member.id, sid: sessionId, role: member.role });
  res.cookie(COOKIE_NAME, token, cookieOptions());

  logAction({ actor: member, action: 'LOGIN_SUCCESS', targetType: 'member', targetId: member.id, ip: req.ip });

  res.json({
    user: { id: member.id, absen: member.absen, name: member.name, role: member.role }
  });
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  db.prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(req.sessionId);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  logAction({ actor: req.user, action: 'LOGOUT', targetType: 'member', targetId: req.user.id, ip: req.ip });
  res.json({ ok: true });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

module.exports = router;
