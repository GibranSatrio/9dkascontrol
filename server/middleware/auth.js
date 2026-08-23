const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET is missing or too short. Set a strong secret in your .env file.');
}

const COOKIE_NAME = 'kas_session';

function signToken(payload) {
  const hours = Number(process.env.SESSION_HOURS || 12);
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${hours}h` });
}

/** Verifies the JWT cookie, checks the session hasn't been revoked, and attaches req.user. */
function requireAuth(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
  if (!token) {
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Sesi tidak ditemukan. Silakan login kembali.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_SESSION', message: 'Sesi tidak valid atau kedaluwarsa. Silakan login kembali.' });
  }

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(decoded.sid);
  if (!session || session.revoked || new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'SESSION_EXPIRED', message: 'Sesi telah berakhir. Silakan login kembali.' });
  }

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(decoded.sub);
  if (!member || !member.active) {
    return res.status(401).json({ error: 'ACCOUNT_DISABLED', message: 'Akun tidak aktif.' });
  }

  req.user = { id: member.id, absen: member.absen, name: member.name, role: member.role };
  req.sessionId = decoded.sid;
  next();
}

/** Restricts a route to one or more roles. Backend is the source of truth - never rely on the frontend hiding menus. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Silakan login kembali.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Anda tidak memiliki akses untuk melakukan tindakan ini.' });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, COOKIE_NAME };
