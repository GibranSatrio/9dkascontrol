import { api } from '../../core/api.js';
import { icon, rupiah, formatDateShort, errorState, emptyState, openDrawer, reasonModal, toast, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';
import { openAddExpenseModal } from './expenseModal.js';

export async function renderAdminExpenses(container) {
  setPageTitle('Pengeluaran', 'Riwayat pengeluaran kas kelas');

  container.innerHTML = `
    <div class="flex items-center justify-between mt-8" style="margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div class="text-3" style="font-size:12.5px;">Setiap pengeluaran tercatat lengkap dengan bukti dan audit log</div>
      <button class="btn btn-primary" id="exp-add" type="button">${icon('plus', 15)} Tambah Pengeluaran</button>
    </div>
    <div id="exp-list">${skeletonRows(6)}</div>
    <button class="fab" id="exp-fab" type="button" aria-label="Tambah Pengeluaran">${icon('plus', 24)}</button>
  `;

  const listEl = container.querySelector('#exp-list');

  async function load() {
    listEl.innerHTML = skeletonRows(6);
    try {
      const res = await api.get('/expenses');
      renderList(res.expenses);
    } catch {
      listEl.innerHTML = '';
      listEl.appendChild(errorState({ onRetry: load }));
    }
  }

  function renderList(expenses) {
    if (!expenses.length) {
      listEl.innerHTML = '';
      listEl.appendChild(emptyState({
        icon: 'expense', title: 'Belum Ada Pengeluaran', desc: 'Belum ada pengeluaran yang tercatat.',
        actionLabel: 'Tambah Pengeluaran', onAction: openAdd
      }));
      return;
    }
    listEl.innerHTML = `<div class="grid grid-2 stagger">${expenses.map(e => `
      <div class="card card-hover fade-in row-click" data-id="${e.id}" style="cursor:pointer; ${e.voided ? 'opacity:0.5;' : ''}">
        <div class="flex items-center justify-between">
          <div class="stat-icon" style="margin-bottom:0;">${icon('expense', 18)}</div>
          <div class="mono" style="font-size:15px;color:var(--rose);">-${rupiah(e.price)}</div>
        </div>
        <div style="font-weight:600;font-size:14px;margin-top:12px;">${escapeHtml(e.item_name)}</div>
        <div class="text-3" style="font-size:12px;margin-top:2px;">${escapeHtml(e.reason || '-')}</div>
        <div class="flex items-center justify-between mt-16">
          <span class="text-3" style="font-size:11.5px;">${formatDateShort(e.expense_date)}</span>
          ${e.voided ? '<span class="badge badge-menunggak">Dibatalkan</span>' : (e.receipt_path ? '<span class="badge badge-lunas">Ada Bukti</span>' : '<span class="badge badge-neutral">Tanpa Bukti</span>')}
        </div>
      </div>
    `).join('')}</div>`;

    listEl.querySelectorAll('.row-click').forEach(card => {
      card.addEventListener('click', () => {
        const e = expenses.find(x => String(x.id) === card.dataset.id);
        openDetail(e);
      });
    });
  }

  async function openDetail(e) {
    openDrawer({
      title: 'Detail Pengeluaran',
      body: async (el) => {
        el.innerHTML = skeletonRows(3);
        try {
          const res = await api.get(`/expenses/${e.id}`);
          const full = res.expense;
          el.innerHTML = `
            <div class="preview-box mt-8">
              <div class="preview-row"><span class="k">Barang</span><span class="v">${escapeHtml(full.item_name)}</span></div>
              <div class="preview-row"><span class="k">Harga</span><span class="v mono">${rupiah(full.price)}</span></div>
              <div class="preview-row"><span class="k">Alasan</span><span class="v">${escapeHtml(full.reason || '-')}</span></div>
              <div class="preview-row"><span class="k">Tanggal</span><span class="v">${formatDateShort(full.expense_date)}</span></div>
              <div class="preview-row"><span class="k">Dicatat oleh</span><span class="v">${escapeHtml(full.created_by_name)}</span></div>
              ${full.voided ? `<div class="preview-row"><span class="k">Alasan Batal</span><span class="v">${escapeHtml(full.voided_reason || '-')}</span></div>` : ''}
            </div>
            ${full.receipt_path ? `<a href="${full.receipt_path}" target="_blank" class="btn btn-secondary btn-block mt-16">${icon('upload', 15)} Lihat Bukti Pembayaran</a>` : ''}
            ${res.notified_members.length ? `<div class="mt-16"><div class="text-3" style="font-size:11.5px;margin-bottom:8px;">Member diberi notifikasi:</div>${res.notified_members.map(m => `<span class="badge badge-neutral" style="margin:2px;">${escapeHtml(m.name)}</span>`).join('')}</div>` : ''}
            ${!full.voided ? `<button class="btn btn-danger btn-block mt-16" id="void-btn">${icon('trash', 15)} Batalkan Pengeluaran</button>` : ''}
          `;
          const voidBtn = el.querySelector('#void-btn');
          if (voidBtn) voidBtn.addEventListener('click', () => reasonModal({
            title: 'Batalkan Pengeluaran',
            message: `Pengeluaran "${escapeHtml(full.item_name)}" akan dibatalkan. Riwayat tetap tersimpan untuk audit.`,
            onConfirm: async (reason) => {
              await api.patch(`/expenses/${full.id}/void`, { reason });
              toast('Pengeluaran dibatalkan', 'success');
              load();
            }
          }));
        } catch {
          el.innerHTML = '';
          el.appendChild(errorState({ onRetry: () => openDetail(e) }));
        }
      }
    });
  }

  function openAdd() { openAddExpenseModal({ onSuccess: load }); }

  container.querySelector('#exp-add').addEventListener('click', openAdd);
  container.querySelector('#exp-fab').addEventListener('click', openAdd);

  load();
}
