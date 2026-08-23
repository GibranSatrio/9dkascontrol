import { api } from '../../core/api.js';
import { icon, rupiah, animateCounter, errorState, skeletonCards, statusBadge } from '../../core/ui.js';
import { lineChart, barChart } from '../../core/charts.js';
import { setPageTitle, escapeHtml } from '../../layout.js';
import { openAddPaymentModal } from './paymentModal.js';
import { openAddExpenseModal } from './expenseModal.js';

export async function renderAdminDashboard(container) {
  setPageTitle('Dashboard', 'Ringkasan kas kelas 9D secara real-time');

  container.innerHTML = `
    ${skeletonCards(4)}
    <div class="mt-16"><div class="skel skel-card" style="height:280px;"></div></div>
  `;

  let data;
  try {
    data = await api.get('/dashboard/admin');
  } catch (err) {
    container.innerHTML = '';
    container.appendChild(errorState({ onRetry: () => renderAdminDashboard(container) }));
    return;
  }

  const { stats, charts, top_arrears } = data;

  container.innerHTML = `
    <div class="flex items-center gap-12 mt-8" style="margin-bottom:18px;flex-wrap:wrap;">
      <button class="btn btn-primary" id="qa-payment" type="button">${icon('plus', 15)} Tambah Pemasukan</button>
      <button class="btn btn-secondary" id="qa-expense" type="button">${icon('plus', 15)} Tambah Pengeluaran</button>
    </div>
    <div class="grid grid-stats stagger">
      ${statCard('wallet', 'Saldo Kas', stats.saldo_kas, true)}
      ${statCard('income', 'Total Pemasukan', stats.total_pemasukan, true)}
      ${statCard('expense', 'Total Pengeluaran', stats.total_pengeluaran, true)}
      ${statCard('members', 'Jumlah Member', stats.jumlah_member, false)}
    </div>

    <div class="grid grid-stats stagger mt-16">
      ${statCard('check-circle', 'Sudah Bayar Minggu Ini', stats.sudah_bayar_minggu_ini, false)}
      ${statCard('alert', 'Belum Bayar Minggu Ini', stats.belum_bayar_minggu_ini, false)}
      ${statCard('arrears', 'Total Tunggakan', stats.total_tunggakan, true)}
      ${statCard('weekly', 'Kas Minggu Ini', stats.kas_minggu_ini, true)}
    </div>

    <div class="grid grid-2 mt-16">
      <div class="card chart-card fade-in">
        <div class="section-head"><h2>Pemasukan vs Pengeluaran</h2><span class="hint">12 minggu terakhir</span></div>
        <div class="chart-wrap"><canvas id="chart-flow"></canvas></div>
      </div>
      <div class="card chart-card fade-in">
        <div class="section-head"><h2>Saldo Kas</h2><span class="hint">Akumulasi mingguan</span></div>
        <div class="chart-wrap"><canvas id="chart-balance"></canvas></div>
      </div>
    </div>

    <div class="grid grid-2 mt-16">
      <div class="card chart-card fade-in">
        <div class="section-head"><h2>Pembayaran Member</h2><span class="hint">Jumlah member bayar / minggu</span></div>
        <div class="chart-wrap"><canvas id="chart-payers"></canvas></div>
      </div>
      <div class="card fade-in">
        <div class="section-head"><h2>Tunggakan Terbesar</h2><span class="hint">${top_arrears.length} member</span></div>
        <div id="arrears-list"></div>
      </div>
    </div>

    <div class="apk-banner mt-16 fade-in">
      <div class="apk-phone">${icon('phone', 26)}</div>
      <div style="flex:1;min-width:220px;">
        <div class="apk-tag"><span class="pulse"></span> COMING SOON</div>
        <div style="font-family:var(--font-display);font-weight:600;font-size:15px;">9D CONTROL KAS Mobile</div>
        <div class="text-3" style="font-size:12.5px;margin-top:2px;">Versi APK sedang dipersiapkan. Tunggu update berikutnya.</div>
      </div>
    </div>
  `;

  container.querySelector('#qa-payment').addEventListener('click', () => {
    openAddPaymentModal({ onSuccess: () => renderAdminDashboard(container) });
  });
  container.querySelector('#qa-expense').addEventListener('click', () => {
    openAddExpenseModal({ onSuccess: () => renderAdminDashboard(container) });
  });

  // Animated counters
  container.querySelectorAll('[data-counter]').forEach(el => {
    const target = Number(el.dataset.counter);
    const isCurrency = el.dataset.currency === '1';
    animateCounter(el, target, { isCurrency });
  });

  // Charts
  lineChart(container.querySelector('#chart-flow'), charts.labels, [
    { name: 'Pemasukan', data: charts.pemasukan_per_minggu, color: '#a78bfa' },
    { name: 'Pengeluaran', data: charts.pengeluaran_per_minggu, color: '#e879f9' }
  ]);
  lineChart(container.querySelector('#chart-balance'), charts.labels, [
    { name: 'Saldo', data: charts.saldo_kas, color: '#fbbf24' }
  ]);
  barChart(container.querySelector('#chart-payers'), charts.labels, [
    { name: 'Sudah Bayar', data: charts.pembayaran_member, color: '#a78bfa' }
  ]);

  const arrearsList = container.querySelector('#arrears-list');
  if (!top_arrears.length) {
    arrearsList.innerHTML = `<div class="text-3" style="font-size:13px;padding:16px 2px;">Tidak ada tunggakan saat ini. Semua member lunas 🎉</div>`;
  } else {
    arrearsList.innerHTML = top_arrears.map(m => `
      <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div class="flex items-center gap-12">
          <div class="avatar" style="width:32px;height:32px;font-size:11px;">${m.absen}</div>
          <div>
            <div style="font-weight:600;font-size:13px;">${escapeHtml(m.name)}</div>
            <div class="text-3" style="font-size:11px;">${m.weeks_unpaid} minggu belum bayar</div>
          </div>
        </div>
        <div class="flex items-center gap-12">
          <div class="mono" style="font-size:13px;color:var(--rose);">${rupiah(m.arrears)}</div>
          ${statusBadge(m.status)}
        </div>
      </div>
    `).join('');
  }
}

function statCard(iconName, label, value, isCurrency) {
  return `
    <div class="card stat-card card-hover">
      <div class="stat-glow"></div>
      <div class="stat-icon">${icon(iconName, 19)}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value amount" data-counter="${value}" data-currency="${isCurrency ? '1' : '0'}">${isCurrency ? rupiah(0) : '0'}</div>
    </div>
  `;
}
