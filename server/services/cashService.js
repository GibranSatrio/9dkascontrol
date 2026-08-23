const db = require('../db');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUTCDate(dateStr) {
  // dateStr is 'YYYY-MM-DD'. Parse as UTC midnight to avoid timezone drift.
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function fmtDate(date) {
  return date.toISOString().slice(0, 10);
}

function getSettings() {
  const row = db.prepare('SELECT * FROM cash_settings WHERE id = 1').get();
  if (!row) throw new Error('Cash settings not initialized. Run the seed script first.');
  return row;
}

function getRateHistory() {
  return db.prepare('SELECT * FROM cash_rate_history ORDER BY effective_date ASC, id ASC').all();
}

/** Weekly rate that was/​is in effect on a given date (inclusive). */
function rateForDate(dateStr, history, settings) {
  let applicable = null;
  for (const h of history) {
    if (h.effective_date <= dateStr) {
      applicable = h;
    } else {
      break;
    }
  }
  return applicable ? applicable.new_amount : settings.weekly_amount;
}

/** 1-indexed week number that `dateStr` falls into, relative to period start. Returns 0 if before period start. */
function weekNumberForDate(dateStr, periodStartDate) {
  const start = toUTCDate(periodStartDate);
  const target = toUTCDate(dateStr);
  const diffDays = Math.floor((target.getTime() - start.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return 0;
  return Math.floor(diffDays / 7) + 1;
}

function weekRange(weekNumber, periodStartDate) {
  const start = addDays(toUTCDate(periodStartDate), (weekNumber - 1) * 7);
  const end = addDays(start, 6);
  return { start: fmtDate(start), end: fmtDate(end) };
}

/** How many weeks have started as of today (i.e. the current/latest week index). */
function currentWeekNumber(settings, asOfDateStr) {
  const today = asOfDateStr || fmtDate(new Date());
  return weekNumberForDate(today, settings.period_start_date);
}

function getActiveMembers() {
  return db.prepare("SELECT * FROM members WHERE role = 'MEMBER' AND active = 1 ORDER BY CAST(absen AS INTEGER), absen").all();
}

function totalPemasukan() {
  const row = db.prepare('SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE voided = 0').get();
  return row.total;
}

function totalPengeluaran() {
  const row = db.prepare('SELECT COALESCE(SUM(price),0) AS total FROM expenses WHERE voided = 0').get();
  return row.total;
}

function computeBalance() {
  return totalPemasukan() - totalPengeluaran();
}

/** Distinct member ids who made a valid weekly-cash payment for a given week number. */
function paidMemberIdsForWeek(weekNumber) {
  const rows = db.prepare(`
    SELECT DISTINCT member_id FROM payments
    WHERE voided = 0 AND payment_type = 'Kas Mingguan' AND week_number = ?
  `).all(weekNumber);
  return new Set(rows.map(r => r.member_id));
}

function weekTotalIncome(weekNumber) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total FROM payments
    WHERE voided = 0 AND payment_type = 'Kas Mingguan' AND week_number = ?
  `).get(weekNumber);
  return row.total;
}

/** Builds the list of weekly-cash summaries from week 1 up to the current week. */
function getWeeklyCashList() {
  const settings = getSettings();
  const history = getRateHistory();
  const activeMembers = getActiveMembers();
  const latestWeek = currentWeekNumber(settings);

  const weeks = [];
  for (let w = 1; w <= Math.max(latestWeek, 0); w++) {
    const { start, end } = weekRange(w, settings.period_start_date);
    const rate = rateForDate(start, history, settings);
    const paidIds = paidMemberIdsForWeek(w);
    const paidCount = [...paidIds].filter(id => activeMembers.some(m => m.id === id)).length;
    weeks.push({
      week_number: w,
      start_date: start,
      end_date: end,
      amount_per_member: rate,
      total_members: activeMembers.length,
      paid_count: paidCount,
      unpaid_count: Math.max(activeMembers.length - paidCount, 0),
      total_income: weekTotalIncome(w),
      is_current: w === latestWeek
    });
  }
  return weeks.reverse(); // most recent first
}

/** Full arrears (tunggakan) + status computation for a single member. */
function computeMemberCashStatus(memberId) {
  const settings = getSettings();
  const history = getRateHistory();
  const latestWeek = currentWeekNumber(settings);

  let unpaidWeeks = 0;
  let arrears = 0;
  let paidWeeks = 0;
  const unpaidWeekNumbers = [];

  for (let w = 1; w <= latestWeek; w++) {
    const { start } = weekRange(w, settings.period_start_date);
    const paidIds = paidMemberIdsForWeek(w);
    if (paidIds.has(memberId)) {
      paidWeeks++;
    } else {
      unpaidWeeks++;
      unpaidWeekNumbers.push(w);
      arrears += rateForDate(start, history, settings);
    }
  }

  let status;
  if (latestWeek === 0 || unpaidWeeks === 0) status = 'LUNAS';
  else if (paidWeeks === 0) status = 'BELUM_BAYAR';
  else if (unpaidWeeks === 1) status = 'SEBAGIAN';
  else status = 'MENUNGGAK';

  const totalPaidRow = db.prepare(`
    SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE voided = 0 AND member_id = ?
  `).get(memberId);

  const lastPaymentRow = db.prepare(`
    SELECT created_at FROM payments WHERE voided = 0 AND member_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(memberId);

  return {
    member_id: memberId,
    weeks_elapsed: latestWeek,
    weeks_paid: paidWeeks,
    weeks_unpaid: unpaidWeeks,
    unpaid_week_numbers: unpaidWeekNumbers,
    arrears_amount: arrears,
    total_paid: totalPaidRow.total,
    last_payment_at: lastPaymentRow ? lastPaymentRow.created_at : null,
    status
  };
}

module.exports = {
  fmtDate,
  getSettings,
  getRateHistory,
  rateForDate,
  weekNumberForDate,
  weekRange,
  currentWeekNumber,
  getActiveMembers,
  totalPemasukan,
  totalPengeluaran,
  computeBalance,
  paidMemberIdsForWeek,
  getWeeklyCashList,
  computeMemberCashStatus
};
