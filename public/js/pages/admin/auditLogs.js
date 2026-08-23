import { api } from '../../core/api.js';
import { icon, formatDateTime, errorState, emptyState, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';

const ACTION_LABELS = {
  LOGIN_SUCCESS: 'Login Berhasil', LOGIN_FAILED: 'Login Gagal', LOGOUT: 'Logout',
  ACCOUNT_LOCKED: 'Akun Terkunci', LOGIN_BLOCKED: 'Login Diblokir',
  PAYMENT_ADDED: 'Pemasukan Ditambahkan', PAYMENT_VOIDED: 'Pemasukan Dibatalkan',
  EXPENSE_ADDED: 'Pengeluaran Ditambahkan', EXPENSE_VOIDED: 'Pengeluaran Dibatalkan',
  CASH_RATE_CHANGED: 'Nominal Kas Diubah', SETTINGS_UPDATED: 'Pengaturan Diperbarui',
  MEMBER_CREATED: 'Member Ditambahkan', MEMBER_UPDATED: 'Member Diperbarui',
  NOTIFICATION_SENT: 'Notifikasi Dikirim', REPORT_CREATED: 'Report Dibuat', REPORT_UPDATED: 'Report Diperbarui',
  SYSTEM_SEEDED: 'Data Awal Dibuat'
};

export async function renderAdminAuditLogs(container) {
  setPageTitle('Audit Logs', 'Riwayat seluruh aktivitas penting di sistem');

  container.innerHTML = `
    <div class="search-bar">
      <select class="select" id="al-filter" style="max-width:260px;">
        <option value="">Semua Aktivitas</option>
        ${Object.entries(ACTION_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
    </div>
    <div id="al-list">${skeletonRows(8)}</div>
  `;

  const filterSel = container.querySelector('#al-filter');
  const listEl = container.querySelector('#al-list');

  async function load() {
    listEl.innerHTML = skeletonRows(8);
    try {
      const q = filterSel.value ? `?action=${filterSel.value}` : '';
      const res = await api.get(`/audit-logs${q}`);
      renderList(res.logs);
    } catch {
      listEl.innerHTML = '';
      listEl.appendChild(errorState({ onRetry: load }));
    }
  }

  function renderList(logs) {
    if (!logs.length) {
      listEl.innerHTML = '';
      listEl.appendChild(emptyState({ icon: 'audit', title: 'Belum Ada Aktivitas', desc: 'Log aktivitas akan muncul di sini seiring penggunaan sistem.' }));
      return;
    }
    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="dtable">
          <thead><tr><th>Waktu</th><th>Aktor</th><th>Aktivitas</th><th>Detail</th></tr></thead>
          <tbody>
            ${logs.map(l => `
              <tr>
                <td class="row-sub" style="white-space:nowrap;">${formatDateTime(l.created_at)}</td>
                <td>${escapeHtml(l.actor_name || 'SYSTEM')}</td>
                <td><span class="badge badge-neutral">${ACTION_LABELS[l.action] || l.action}</span></td>
                <td class="row-sub" style="max-width:320px;">${escapeHtml(summarize(l.details))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function summarize(detailsJson) {
    if (!detailsJson) return '-';
    try {
      const obj = JSON.parse(detailsJson);
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
    } catch {
      return detailsJson;
    }
  }

  filterSel.addEventListener('change', load);
  load();
}
