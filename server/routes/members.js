const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/audit');
const cashService = require('../services/cashService');
const { assert, isNonEmptyString, sanitizeText } = require('../utils/validate');

const router = express.Router();
router.use(requireAuth);

function memberWithStatus(member) {
  const status = cashService.computeMemberCashStatus(member.id);
  return {
    id: member.id,
    absen: member.absen,
    name: member.name,
    role: member.role,
    active: !!member.active,
    created_at: member.created_at,
    status: status.status,
    total_paid: status.total_paid,
    arrears_amount: status.arrears_amount,
    weeks_unpaid: status.weeks_unpaid,
    unpaid_week_numbers: status.unpaid_week_numbers,
    weeks_elapsed: status.weeks_elapsed,
    last_payment_at: status.last_payment_at
  };
}

// GET /api/members?search=&status=  (admin only - full roster with search/filter)
router.get('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  let members = db.prepare("SELECT * FROM members WHERE role = 'MEMBER' ORDER BY CAST(absen AS INTEGER), absen").all();

  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    members = members.filter(m => m.absen.toLowerCase().includes(q) || m.name.toLowerCase().includes(q));
  }

  let result = members.map(memberWithStatus);

  if (status && String(status).trim()) {
    const s = String(status).trim().toUpperCase();
    result = result.filter(m => m.status === s);
  }

  res.json({ members: result });
}));

// GET /api/members/:id (admin can view any member; member can only view self)
router.get('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.role !== 'ADMIN' && req.user.id !== id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Anda hanya dapat melihat data Anda sendiri.' });
  }
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!member) return res.status(404).json({ error: 'NOT_FOUND', message: 'Member tidak ditemukan.' });
  res.json({ member: memberWithStatus(member) });
}));

// POST /api/members (admin only - add new member account)
router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const absen = sanitizeText(req.body?.absen);
  const name = sanitizeText(req.body?.name);
  const password = req.body?.password;

  assert(isNonEmptyString(absen, 20), 'Nomor absen wajib diisi.', { absen: 'required' });
  assert(isNonEmptyString(name, 100), 'Nama wajib diisi.', { name: 'required' });
  assert(isNonEmptyString(password, 200) && password.length >= 6, 'Password minimal 6 karakter.', { password: 'min_length' });

  const existing = db.prepare('SELECT id FROM members WHERE absen = ?').get(absen);
  if (existing) {
    return res.status(409).json({ error: 'ABSEN_TAKEN', message: 'Nomor absen sudah digunakan.' });
  }

  const hash = await bcrypt.hash(password, 12);
  const info = db.prepare(`
    INSERT INTO members (absen, name, role, password_hash, active) VALUES (?, ?, 'MEMBER', ?, 1)
  `).run(absen, name, hash);

  logAction({ actor: req.user, action: 'MEMBER_CREATED', targetType: 'member', targetId: info.lastInsertRowid, details: { absen, name }, ip: req.ip });

  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ member: memberWithStatus(member) });
}));

// PATCH /api/members/:id (admin only - edit name/active status/reset password)
router.patch('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!member) return res.status(404).json({ error: 'NOT_FOUND', message: 'Member tidak ditemukan.' });

  const updates = {};
  const changes = {};

  if (req.body?.name !== undefined) {
    const name = sanitizeText(req.body.name);
    assert(isNonEmptyString(name, 100), 'Nama tidak valid.', { name: 'invalid' });
    updates.name = name;
    changes.name = name;
  }
  if (req.body?.active !== undefined) {
    updates.active = req.body.active ? 1 : 0;
    changes.active = !!req.body.active;
  }
  if (req.body?.password) {
    assert(String(req.body.password).length >= 6, 'Password minimal 6 karakter.', { password: 'min_length' });
    updates.password_hash = await bcrypt.hash(req.body.password, 12);
    changes.password = 'reset';
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'NO_CHANGES', message: 'Tidak ada perubahan yang dikirim.' });
  }

  const setClause = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE members SET ${setClause} WHERE id = @id`).run({ ...updates, id });

  logAction({ actor: req.user, action: 'MEMBER_UPDATED', targetType: 'member', targetId: id, details: changes, ip: req.ip });

  const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  res.json({ member: memberWithStatus(updated) });
}));

module.exports = router;
