import { api, ApiError } from '../../core/api.js';
import { icon, statusBadge, formatDateTime, errorState, emptyState, openDrawer, toast, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';

const CATEGORIES = ['Pembayaran', 'Nominal', 'Update', 'Pengeluaran', 'Akun', 'Lainnya'];

export async function renderMemberReports(container) {
  setPageTitle('Report', 'Laporkan masalah kepada admin kelas');

  container.innerHTML = `
    <div class="card fade-in" style="margin-bottom:18px;">
      <div class="section-head"><h2>Report Masalah</h2></div>
      <div class="field"><label>Kategori</label>
        <select class="select" id="rp-cat">${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
      </div>
      <div class="field"><label>Judul</label><input class="input" id="rp-title" placeholder="Contoh: Pembayaran saya belum tercatat"></div>
      <div class="field"><label>Deskripsi</label><textarea class="textarea" id="rp-desc" rows="3" placeholder="Jelaskan masalah kamu secara detail..."></textarea></div>
      <div class="field"><label>Lampiran <span class="text-3">(opsional)</span></label><input class="input" id="rp-file" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf"></div>
      <button class="btn btn-primary btn-block mt-8" id="rp-send">${icon('send', 15)} Kirim Report</button>
    </div>

    <div class="section-head"><h2>Report Saya</h2></div>
    <div id="rp-list">${skeletonRows(4)}</div>
  `;

  container.querySelector('#rp-send').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const category = container.querySelector('#rp-cat').value;
    const title = container.querySelector('#rp-title').value.trim();
    const description = container.querySelector('#rp-desc').value.trim();
    const file = container.querySelector('#rp-file').files[0];

    if (!title) { toast('Judul laporan wajib diisi.', 'error'); return; }

    const fd = new FormData();
    fd.append('category', category);
    fd.append('title', title);
    fd.append('description', description);
    if (file) fd.append('attachment', file);

    btn.classList.add('btn-loading');
    try {
      await api.postForm('/reports', fd);
      toast('Report berhasil dikirim', 'success');
      container.querySelector('#rp-title').value = '';
      container.querySelector('#rp-desc').value = '';
      container.querySelector('#rp-file').value = '';
      loadList();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Gagal mengirim report.', 'error');
    } finally {
      btn.classList.remove('btn-loading');
    }
  });

  const listEl = container.querySelector('#rp-list');

  async function loadList() {
    listEl.innerHTML = skeletonRows(4);
    try {
      const res = await api.get('/reports');
      if (!res.reports.length) {
        listEl.innerHTML = '';
        listEl.appendChild(emptyState({ icon: 'report', title: 'Belum Ada Report', desc: 'Report yang kamu kirim akan muncul di sini.' }));
        return;
      }
      listEl.innerHTML = `<div class="flex flex-col gap-10 stagger">${res.reports.map(r => `
        <div class="card card-hover row-click" data-id="${r.id}" style="cursor:pointer;">
          <div class="flex items-center justify-between" style="flex-wrap:wrap;gap:10px;">
            <div>
              <div style="font-weight:600;font-size:13.5px;">${escapeHtml(r.title)}</div>
              <div class="text-3" style="font-size:11.5px;margin-top:2px;">${escapeHtml(r.category)} &middot; ${formatDateTime(r.created_at)}</div>
            </div>
            ${statusBadge(r.status)}
          </div>
        </div>
      `).join('')}</div>`;
      listEl.querySelectorAll('.row-click').forEach(card => {
        card.addEventListener('click', () => {
          const r = res.reports.find(x => String(x.id) === card.dataset.id);
          openDetail(r);
        });
      });
    } catch {
      listEl.innerHTML = '';
      listEl.appendChild(errorState({ onRetry: loadList }));
    }
  }

  function openDetail(r) {
    openDrawer({
      title: 'Detail Report',
      body: (el) => {
        el.innerHTML = `
          <div class="mt-8" style="margin-bottom:14px;">
            <div style="font-weight:700;font-size:15px;">${escapeHtml(r.title)}</div>
            <div class="text-3" style="font-size:12px;margin-top:4px;">${escapeHtml(r.category)} &middot; ${formatDateTime(r.created_at)}</div>
            <div class="mt-8">${statusBadge(r.status)}</div>
          </div>
          <div class="preview-box">
            <p style="margin:0;font-size:13px;color:var(--text-2);line-height:1.6;">${escapeHtml(r.description) || 'Tidak ada deskripsi.'}</p>
          </div>
          ${r.admin_reply ? `<div class="mt-16"><div class="text-3" style="font-size:11.5px;margin-bottom:6px;">Balasan Admin:</div><div class="preview-box">${escapeHtml(r.admin_reply)}</div></div>` : `<div class="mt-16 text-3" style="font-size:12.5px;">Menunggu balasan admin.</div>`}
          ${r.attachment_path ? `<a href="${r.attachment_path}" target="_blank" class="btn btn-secondary btn-block mt-16">${icon('upload', 15)} Lihat Lampiran</a>` : ''}
        `;
      }
    });
  }

  loadList();
}
