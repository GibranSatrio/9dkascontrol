require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

function daysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function seedIfEmpty() {
  const memberCount = db.prepare('SELECT COUNT(*) AS c FROM members').get().c;
  if (memberCount > 0) {
    return false; // already seeded, do nothing (idempotent on every startup)
  }

  console.log('[seed] Database kosong terdeteksi. Membuat data awal...');

  const adminAbsen = process.env.ADMIN_ABSEN || 'ADMIN';
  const adminName = process.env.ADMIN_NAME || 'Wali Kelas Admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'change_this_admin_password';
  const demoPassword = process.env.DEMO_MEMBER_PASSWORD || 'kas9d2026';

  const adminHash = bcrypt.hashSync(adminPassword, 12);
  const demoHash = bcrypt.hashSync(demoPassword, 12);

  const insertMember = db.prepare(`
    INSERT INTO members (absen, name, role, password_hash, active) VALUES (?, ?, ?, ?, 1)
  `);

  const adminInfo = insertMember.run(adminAbsen, adminName, 'ADMIN', adminHash);
  const adminId = adminInfo.lastInsertRowid;

  const demoMembers = [
    ['01', 'Andi Pratama'],
    ['02', 'Bima Saputra'],
    ['03', 'Citra Lestari'],
    ['04', 'Dinda Maharani'],
    ['05', 'Fajar Ramadhan'],
    ['18', 'Gibran Dwi Satrio']
  ];

  const memberIds = {};
  for (const [absen, name] of demoMembers) {
    const info = insertMember.run(absen, name, 'MEMBER', demoHash);
    memberIds[absen] = info.lastInsertRowid;
  }

  const periodStart = process.env.PERIOD_START_DATE || daysAgo(28);
  const weeklyAmount = Number(process.env.WEEKLY_CASH_AMOUNT || 10000);
  const className = process.env.CLASS_NAME || '9D';
  const appName = process.env.APP_NAME || '9D CONTROL KAS';

  db.prepare(`
    INSERT INTO cash_settings (id, class_name, app_name, weekly_amount, period_type, period_start_date)
    VALUES (1, ?, ?, ?, 'weekly', ?)
  `).run(className, appName, weeklyAmount, periodStart);

  db.prepare(`
    INSERT INTO cash_rate_history (old_amount, new_amount, effective_date, changed_by) VALUES (NULL, ?, ?, ?)
  `).run(weeklyAmount, periodStart, adminId);

  // Demo payments: give a realistic, varied picture (some fully paid, some behind).
  const insertPayment = db.prepare(`
    INSERT INTO payments (member_id, amount, payment_type, week_number, period_label, note, created_by, created_at)
    VALUES (?, ?, 'Kas Mingguan', ?, ?, ?, ?, ?)
  `);

  const paymentPlan = {
    '01': [1, 2, 3],
    '02': [1, 2, 3],
    '03': [1, 3],
    '04': [1],
    '05': [],
    '18': [1, 2]
  };

  for (const [absen, weeks] of Object.entries(paymentPlan)) {
    for (const w of weeks) {
      insertPayment.run(
        memberIds[absen], weeklyAmount, w, `Minggu ke-${w}`,
        'Pembayaran kas rutin', adminId, `${daysAgo(28 - (w - 1) * 7)} 09:00:00`
      );
    }
  }

  const insertExpense = db.prepare(`
    INSERT INTO expenses (item_name, price, reason, expense_date, notify_target, created_by, created_at)
    VALUES (?, ?, ?, ?, 'ALL', ?, ?)
  `);
  insertExpense.run('Sapu dan Serokan', 25000, 'Membeli alat kebersihan kelas', daysAgo(20), adminId, `${daysAgo(20)} 10:00:00`);
  insertExpense.run('Spidol Whiteboard', 18000, 'Persediaan spidol habis', daysAgo(10), adminId, `${daysAgo(10)} 10:00:00`);

  const insertNotif = db.prepare(`INSERT INTO notifications (title, body, type, created_by, created_at) VALUES (?, ?, ?, ?, ?)`);
  const insertRecipient = db.prepare(`INSERT INTO notification_recipients (notification_id, member_id, read_at) VALUES (?, ?, ?)`);

  const welcomeInfo = insertNotif.run('Selamat Datang di 9D CONTROL KAS', 'Sistem manajemen kas kelas 9D kini aktif. Pantau pembayaran dan tunggakan kas kamu di sini.', 'SYSTEM', adminId, `${daysAgo(28)} 08:00:00`);
  for (const id of Object.values(memberIds)) {
    insertRecipient.run(welcomeInfo.lastInsertRowid, id, null);
  }

  const expenseNotifInfo = insertNotif.run('Pengeluaran Baru', 'Sapu dan Serokan - Rp25.000 (Membeli alat kebersihan kelas)', 'EXPENSE', adminId, `${daysAgo(20)} 10:05:00`);
  for (const id of Object.values(memberIds)) {
    insertRecipient.run(expenseNotifInfo.lastInsertRowid, id, null);
  }

  // A demo report from Gibran so the Report Center has something to show.
  db.prepare(`
    INSERT INTO reports (member_id, category, title, description, status, created_at, updated_at)
    VALUES (?, 'Pembayaran', 'Pembayaran minggu ke-2 belum tercatat', 'Saya sudah bayar tunai minggu lalu tapi belum muncul di riwayat.', 'DIPROSES', ?, ?)
  `).run(memberIds['18'], `${daysAgo(5)} 14:00:00`, `${daysAgo(4)} 09:00:00`);

  db.prepare(`
    INSERT INTO audit_logs (actor_id, actor_name, action, target_type, target_id, details, created_at)
    VALUES (?, ?, 'SYSTEM_SEEDED', 'system', NULL, ?, ?)
  `).run(adminId, `${adminAbsen} - ${adminName}`, JSON.stringify({ note: 'Initial demo data created' }), `${daysAgo(28)} 07:00:00`);

  console.log('[seed] Selesai. Akun demo:');
  console.log(`  ADMIN  -> absen: ${adminAbsen} (password dari .env ADMIN_PASSWORD)`);
  console.log(`  MEMBER -> absen: 18 (Gibran Dwi Satrio), password: ${demoPassword}`);
  return true;
}

if (require.main === module) {
  seedIfEmpty();
  process.exit(0);
}

module.exports = { seedIfEmpty };
