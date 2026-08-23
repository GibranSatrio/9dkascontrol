const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const cashService = require('../services/cashService');

const router = express.Router();
router.use(requireAuth);

// GET /api/weekly-cash - overview list, most recent first.
router.get('/', asyncHandler(async (req, res) => {
  const weeks = cashService.getWeeklyCashList();
  res.json({ weeks, settings: cashService.getSettings() });
}));

// GET /api/weekly-cash/:week - admin detail: who paid / who hasn't for that week.
router.get('/:week', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const weekNumber = Number(req.params.week);
  const settings = cashService.getSettings();
  const { start, end } = cashService.weekRange(weekNumber, settings.period_start_date);
  const history = cashService.getRateHistory();
  const rate = cashService.rateForDate(start, history, settings);

  const members = cashService.getActiveMembers();
  const paidIds = cashService.paidMemberIdsForWeek(weekNumber);

  const detail = members.map(m => ({
    id: m.id,
    absen: m.absen,
    name: m.name,
    paid: paidIds.has(m.id)
  }));

  res.json({
    week_number: weekNumber,
    start_date: start,
    end_date: end,
    amount_per_member: rate,
    members: detail
  });
}));

module.exports = router;
