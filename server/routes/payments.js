const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/audit');
const { assert, isNonEmptyString, isPositiveAmount, isPositiveInt, sanitizeText } = require('../utils/validate');
const { notifyMembers } = require('../services/notificationService');
const cashService = require('../services/cashService');

const router = express.Router();
router.use(requireAuth);

function formatRupiah(n) {
  return 'Rp' + Number(n).toLocaleString('id-ID');
}

// POST /api/payments (admin only) - the guided "Tambah Pemasukan" flow lands here as a single confirm step.
router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const memberId = Number(req.body?.member_id);
  const amount = Number(req.body?.amount);
  const paymentType = sanitizeText(req.body?.payment_type) || 'Kas Mingguan';
  const weekNumber = req.body?.week_number != null ? Number(req.body.week_number) : null;
  const periodLabel = sanitizeText(req.body?.period_label) || null;
  const note = sanitizeText(req.body?.note) || null;

  assert(isPositiveInt(memberId) && memberId > 0, 'Member wajib dipilih.', { member_id: 'required' });
  assert(isPositiveAmount(amount), 'Nominal pembayaran tidak valid.', { amount: 'invalid' });
  assert(isNonEmptyString(paymentType, 50), 'Jenis pembayaran wajib diisi.', { payment_type: 'required' });
  if (weekNumber !== null) assert(isPositiveInt(weekNumber) && weekNumber > 0, 'Nomor minggu tidak valid.', { week_number: 'invalid' });

  const member = db.prepare("SELECT * FROM members WHERE id = ? AND role = 'MEMBER'").get(memberId);
  if (!member) return res.status(404).json({ error: 'MEMBER_NOT_FOUND', message: 'Member tidak ditemukan.' });

  if (paymentType === 'Kas Mingguan' && weekNumber) {
    const dup = db.prepare(`
      SELECT id FROM payments WHERE member_id = ? AND payment_type = 'Kas Mingguan' AND week_number = ? AND voided = 0
    `).get(memberId, weekNumber);
    if (dup) {
      return res.status(409).json({ error: 'DUPLICATE_PAYMENT', message: `Minggu ke-${weekNumber} sudah tercatat lunas untuk member ini.` });
    }
  }

  const info = db.prepare(`
    INSERT INTO payments (member_id, amount, payment_type, week_number, period_label, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(memberId, amount, paymentType, weekNumber, periodLabel, note, req.user.id);

  logAction({
    actor: req.user,
    action: 'PAYMENT_ADDED',
    targetType: 'payment',
    targetId: info.lastInsertRowid,
    details: { member_id: memberId, amount, payment_type: paymentType, week_number: weekNumber },
    ip: req.ip
  });

  const settings = cashService.getSettings();
  if (settings.notif_on_payment) {
    notifyMembers({
      memberIds: [memberId],
      title: 'Pembayaran Kas Diterima',
      body: `Pembayaran ${paymentType}${weekNumber ? ` minggu ke-${weekNumber}` : ''} sebesar ${formatRupiah(amount)} telah dicatat.`,
      type: 'PAYMENT',
      createdBy: req.user.id
    });
  }

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ payment });
}));

// GET /api/payments - admin sees all (optionally filtered by member_id), member sees only their own.
router.get('/', asyncHandler(async (req, res) => {
  let query = 'SELECT p.*, m.name AS member_name, m.absen AS member_absen FROM payments p JOIN members m ON m.id = p.member_id WHERE 1=1';
  const params = [];

  if (req.user.role === 'ADMIN') {
    if (req.query.member_id) {
      query += ' AND p.member_id = ?';
      params.push(Number(req.query.member_id));
    }
  } else {
    query += ' AND p.member_id = ?';
    params.push(req.user.id);
  }

  if (req.query.week_number) {
    query += ' AND p.week_number = ?';
    params.push(Number(req.query.week_number));
  }

  query += ' ORDER BY p.created_at DESC LIMIT 500';
  const payments = db.prepare(query).all(...params);
  res.json({ payments });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const payment = db.prepare(`
    SELECT p.*, m.name AS member_name, m.absen AS member_absen FROM payments p
    JOIN members m ON m.id = p.member_id WHERE p.id = ?
  `).get(Number(req.params.id));
  if (!payment) return res.status(404).json({ error: 'NOT_FOUND', message: 'Transaksi tidak ditemukan.' });
  if (req.user.role !== 'ADMIN' && payment.member_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Anda tidak dapat melihat transaksi ini.' });
  }
  res.json({ payment });
}));

// PATCH /api/payments/:id/void - admin only, soft-delete with reason kept for audit trail.
router.patch('/:id/void', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const reason = sanitizeText(req.body?.reason);
  assert(isNonEmptyString(reason, 300), 'Alasan pembatalan wajib diisi.', { reason: 'required' });

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  if (!payment) return res.status(404).json({ error: 'NOT_FOUND', message: 'Transaksi tidak ditemukan.' });
  if (payment.voided) return res.status(400).json({ error: 'ALREADY_VOIDED', message: 'Transaksi sudah dibatalkan sebelumnya.' });

  db.prepare(`
    UPDATE payments SET voided = 1, voided_reason = ?, voided_at = datetime('now') WHERE id = ?
  `).run(reason, id);

  logAction({ actor: req.user, action: 'PAYMENT_VOIDED', targetType: 'payment', targetId: id, details: { reason }, ip: req.ip });
  res.json({ ok: true });
}));

module.exports = router;
