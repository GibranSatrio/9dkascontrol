const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const cashService = require('../services/cashService');

const router = express.Router();
router.use(requireAuth);

router.get('/admin', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const settings = cashService.getSettings();
  const totalPemasukan = cashService.totalPemasukan();
  const totalPengeluaran = cashService.totalPengeluaran();
  const saldo = totalPemasukan - totalPengeluaran;

  const activeMembers = cashService.getActiveMembers();
  const currentWeek = cashService.currentWeekNumber(settings);
  const paidThisWeek = currentWeek > 0 ? cashService.paidMemberIdsForWeek(currentWeek).size : 0;
  const belumBayar = Math.max(activeMembers.length - paidThisWeek, 0);

  let totalTunggakan = 0;
  const arrearsByMember = [];
  for (const m of activeMembers) {
    const status = cashService.computeMemberCashStatus(m.id);
    totalTunggakan += status.arrears_amount;
    if (status.arrears_amount > 0) {
      arrearsByMember.push({ id: m.id, absen: m.absen, name: m.name, arrears: status.arrears_amount, weeks_unpaid: status.weeks_unpaid, status: status.status });
    }
  }
  arrearsByMember.sort((a, b) => b.arrears - a.arrears);

  const weeks = cashService.getWeeklyCashList().slice(0, 12).reverse(); // chronological for charting

  const expensesByWeek = weeks.map(w => {
    const row = db.prepare(`
      SELECT COALESCE(SUM(price),0) AS total FROM expenses
      WHERE voided = 0 AND expense_date BETWEEN ? AND ?
    `).get(w.start_date, w.end_date);
    return row.total;
  });

  let runningBalance = 0;
  const balanceSeries = weeks.map((w, i) => {
    runningBalance += w.total_income - expensesByWeek[i];
    return runningBalance;
  });

  res.json({
    stats: {
      saldo_kas: saldo,
      total_pemasukan: totalPemasukan,
      total_pengeluaran: totalPengeluaran,
      jumlah_member: activeMembers.length,
      sudah_bayar_minggu_ini: paidThisWeek,
      belum_bayar_minggu_ini: belumBayar,
      total_tunggakan: totalTunggakan,
      kas_minggu_ini: currentWeek > 0 ? weeks[weeks.length - 1]?.amount_per_member ?? settings.weekly_amount : settings.weekly_amount,
      current_week: currentWeek
    },
    charts: {
      labels: weeks.map(w => `M${w.week_number}`),
      pemasukan_per_minggu: weeks.map(w => w.total_income),
      pengeluaran_per_minggu: expensesByWeek,
      saldo_kas: balanceSeries,
      pembayaran_member: weeks.map(w => w.paid_count),
      tunggakan_member: weeks.map(w => w.unpaid_count)
    },
    top_arrears: arrearsByMember.slice(0, 10),
    settings
  });
}));

router.get('/member', asyncHandler(async (req, res) => {
  const status = cashService.computeMemberCashStatus(req.user.id);
  const settings = cashService.getSettings();
  const history = cashService.getRateHistory();
  const currentWeek = cashService.currentWeekNumber(settings);
  const currentRate = currentWeek > 0
    ? cashService.rateForDate(cashService.weekRange(currentWeek, settings.period_start_date).start, history, settings)
    : settings.weekly_amount;

  const recentPayments = db.prepare(`
    SELECT * FROM payments WHERE member_id = ? AND voided = 0 ORDER BY created_at DESC LIMIT 10
  `).all(req.user.id);

  res.json({
    status,
    kas_minggu_ini: currentRate,
    current_week: currentWeek,
    progress: {
      weeks_paid: status.weeks_paid,
      weeks_total: status.weeks_elapsed
    },
    recent_payments: recentPayments
  });
}));

module.exports = router;
