import { api } from '../../core/api.js';
import { icon, rupiah, statusBadge, errorState, emptyState, skeletonRows, openDrawer } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';
import { openAddPaymentModal } from './paymentModal.js';

export async function renderAdminArrears(container) {
  setPageTitle('Tunggakan', 'Member dengan kas yang belum lunas');
  container.innerHTML = skeletonRows(6);

  let members;
  try {
    const res = await api.get('/members');
    members = res.members;
  } catch {
    container.innerHTML = '';
    container.appendChild(errorState({ onRetry: () => renderAdminArrears(container) }));
    return;
  }

  const arrears = members.filter(m => m.arrears_amount > 0).sort((a, b) => b.arrears_amount - a.arrears_amount);
  const totalArrears = arrears.reduce((s, m) => s + m.arrears_amount, 0);

  if (!arrears.length) {
    container.innerHTML = '';
    container.appendChild(emptyState({ icon: 'arrears', title: 'Tidak Ada Tunggakan', desc: 'Semua member sudah lunas membayar kas. Mantap! 🎉' }));
    return;
  }

  container.innerHTML = `
    <div class="card card-glass-strong fade-in" style="margin-bottom:18px;">
      <div class="stat-label">Total Tunggakan Kelas</div>
      <div class="stat-value amount mono" style="font-size:28px;color:var(--rose);">${rupiah(totalArrears)}</div>
      <div class="text-3 mt-8" style="font-size:12px;">${arrears.length} dari ${members.length} member belum lunas</div>
    </div>
    <div class="flex flex-col gap-10 stagger" id="arrears-list"></div>
  `;

  const list = container.querySelector('#arrears-list');
  list.innerHTML = arrears.map(m => `
    <div class="card card-hover flex items-center justify-between" data-id="${m.id}" style="cursor:pointer;flex-wrap:wrap;gap:12px;">
      <div class="flex items-center gap-12">
        <div class="avatar" style="width:38px;height:38px;font-size:12px;">${m.absen}</div>
        <div>
          <div style="font-weight:600;font-size:14px;">${escapeHtml(m.name)}</div>
          <div class="text-3" style="font-size:11.5px;">${m.weeks_unpaid} minggu belum dibayar</div>
        </div>
      </div>
      <div class="flex items-center gap-16">
        <div style="text-align:right;">
          <div class="mono" style="font-size:15px;color:var(--rose);font-weight:600;">${rupiah(m.arrears_amount)}</div>
          ${statusBadge(m.status)}
        </div>
        <button class="btn btn-primary btn-sm" data-pay="${m.id}" type="button">${icon('plus', 13)} Bayar</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-pay]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = arrears.find(x => String(x.id) === btn.dataset.pay);
      openAddPaymentModal({ presetMember: m, onSuccess: () => renderAdminArrears(container) });
    });
  });
}
