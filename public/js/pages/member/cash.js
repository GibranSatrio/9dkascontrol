import { api } from '../../core/api.js';
import { icon, rupiah, statusBadge, formatDateShort, errorState, skeletonRows } from '../../core/ui.js';
import { setPageTitle } from '../../layout.js';

export async function renderMemberCash(container) {
  setPageTitle('Kas Saya', 'Status dan riwayat kas mingguan kamu');
  container.innerHTML = skeletonRows(6);

  let dash, weekly;
  try {
    [dash, weekly] = await Promise.all([api.get('/dashboard/member'), api.get('/weekly-cash')]);
  } catch {
    container.innerHTML = '';
    container.appendChild(errorState({ onRetry: () => renderMemberCash(container) }));
    return;
  }

  const { status } = dash;
  const unpaidSet = new Set(status.unpaid_week_numbers || []);

  container.innerHTML = `
    <div class="grid grid-2 stagger">
      <div class="card card-glass-strong">
        <div class="stat-label">Status Kas Kamu</div>
        <div style="margin-top:8px;">${statusBadge(status.status)}</div>
        <div class="mt-16 stat-label">Tunggakan Kas</div>
        <div class="stat-value amount mono" style="font-size:24px;color:${status.arrears_amount>0?'var(--rose)':'var(--text-1)'};">${rupiah(status.arrears_amount)}</div>
        <div class="text-3 mt-8" style="font-size:12px;">${status.weeks_unpaid} minggu belum dibayar dari ${status.weeks_elapsed} minggu berjalan</div>
      </div>
      <div class="card">
        <div class="stat-label">Total Kas Dibayar</div>
        <div class="stat-value amount mono" style="font-size:24px;">${rupiah(status.total_paid)}</div>
        <div class="text-3 mt-8" style="font-size:12px;">Pembayaran terakhir: ${status.last_payment_at ? formatDateShort(status.last_payment_at) : 'Belum pernah bayar'}</div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-head"><h2>Rincian per Minggu</h2><span class="hint">${weekly.weeks.length} minggu</span></div>
      <div class="flex flex-col gap-8">
        ${weekly.weeks.map(w => {
          const isPaid = w.week_number <= status.weeks_elapsed && !unpaidSet.has(w.week_number);
          return `
          <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
            <div class="flex items-center gap-12">
              <div class="stat-icon" style="margin-bottom:0;width:32px;height:32px;">${icon(isPaid ? 'check-circle' : 'alert', 16)}</div>
              <div>
                <div style="font-size:13px;font-weight:600;">Minggu ${w.week_number}${w.is_current ? ' (Berjalan)' : ''}</div>
                <div class="text-3" style="font-size:11px;">${formatDateShort(w.start_date)} - ${formatDateShort(w.end_date)}</div>
              </div>
            </div>
            <div class="flex items-center gap-12">
              <span class="mono" style="font-size:12.5px;">${rupiah(w.amount_per_member)}</span>
              <span class="badge ${isPaid ? 'badge-lunas' : 'badge-menunggak'}">${isPaid ? 'Lunas' : 'Belum'}</span>
            </div>
          </div>
        `;
        }).join('')}
      </div>
    </div>
  `;
}
