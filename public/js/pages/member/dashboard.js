import { api } from '../../core/api.js';
import { icon, rupiah, statusBadge, animateCounter, errorState, formatDateTime, skeletonCards } from '../../core/ui.js';
import { setPageTitle } from '../../layout.js';
import { getState } from '../../core/state.js';
import { navigate } from '../../core/router.js';

export async function renderMemberDashboard(container) {
  const user = getState().user;
  setPageTitle(`Halo, ${user.name.split(' ')[0]}`, `Absen #${user.absen}`);

  container.innerHTML = skeletonCards(4);

  let data;
  try {
    data = await api.get('/dashboard/member');
  } catch {
    container.innerHTML = '';
    container.appendChild(errorState({ onRetry: () => renderMemberDashboard(container) }));
    return;
  }

  const { status, kas_minggu_ini, progress, recent_payments } = data;
  const pct = progress.weeks_total ? Math.round((progress.weeks_paid / progress.weeks_total) * 100) : 100;

  container.innerHTML = `
    <div class="card card-glass-strong fade-in" style="margin-bottom:16px;">
      <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:12px;">
        <div>
          <div class="stat-label">Status Kas</div>
          <div style="margin-top:6px;">${statusBadge(status.status)}</div>
        </div>
        <div style="text-align:right;">
          <div class="stat-label">Tunggakan</div>
          <div class="stat-value amount mono" data-counter="${status.arrears_amount}" data-currency="1" style="font-size:22px;color:${status.arrears_amount>0?'var(--rose)':'var(--text-1)'};">${rupiah(0)}</div>
          ${status.weeks_unpaid ? `<div class="text-3" style="font-size:11.5px;margin-top:2px;">${status.weeks_unpaid} minggu belum dibayar</div>` : ''}
        </div>
      </div>
      <div class="mt-16">
        <div class="flex justify-between text-3" style="font-size:11.5px;margin-bottom:6px;"><span>Progress pembayaran</span><span>${progress.weeks_paid}/${progress.weeks_total} minggu</span></div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    </div>

    <div class="grid grid-stats stagger">
      <div class="card stat-card card-hover">
        <div class="stat-glow"></div>
        <div class="stat-icon">${icon('weekly', 19)}</div>
        <div class="stat-label">Kas Minggu Ini</div>
        <div class="stat-value amount mono">${rupiah(kas_minggu_ini)}</div>
      </div>
      <div class="card stat-card card-hover">
        <div class="stat-glow"></div>
        <div class="stat-icon">${icon('income', 19)}</div>
        <div class="stat-label">Total Dibayar</div>
        <div class="stat-value amount mono" data-counter="${status.total_paid}" data-currency="1">${rupiah(0)}</div>
      </div>
    </div>

    <div class="card mt-16 fade-in">
      <div class="section-head"><h2>Riwayat Pembayaran Terbaru</h2><span class="hint" id="see-all-link" style="cursor:pointer;">Lihat semua</span></div>
      ${recent_payments.length ? `
        <div class="flex flex-col gap-8">
          ${recent_payments.slice(0, 5).map(p => `
            <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
              <div>
                <div style="font-size:13px;font-weight:600;">${p.payment_type}${p.week_number ? ` &middot; Minggu ${p.week_number}` : ''}</div>
                <div class="text-3" style="font-size:11.5px;">${formatDateTime(p.created_at)}</div>
              </div>
              <div class="mono" style="font-size:13.5px;color:var(--violet-soft);">+${rupiah(p.amount)}</div>
            </div>
          `).join('')}
        </div>
      ` : `<div class="text-3" style="font-size:13px;padding:12px 0;">Belum ada pembayaran tercatat.</div>`}
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

  container.querySelectorAll('[data-counter]').forEach(el => {
    animateCounter(el, Number(el.dataset.counter), { isCurrency: true });
  });

  container.querySelector('#see-all-link').addEventListener('click', () => navigate('/member/history'));
}
