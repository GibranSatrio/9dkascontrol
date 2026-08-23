import { api, ApiError } from '../../core/api.js';
import { icon, statusBadge, formatDateTime, errorState, emptyState, openDrawer, toast, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';

const STATUS_OPTIONS = ['OPEN', 'DIPROSES', 'SELESAI', 'DITOLAK'];

export async function renderAdminReports(container) {
  setPageTitle('Reports', 'Kelola laporan masalah dari member');

  container.innerHTML = `
    <div class="search-bar">
      <select class="select" id="rp-filter" style="max-width:220px;">
        <option value="">Semua Status</option>
        ${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div id="rp-list">${skeletonRows(6)}</div>
  `;

  const filterSel = container.querySelector('#rp-filter');
  const listEl = container.querySelector('#rp-list');

  async function load() {
    listEl.innerHTML = skeletonRows(6);
    try {
      const q = filterSel.value ? `?status=${filterSel.value}` : '';
      const res = await api.get(`/reports${q}`);
      renderList(res.reports);
    } catch {
      listEl.innerHTML = '';
      listEl.appendChild(errorState({ onRetry: load }));
    }
  }

  function renderList(reports) {
    if (!reports.length) {
      listEl.innerHTML = '';
      listEl.appendChild(emptyState({ icon: 'report', title: 'Belum Ada Report', desc: 'Belum ada laporan masalah dari member.' }));
      return;
    }
    listEl.innerHTML = `<div class="flex flex-col gap-10 stagger">${reports.map(r => `
      <div class="card card-hover row-click" data-id="${r.id}" style="cursor:pointer;">
        <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-weight:600;font-size:14px;">${escapeHtml(r.title)}</div>
            <div class="text-3" style="font-size:12px;margin-top:2px;">${escapeHtml(r.member_name)} (${r.member_absen}) &middot; ${escapeHtml(r.category)}</div>
          </div>
          <div class="flex items-center gap-12">
            ${statusBadge(r.status)}
            <span class="text-3" style="font-size:11.5px;">${formatDateTime(r.created_at)}</span>
          </div>
        </div>
      </div>
    `).join('')}</div>`;
    listEl.querySelectorAll('.row-click').forEach(card => {
      card.addEventListener('click', () => {
        const r = reports.find(x => String(x.id) === card.dataset.id);
        openDetail(r);
      });
    });
  }

  function openDetail(r) {
    openDrawer({
      title: 'Detail Report',
      body: (el) => {
        el.innerHTML = `
          <div class="mt-8" style="margin-bottom:16px;">
            <div style="font-weight:700;font-size:15px;">${escapeHtml(r.title)}</div>
            <div class="text-3" style="font-size:12px;margin-top:4px;">${escapeHtml(r.member_name)} (${r.member_absen}) &middot; ${escapeHtml(r.category)} &middot; ${formatDateTime(r.created_at)}</div>
          </div>
          <div class="preview-box" style="margin-bottom:16px;">
            <p style="margin:0;font-size:13px;color:var(--text-2);line-height:1.6;">${escapeHtml(r.description || 'Tidak ada deskripsi tambahan.')}</p>
          </div>
          ${r.attachment_path ? `<a href="${r.attachment_path}" target="_blank" class="btn btn-secondary btn-block" style="margin-bottom:16px;">${icon('upload', 15)} Lihat Lampiran</a>` : ''}
          <div class="field">
            <label>Status</label>
            <select class="select" id="rp-status">${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label>Balasan Admin</label>
            <textarea class="textarea" id="rp-reply" rows="3" placeholder="Tulis balasan untuk member...">${escapeHtml(r.admin_reply || '')}</textarea>
          </div>
          <button class="btn btn-primary btn-block mt-8" id="rp-save">${icon('check', 15)} Simpan Perubahan</button>
        `;
        el.querySelector('#rp-save').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          const status = el.querySelector('#rp-status').value;
          const admin_reply = el.querySelector('#rp-reply').value.trim();
          btn.classList.add('btn-loading');
          try {
            await api.patch(`/reports/${r.id}`, { status, admin_reply });
            toast('Report berhasil diperbarui', 'success');
            load();
          } catch (err) {
            toast(err instanceof ApiError ? err.message : 'Gagal menyimpan.', 'error');
          } finally {
            btn.classList.remove('btn-loading');
          }
        });
      }
    });
  }

  filterSel.addEventListener('change', load);
  load();
}
