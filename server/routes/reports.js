const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../utils/audit');
const { assert, isNonEmptyString, sanitizeText } = require('../utils/validate');
const notificationService = require('../services/notificationService');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

const VALID_STATUSES = new Set(['OPEN', 'DIPROSES', 'SELESAI', 'DITOLAK']);
const VALID_CATEGORIES = new Set(['Pembayaran', 'Nominal', 'Update', 'Pengeluaran', 'Akun', 'Lainnya']);

// GET /api/reports - member sees own reports; admin sees all (optionally filtered by status).
router.get('/', asyncHandler(async (req, res) => {
  let query = `
    SELECT r.*, m.name AS member_name, m.absen AS member_absen FROM reports r
    JOIN members m ON m.id = r.member_id WHERE 1=1
  `;
  const params = [];

  if (req.user.role === 'ADMIN') {
    if (req.query.status) {
      query += ' AND r.status = ?';
      params.push(String(req.query.status).toUpperCase());
    }
  } else {
    query += ' AND r.member_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY r.created_at DESC LIMIT 300';
  const reports = db.prepare(query).all(...params);
  res.json({ reports });
}));

// POST /api/reports - member creates a report; admin may also file one on behalf of the class if needed.
router.post('/', upload.single('attachment'), asyncHandler(async (req, res) => {
  const category = sanitizeText(req.body?.category);
  const title = sanitizeText(req.body?.title);
  const description = sanitizeText(req.body?.description) || null;

  assert(VALID_CATEGORIES.has(category), 'Kategori tidak valid.', { category: 'invalid' });
  assert(isNonEmptyString(title, 150), 'Judul laporan wajib diisi.', { title: 'required' });

  const attachmentPath = req.file ? `/uploads/${req.file.filename}` : null;

  const info = db.prepare(`
    INSERT INTO reports (member_id, category, title, description, attachment_path, status)
    VALUES (?, ?, ?, ?, ?, 'OPEN')
  `).run(req.user.id, category, title, description, attachmentPath);

  logAction({ actor: req.user, action: 'REPORT_CREATED', targetType: 'report', targetId: info.lastInsertRowid, details: { category, title }, ip: req.ip });

  // Notify all active admins so they see it promptly.
  const admins = db.prepare("SELECT id FROM members WHERE role = 'ADMIN' AND active = 1").all().map(a => a.id);
  if (admins.length) {
    notificationService.notifyMembers({
      memberIds: admins,
      title: 'Report Baru dari Member',
      body: `${req.user.name} (absen ${req.user.absen}) melaporkan: ${title}`,
      type: 'REPORT',
      createdBy: req.user.id
    });
  }

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ report });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const report = db.prepare(`
    SELECT r.*, m.name AS member_name, m.absen AS member_absen FROM reports r
    JOIN members m ON m.id = r.member_id WHERE r.id = ?
  `).get(Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'NOT_FOUND', message: 'Report tidak ditemukan.' });
  if (req.user.role !== 'ADMIN' && report.member_id !== req.user.id) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Anda tidak dapat melihat report ini.' });
  }
  res.json({ report });
}));

// PATCH /api/reports/:id - admin only: reply and/or change status.
router.patch('/:id', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  if (!report) return res.status(404).json({ error: 'NOT_FOUND', message: 'Report tidak ditemukan.' });

  const updates = {};
  if (req.body?.status !== undefined) {
    const status = String(req.body.status).toUpperCase();
    assert(VALID_STATUSES.has(status), 'Status tidak valid.', { status: 'invalid' });
    updates.status = status;
  }
  if (req.body?.admin_reply !== undefined) {
    updates.admin_reply = sanitizeText(req.body.admin_reply);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'NO_CHANGES', message: 'Tidak ada perubahan yang dikirim.' });
  }
  updates.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const setClause = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE reports SET ${setClause} WHERE id = @id`).run({ ...updates, id });

  logAction({ actor: req.user, action: 'REPORT_UPDATED', targetType: 'report', targetId: id, details: updates, ip: req.ip });

  notificationService.notifyMembers({
    memberIds: [report.member_id],
    title: 'Status Report Diperbarui',
    body: `Report "${report.title}" sekarang berstatus ${updates.status || report.status}.`,
    type: 'REPORT',
    createdBy: req.user.id
  });

  const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
  res.json({ report: updated });
}));

module.exports = router;
