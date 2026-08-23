const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/audit');
const { assert, isNonEmptyString, isPositiveAmount, isValidDateStr, sanitizeText } = require('../utils/validate');
const { notifyMembers } = require('../services/notificationService');
const cashService = require('../services/cashService');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

function formatRupiah(n) {
  return 'Rp' + Number(n).toLocaleString('id-ID');
}

// POST /api/expenses (admin only)
router.post('/', requireRole('ADMIN'), upload.single('receipt'), asyncHandler(async (req, res) => {
  const itemName = sanitizeText(req.body?.item_name);
  const price = Number(req.body?.price);
  const reason = sanitizeText(req.body?.reason) || null;
  const expenseDate = sanitizeText(req.body?.expense_date);
  const notifyTarget = (req.body?.notify_target === 'SPECIFIC') ? 'SPECIFIC' : 'ALL';
  let specificMemberIds = [];
  if (notifyTarget === 'SPECIFIC') {
    try {
      specificMemberIds = JSON.parse(req.body?.member_ids || '[]').map(Number).filter(Number.isInteger);
    } catch {
      specificMemberIds = [];
    }
  }

  assert(isNonEmptyString(itemName, 150), 'Nama barang wajib diisi.', { item_name: 'required' });
  assert(isPositiveAmount(price), 'Harga tidak valid.', { price: 'invalid' });
  assert(isValidDateStr(expenseDate), 'Tanggal tidak valid.', { expense_date: 'invalid' });

  const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;

  const info = db.prepare(`
    INSERT INTO expenses (item_name, price, reason, expense_date, receipt_path, notify_target, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(itemName, price, reason, expenseDate, receiptPath, notifyTarget, req.user.id);

  const expenseId = info.lastInsertRowid;

  if (notifyTarget === 'SPECIFIC' && specificMemberIds.length) {
    const insertLink = db.prepare('INSERT INTO expense_notify_members (expense_id, member_id) VALUES (?, ?)');
    const tx = db.transaction(() => {
      for (const mid of specificMemberIds) insertLink.run(expenseId, mid);
    });
    tx();
  }

  logAction({
    actor: req.user,
    action: 'EXPENSE_ADDED',
    targetType: 'expense',
    targetId: expenseId,
    details: { item_name: itemName, price, notify_target: notifyTarget },
    ip: req.ip
  });

  const notifBody = `${itemName} - ${formatRupiah(price)}${reason ? ` (${reason})` : ''}`;
  const settings = cashService.getSettings();
  if (settings.notif_on_expense) {
    if (notifyTarget === 'ALL') {
      notifyMembers({ broadcast: true, title: 'Pengeluaran Baru', body: notifBody, type: 'EXPENSE', createdBy: req.user.id });
    } else if (specificMemberIds.length) {
      notifyMembers({ memberIds: specificMemberIds, title: 'Pengeluaran Baru', body: notifBody, type: 'EXPENSE', createdBy: req.user.id });
    }
  }

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
  res.status(201).json({ expense });
}));

// GET /api/expenses - all authenticated users can view the expense log (transparency for the class).
router.get('/', asyncHandler(async (req, res) => {
  const expenses = db.prepare(`
    SELECT e.*, m.name AS created_by_name FROM expenses e
    JOIN members m ON m.id = e.created_by
    ORDER BY e.expense_date DESC, e.created_at DESC LIMIT 500
  `).all();
  res.json({ expenses });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const expense = db.prepare(`
    SELECT e.*, m.name AS created_by_name FROM expenses e
    JOIN members m ON m.id = e.created_by WHERE e.id = ?
  `).get(Number(req.params.id));
  if (!expense) return res.status(404).json({ error: 'NOT_FOUND', message: 'Pengeluaran tidak ditemukan.' });
  const notifiedMembers = db.prepare(`
    SELECT m.id, m.absen, m.name FROM expense_notify_members enm JOIN members m ON m.id = enm.member_id WHERE enm.expense_id = ?
  `).all(expense.id);
  res.json({ expense, notified_members: notifiedMembers });
}));

router.patch('/:id/void', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const reason = sanitizeText(req.body?.reason);
  assert(isNonEmptyString(reason, 300), 'Alasan pembatalan wajib diisi.', { reason: 'required' });

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  if (!expense) return res.status(404).json({ error: 'NOT_FOUND', message: 'Pengeluaran tidak ditemukan.' });
  if (expense.voided) return res.status(400).json({ error: 'ALREADY_VOIDED', message: 'Sudah dibatalkan sebelumnya.' });

  db.prepare(`UPDATE expenses SET voided = 1, voided_reason = ?, voided_at = datetime('now') WHERE id = ?`).run(reason, id);
  logAction({ actor: req.user, action: 'EXPENSE_VOIDED', targetType: 'expense', targetId: id, details: { reason }, ip: req.ip });
  res.json({ ok: true });
}));

module.exports = router;
