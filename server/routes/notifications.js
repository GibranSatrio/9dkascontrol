const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/audit');
const { assert, isNonEmptyString } = require('../utils/validate');
const notificationService = require('../services/notificationService');

const router = express.Router();
router.use(requireAuth);

// GET /api/notifications - the caller's own inbox.
router.get('/', asyncHandler(async (req, res) => {
  const items = notificationService.getForMember(req.user.id);
  const unread = notificationService.unreadCount(req.user.id);
  res.json({ notifications: items, unread_count: unread });
}));

// POST /api/notifications - admin only: send an announcement to all or specific members.
router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const body = String(req.body?.body || '').trim();
  const target = req.body?.target === 'SPECIFIC' ? 'SPECIFIC' : 'ALL';
  const memberIds = Array.isArray(req.body?.member_ids) ? req.body.member_ids.map(Number).filter(Number.isInteger) : [];

  assert(isNonEmptyString(title, 150), 'Judul notifikasi wajib diisi.', { title: 'required' });
  assert(isNonEmptyString(body, 1000), 'Isi notifikasi wajib diisi.', { body: 'required' });
  if (target === 'SPECIFIC') {
    assert(memberIds.length > 0, 'Pilih minimal satu member.', { member_ids: 'required' });
  }

  const notifId = notificationService.notifyMembers({
    broadcast: target === 'ALL',
    memberIds: target === 'SPECIFIC' ? memberIds : [],
    title,
    body,
    type: 'ANNOUNCEMENT',
    createdBy: req.user.id
  });

  logAction({
    actor: req.user,
    action: 'NOTIFICATION_SENT',
    targetType: 'notification',
    targetId: notifId,
    details: { title, target, member_ids: target === 'SPECIFIC' ? memberIds : 'ALL' },
    ip: req.ip
  });

  res.status(201).json({ ok: true, notification_id: notifId });
}));

// PATCH /api/notifications/:recipientId/read - mark a single notification as read.
router.patch('/:recipientId/read', asyncHandler(async (req, res) => {
  const ok = notificationService.markRead(req.user.id, Number(req.params.recipientId));
  res.json({ ok });
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  notificationService.markAllRead(req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
