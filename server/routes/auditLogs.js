const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireRole('ADMIN'));

// GET /api/audit-logs?action=&actor_id=&limit=
router.get('/', asyncHandler(async (req, res) => {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (req.query.action) {
    query += ' AND action = ?';
    params.push(String(req.query.action));
  }
  if (req.query.actor_id) {
    query += ' AND actor_id = ?';
    params.push(Number(req.query.actor_id));
  }

  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const logs = db.prepare(query).all(...params);
  res.json({ logs });
}));

module.exports = router;
