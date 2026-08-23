import { api } from '../../core/api.js';
import { icon, rupiah, formatDateTime, errorState, emptyState, openDrawer, reasonModal, toast, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';
import { openAddPaymentModal } from './paymentModal.js';

export async function renderAdminPayments(container) {
  setPageTitle('Pemasukan', 'Riwayat seluruh pembayaran kas member');

  container.innerHTML = `
    <div class="flex items-center justify-between mt-8" style="margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div class="text-3" style="font-size:12.5px;">Semua transaksi pemasukan kas kelas</div>
      <button class="btn btn-primary" id="pay-add" type="button">${icon('plus', 15)} Tambah Pemasukan</button>
    </div>
    <div id="pay-list">${skeletonRows(6)}</div>
    <button class="fab" id="pay-fab" type="button" aria-label="Tambah Pemasukan">${icon('plus', 24)}</button>
  `;

  const listEl = container.querySelector('#pay-list');

  async function load() {
    listEl.innerHTML = skeletonRows(6);
    try {
      const res = await api.get('/payments');
      renderList(res.payments);
    } catch {
      listEl.innerHTML = '';
      listEl.appendChild(errorState({ onRetry: load }));
    }
  }

  function renderList(payments) {
    if (!payments.length) {
      listEl.innerHTML = '';
      listEl.appendChild(emptyState({
        icon: 'income', title: 'Belum Ada Transaksi', desc: 'Belum ada pemasukan yang tercatat.',
        actionLabel: 'Tambah Pemasukan', onAction: openAdd
      }));
      return;
    }
    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="dtable">
          <thead><tr><th>Member</th><th>Jenis</th><th>Nominal</th><th>Waktu</th><th>Status</th></tr></thead>
          <tbody>
            ${payments.map(p => `
              <tr class="row-click" data-id="${p.id}" style="cursor:pointer; ${p.voided ? 'opacity:0.45;' : ''}">
                <td><div class="row-name">${escapeHtml(p.member_name)}</div><div class="row-sub">Absen ${p.member_absen}</div></td>
                <td>${escapeHtml(p.payment_type)}${p.week_number ? ` <span class="text-3">· M${p.week_number}</span>` : ''}</td>
                <td class="mono">${rupiah(p.amount)}</td>
                <td class="row-sub">${formatDateTime(p.created_at)}</td>
                <td>${p.voided ? '<span class="badge badge-menunggak">Dibatalkan</span>' : '<span class="badge badge-lunas">Berhasil</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    listEl.querySelectorAll('.row-click').forEach(row => {
      row.addEventListener('click', () => {
        const p = payments.find(x => String(x.id) === row.dataset.id);
        openDetail(p);
      });
    });
  }

  function openDetail(p) {
    openDrawer({
      title: 'Detail Pembayaran',
      body: (el) => {
        el.innerHTML = `
          <div class="preview-box mt-8">
            <div class="preview-row"><span class="k">Member</span><span class="v">${escapeHtml(p.member_name)} (${p.member_absen})</span></div>
            <div class="preview-row"><span class="k">Jenis</span><span class="v">${escapeHtml(p.payment_type)}</span></div>
            ${p.week_number ? `<div class="preview-row"><span class="k">Periode</span><span class="v">Minggu ke-${p.week_number}</span></div>` : ''}
            <div class="preview-row"><span class="k">Nominal</span><span class="v mono">${rupiah(p.amount)}</span></div>
            <div class="preview-row"><span class="k">Waktu</span><span class="v">${formatDateTime(p.created_at)}</span></div>
            ${p.note ? `<div class="preview-row"><span class="k">Catatan</span><span class="v">${escapeHtml(p.note)}</span></div>` : ''}
            ${p.voided ? `<div class="preview-row"><span class="k">Alasan Batal</span><span class="v">${escapeHtml(p.voided_reason || '-')}</span></div>` : ''}
          </div>
          ${!p.voided ? `<button class="btn btn-danger btn-block mt-16" id="void-btn">${icon('trash', 15)} Batalkan Transaksi</button>` : ''}
        `;
        const voidBtn = el.querySelector('#void-btn');
        if (voidBtn) voidBtn.addEventListener('click', () => reasonModal({
          title: 'Batalkan Transaksi',
          message: `Transaksi ${rupiah(p.amount)} dari ${escapeHtml(p.member_name)} akan dibatalkan. Riwayat tetap tersimpan untuk audit.`,
          onConfirm: async (reason) => {
            await api.patch(`/payments/${p.id}/void`, { reason });
            toast('Transaksi dibatalkan', 'success');
            load();
          }
        }));
      }
    });
  }

  function openAdd() { openAddPaymentModal({ onSuccess: load }); }

  container.querySelector('#pay-add').addEventListener('click', openAdd);
  container.querySelector('#pay-fab').addEventListener('click', openAdd);

  load();
}
