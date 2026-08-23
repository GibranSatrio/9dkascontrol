const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/audit');
const { assert, isPositiveAmount, isNonEmptyString, isValidDateStr, sanitizeText } = require('../utils/validate');
const cashService = require('../services/cashService');
const notificationService = require('../services/notificationService');

const router = express.Router();

// GET /api/settings/public - unauthenticated, used to brand the login screen.
router.get('/public', asyncHandler(async (req, res) => {
  const settings = cashService.getSettings();
  res.json({ app_name: settings.app_name, class_name: settings.class_name });
}));

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', asyncHandler(async (req, res) => {
  const settings = cashService.getSettings();
  const history = cashService.getRateHistory();
  res.json({ settings, rate_history: history.reverse() });
}));

// PATCH /api/settings/cash - change the weekly nominal. Old transactions are never rewritten.
router.patch('/cash', asyncHandler(async (req, res) => {
  const newAmount = Number(req.body?.weekly_amount);
  const effectiveDate = sanitizeText(req.body?.effective_date) || cashService.fmtDate(new Date());

  assert(isPositiveAmount(newAmount), 'Nominal kas tidak valid.', { weekly_amount: 'invalid' });
  assert(isValidDateStr(effectiveDate), 'Tanggal berlaku tidak valid.', { effective_date: 'invalid' });

  const settings = cashService.getSettings();
  if (newAmount === settings.weekly_amount) {
    return res.status(400).json({ error: 'NO_CHANGE', message: 'Nominal baru sama dengan nominal saat ini.' });
  }

  const oldAmount = settings.weekly_amount;

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO cash_rate_history (old_amount, new_amount, effective_date, changed_by) VALUES (?, ?, ?, ?)')
      .run(oldAmount, newAmount, effectiveDate, req.user.id);
    db.prepare("UPDATE cash_settings SET weekly_amount = ?, updated_at = datetime('now') WHERE id = 1").run(newAmount);
  });
  tx();

  logAction({
    actor: req.user,
    action: 'CASH_RATE_CHANGED',
    targetType: 'cash_settings',
    targetId: 1,
    details: { old_amount: oldAmount, new_amount: newAmount, effective_date: effectiveDate },
    ip: req.ip
  });

  const fmt = n => 'Rp' + Number(n).toLocaleString('id-ID');
  notificationService.notifyMembers({
    broadcast: true,
    title: 'Nominal Kas Berubah',
    body: `Kas mingguan berubah dari ${fmt(oldAmount)} menjadi ${fmt(newAmount)}. Berlaku mulai ${effectiveDate}.`,
    type: 'SYSTEM',
    createdBy: req.user.id
  });

  res.json({ settings: cashService.getSettings() });
}));

// PATCH /api/settings/app - class/app branding and notification toggles.
router.patch('/app', asyncHandler(async (req, res) => {
  const updates = {};
  const changes = {};

  if (req.body?.class_name !== undefined) {
    const v = sanitizeText(req.body.class_name);
    assert(isNonEmptyString(v, 50), 'Nama kelas tidak valid.', { class_name: 'invalid' });
    updates.class_name = v; changes.class_name = v;
  }
  if (req.body?.app_name !== undefined) {
    const v = sanitizeText(req.body.app_name);
    assert(isNonEmptyString(v, 80), 'Nama aplikasi tidak valid.', { app_name: 'invalid' });
    updates.app_name = v; changes.app_name = v;
  }
  if (req.body?.notif_on_payment !== undefined) {
    updates.notif_on_payment = req.body.notif_on_payment ? 1 : 0; changes.notif_on_payment = !!req.body.notif_on_payment;
  }
  if (req.body?.notif_on_expense !== undefined) {
    updates.notif_on_expense = req.body.notif_on_expense ? 1 : 0; changes.notif_on_expense = !!req.body.notif_on_expense;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'NO_CHANGES', message: 'Tidak ada perubahan yang dikirim.' });
  }

  const setClause = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE cash_settings SET ${setClause}, updated_at = datetime('now') WHERE id = 1`).run(updates);

  logAction({ actor: req.user, action: 'SETTINGS_UPDATED', targetType: 'cash_settings', targetId: 1, details: changes, ip: req.ip });

  res.json({ settings: cashService.getSettings() });
}));

module.exports = router;
