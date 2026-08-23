import { api } from '../../core/api.js';
import { icon, rupiah, formatDateTime, formatDateShort, errorState, emptyState, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';

export async function renderMemberHistory(container) {
  setPageTitle('Riwayat', 'Riwayat pembayaran dan pengeluaran kelas');

  container.innerHTML = `
    <div class="flex gap-8 mt-8" style="margin-bottom:16px;">
      <button class="btn btn-secondary btn-sm tab-btn active" data-tab="payments" type="button">Pembayaran Saya</button>
      <button class="btn btn-ghost btn-sm tab-btn" data-tab="expenses" type="button">Pengeluaran Kelas</button>
    </div>
    <div id="hist-content">${skeletonRows(6)}</div>
  `;

  const content = container.querySelector('#hist-content');
  const tabs = container.querySelectorAll('.tab-btn');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => { b.classList.remove('active', 'btn-secondary'); b.classList.add('btn-ghost'); });
      btn.classList.remove('btn-ghost'); btn.classList.add('active', 'btn-secondary');
      if (btn.dataset.tab === 'payments') loadPayments(); else loadExpenses();
    });
  });

  async function loadPayments() {
    content.innerHTML = skeletonRows(6);
    try {
      const res = await api.get('/payments');
      if (!res.payments.length) {
        content.innerHTML = '';
        content.appendChild(emptyState({ icon: 'income', title: 'Belum Ada Pembayaran', desc: 'Riwayat pembayaran kas kamu akan muncul di sini.' }));
        return;
      }
      content.innerHTML = `<div class="table-wrap"><table class="dtable">
        <thead><tr><th>Jenis</th><th>Nominal</th><th>Waktu</th><th>Status</th></tr></thead>
        <tbody>${res.payments.map(p => `
          <tr style="${p.voided ? 'opacity:0.45;' : ''}">
            <td>${escapeHtml(p.payment_type)}${p.week_number ? ` &middot; M${p.week_number}` : ''}</td>
            <td class="mono">${rupiah(p.amount)}</td>
            <td class="row-sub">${formatDateTime(p.created_at)}</td>
            <td>${p.voided ? '<span class="badge badge-menunggak">Dibatalkan</span>' : '<span class="badge badge-lunas">Berhasil</span>'}</td>
          </tr>
        `).join('')}</tbody>
      </table></div>`;
    } catch {
      content.innerHTML = '';
      content.appendChild(errorState({ onRetry: loadPayments }));
    }
  }

  async function loadExpenses() {
    content.innerHTML = skeletonRows(6);
    try {
      const res = await api.get('/expenses');
      const active = res.expenses.filter(e => !e.voided);
      if (!active.length) {
        content.innerHTML = '';
        content.appendChild(emptyState({ icon: 'expense', title: 'Belum Ada Pengeluaran', desc: 'Pengeluaran kas kelas akan diumumkan di sini.' }));
        return;
      }
      content.innerHTML = `<div class="grid grid-2 stagger">${active.map(e => `
        <div class="card fade-in">
          <div class="flex items-center justify-between">
            <div class="stat-icon" style="margin-bottom:0;">${icon('expense', 18)}</div>
            <div class="mono" style="color:var(--rose);">-${rupiah(e.price)}</div>
          </div>
          <div style="font-weight:600;font-size:14px;margin-top:12px;">${escapeHtml(e.item_name)}</div>
          <div class="text-3" style="font-size:12px;margin-top:2px;">${escapeHtml(e.reason) || '-'}</div>
          <div class="text-3 mt-16" style="font-size:11.5px;">${formatDateShort(e.expense_date)}</div>
        </div>
      `).join('')}</div>`;
    } catch {
      content.innerHTML = '';
      content.appendChild(errorState({ onRetry: loadExpenses }));
    }
  }

  loadPayments();
}
