import { api, ApiError } from '../../core/api.js';
import { icon, toast, timeAgo, errorState, emptyState, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml, refreshUnread } from '../../layout.js';

export async function renderAdminNotifications(container) {
  setPageTitle('Notifications', 'Kirim pengumuman dan pantau notifikasi masuk');

  let allMembers = [];
  let selectedIds = new Set();

  container.innerHTML = `
    <div class="grid grid-2">
      <div class="card fade-in">
        <div class="section-head"><h2>Kirim Notifikasi</h2></div>
        <div class="field"><label>Judul</label><input class="input" id="nt-title" placeholder="Contoh: Pengumuman Kas"></div>
        <div class="field"><label>Isi Pesan</label><textarea class="textarea" id="nt-body" rows="4" placeholder="Tulis pesan untuk member..."></textarea></div>
        <div class="field">
          <label>Kirim Ke</label>
          <div class="flex gap-16" style="font-size:13px;">
            <label class="flex items-center gap-8"><input type="radio" name="nt-target" value="ALL" checked> Semua Member</label>
            <label class="flex items-center gap-8"><input type="radio" name="nt-target" value="SPECIFIC"> Member Tertentu</label>
          </div>
        </div>
        <div class="field" id="nt-specific-wrap" style="display:none;">
          <div class="input-icon-wrap">${icon('search', 16)}<input class="input" id="nt-search" placeholder="Cari member..."></div>
          <div class="search-results" id="nt-results"></div>
        </div>
        <button class="btn btn-primary btn-block mt-8" id="nt-send">${icon('send', 15)} Kirim Notifikasi</button>
      </div>

      <div class="card fade-in">
        <div class="section-head"><h2>Kotak Masuk Admin</h2><span class="hint">Report &amp; sistem</span></div>
        <div id="nt-inbox">${skeletonRows(4)}</div>
      </div>
    </div>
  `;

  const specificWrap = container.querySelector('#nt-specific-wrap');
  const searchInput = container.querySelector('#nt-search');
  const results = container.querySelector('#nt-results');

  container.querySelectorAll('input[name="nt-target"]').forEach(r => {
    r.addEventListener('change', () => {
      specificWrap.style.display = r.value === 'SPECIFIC' && r.checked ? '' : 'none';
      if (r.checked && r.value === 'SPECIFIC') loadMembers('');
    });
  });

  async function loadMembers(q) {
    results.innerHTML = `<div class="skel skel-row"></div>`;
    try {
      if (!allMembers.length) {
        const res = await api.get('/members');
        allMembers = res.members;
      }
      const filtered = q ? allMembers.filter(m => m.name.toLowerCase().includes(q.toLowerCase()) || m.absen.includes(q)) : allMembers;
      results.innerHTML = filtered.map(m => `
        <div class="member-pick ${selectedIds.has(m.id) ? 'selected' : ''}" data-id="${m.id}">
          <div class="avatar" style="width:30px;height:30px;font-size:10.5px;">${m.absen}</div>
          <div style="flex:1;font-size:13px;">${escapeHtml(m.name)}</div>
          ${selectedIds.has(m.id) ? icon('check', 15) : ''}
        </div>
      `).join('');
      results.querySelectorAll('.member-pick').forEach(node => {
        node.addEventListener('click', () => {
          const id = Number(node.dataset.id);
          if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
          loadMembers(searchInput.value);
        });
      });
    } catch {
      results.innerHTML = `<div class="text-3" style="font-size:12.5px;">Gagal memuat member.</div>`;
    }
  }
  searchInput.addEventListener('input', () => loadMembers(searchInput.value));

  container.querySelector('#nt-send').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const title = container.querySelector('#nt-title').value.trim();
    const body = container.querySelector('#nt-body').value.trim();
    const target = container.querySelector('input[name="nt-target"]:checked').value;

    if (!title || !body) { toast('Judul dan isi pesan wajib diisi.', 'error'); return; }
    if (target === 'SPECIFIC' && selectedIds.size === 0) { toast('Pilih minimal satu member.', 'error'); return; }

    btn.classList.add('btn-loading');
    try {
      await api.post('/notifications', { title, body, target, member_ids: [...selectedIds] });
      toast('Notifikasi berhasil dikirim', 'success');
      container.querySelector('#nt-title').value = '';
      container.querySelector('#nt-body').value = '';
      selectedIds.clear();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Gagal mengirim notifikasi.', 'error');
    } finally {
      btn.classList.remove('btn-loading');
    }
  });

  const inboxEl = container.querySelector('#nt-inbox');
  try {
    const res = await api.get('/notifications');
    if (!res.notifications.length) {
      inboxEl.innerHTML = '';
      inboxEl.appendChild(emptyState({ icon: 'inbox', title: 'Kotak Masuk Kosong', desc: 'Belum ada notifikasi sistem atau report masuk.' }));
    } else {
      inboxEl.innerHTML = `<div class="flex flex-col gap-8 stagger">${res.notifications.slice(0, 12).map(n => `
        <div class="notif-item ${n.read_at ? '' : 'unread'}">
          <div class="notif-dot-icon">${icon(n.type === 'REPORT' ? 'report' : 'bell', 15)}</div>
          <div><div class="notif-title">${escapeHtml(n.title)}</div><div class="notif-body">${escapeHtml(n.body)}</div><div class="notif-time">${timeAgo(n.created_at)}</div></div>
        </div>
      `).join('')}</div>`;
      refreshUnread();
    }
  } catch {
    inboxEl.innerHTML = '';
    inboxEl.appendChild(errorState({ onRetry: () => renderAdminNotifications(container) }));
  }
}
