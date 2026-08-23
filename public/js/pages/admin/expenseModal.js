import { api, ApiError } from '../../core/api.js';
import { openModal, toast, rupiah, icon } from '../../core/ui.js';
import { escapeHtml } from '../../layout.js';

export function openAddExpenseModal({ onSuccess } = {}) {
  let allMembers = [];
  let selectedIds = new Set();

  const { close, root } = openModal({
    title: 'Tambah Pengeluaran',
    desc: 'Catat pengeluaran kas kelas beserta bukti jika tersedia.',
    size: 'lg',
    body: (el) => { render(el); }
  });

  function render(el) {
    el.innerHTML = `
      <div class="field">
        <label>Nama Barang</label>
        <input class="input" id="ex-item" placeholder="Contoh: Sapu">
      </div>
      <div class="field">
        <label>Harga</label>
        <input class="input mono" id="ex-price" inputmode="numeric" placeholder="25000">
      </div>
      <div class="field">
        <label>Alasan</label>
        <textarea class="textarea" id="ex-reason" rows="2" placeholder="Contoh: Membeli sapu baru untuk kebersihan kelas"></textarea>
      </div>
      <div class="field">
        <label>Tanggal</label>
        <input class="input" id="ex-date" type="date" value="${new Date().toISOString().slice(0,10)}">
      </div>
      <div class="field">
        <label>Bukti Pembayaran <span class="text-3">(opsional, JPG/PNG/PDF, maks 5MB)</span></label>
        <input class="input" id="ex-receipt" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf">
      </div>
      <div class="field">
        <label>Notifikasi</label>
        <div class="flex gap-16" style="font-size:13px;">
          <label class="flex items-center gap-8"><input type="radio" name="ex-target" value="ALL" checked> Semua Member</label>
          <label class="flex items-center gap-8"><input type="radio" name="ex-target" value="SPECIFIC"> Member tertentu</label>
        </div>
        <div id="ex-specific-wrap" style="display:none;" class="mt-8">
          <div class="input-icon-wrap">${icon('search', 16)}<input class="input" id="ex-member-search" placeholder="Cari member..."></div>
          <div class="search-results" id="ex-member-results"></div>
        </div>
      </div>
      <div class="preview-box" id="ex-preview"></div>
    `;

    const itemInput = el.querySelector('#ex-item');
    const priceInput = el.querySelector('#ex-price');
    const reasonInput = el.querySelector('#ex-reason');
    const dateInput = el.querySelector('#ex-date');
    const specificWrap = el.querySelector('#ex-specific-wrap');
    const memberSearch = el.querySelector('#ex-member-search');
    const memberResults = el.querySelector('#ex-member-results');

    el.querySelectorAll('input[name="ex-target"]').forEach(r => {
      r.addEventListener('change', () => {
        specificWrap.style.display = r.value === 'SPECIFIC' && r.checked ? '' : specificWrap.style.display;
        if (r.checked && r.value === 'ALL') specificWrap.style.display = 'none';
        if (r.checked && r.value === 'SPECIFIC') { specificWrap.style.display = ''; loadMembers(''); }
        updatePreview();
      });
    });

    async function loadMembers(q) {
      memberResults.innerHTML = `<div class="skel skel-row"></div>`;
      try {
        if (!allMembers.length) {
          const res = await api.get('/members');
          allMembers = res.members;
        }
        const filtered = q ? allMembers.filter(m => m.name.toLowerCase().includes(q.toLowerCase()) || m.absen.includes(q)) : allMembers;
        memberResults.innerHTML = filtered.map(m => `
          <div class="member-pick ${selectedIds.has(m.id) ? 'selected' : ''}" data-id="${m.id}">
            <div class="avatar" style="width:32px;height:32px;font-size:11px;">${m.absen}</div>
            <div style="flex:1;font-size:13px;">${escapeHtml(m.name)}</div>
            ${selectedIds.has(m.id) ? icon('check', 16) : ''}
          </div>
        `).join('') || `<div class="text-3" style="font-size:12.5px;">Tidak ada member.</div>`;
        memberResults.querySelectorAll('.member-pick').forEach(node => {
          node.addEventListener('click', () => {
            const id = Number(node.dataset.id);
            if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
            loadMembers(memberSearch.value);
            updatePreview();
          });
        });
      } catch {
        memberResults.innerHTML = `<div class="text-3" style="font-size:12.5px;">Gagal memuat member.</div>`;
      }
    }
    memberSearch.addEventListener('input', () => loadMembers(memberSearch.value));

    function updatePreview() {
      const target = el.querySelector('input[name="ex-target"]:checked').value;
      el.querySelector('#ex-preview').innerHTML = `
        <div class="preview-row"><span class="k">Barang</span><span class="v">${escapeHtml(itemInput.value) || '-'}</span></div>
        <div class="preview-row"><span class="k">Harga</span><span class="v mono">${rupiah(Number(priceInput.value) || 0)}</span></div>
        <div class="preview-row"><span class="k">Tanggal</span><span class="v">${dateInput.value}</span></div>
        <div class="preview-row"><span class="k">Notifikasi</span><span class="v">${target === 'ALL' ? 'Semua Member' : `${selectedIds.size} member dipilih`}</span></div>
      `;
    }
    [itemInput, priceInput, dateInput].forEach(i => i.addEventListener('input', updatePreview));
    updatePreview();

    let foot = root.querySelector('[data-foot]');
    if (!foot) {
      foot = document.createElement('div');
      foot.className = 'modal-foot';
      foot.setAttribute('data-foot', '');
      root.querySelector('.modal').appendChild(foot);
    }
    foot.innerHTML = `
      <button type="button" class="btn btn-secondary" id="ex-cancel">Batal</button>
      <button type="button" class="btn btn-primary" id="ex-save">${icon('check', 15)} Simpan Pengeluaran</button>
    `;
    foot.querySelector('#ex-cancel').addEventListener('click', close);
    foot.querySelector('#ex-save').addEventListener('click', async () => {
      const btn = foot.querySelector('#ex-save');
      if (!itemInput.value.trim()) { toast('Nama barang wajib diisi.', 'error'); return; }
      const price = Number(priceInput.value);
      if (!price || price <= 0) { toast('Harga tidak valid.', 'error'); return; }

      const target = el.querySelector('input[name="ex-target"]:checked').value;
      const fd = new FormData();
      fd.append('item_name', itemInput.value.trim());
      fd.append('price', String(price));
      fd.append('reason', reasonInput.value.trim());
      fd.append('expense_date', dateInput.value);
      fd.append('notify_target', target);
      if (target === 'SPECIFIC') fd.append('member_ids', JSON.stringify([...selectedIds]));
      const fileInput = el.querySelector('#ex-receipt');
      if (fileInput.files[0]) fd.append('receipt', fileInput.files[0]);

      btn.classList.add('btn-loading');
      try {
        await api.postForm('/expenses', fd);
        toast('Pengeluaran berhasil disimpan', 'success');
        close();
        if (onSuccess) onSuccess();
      } catch (err) {
        btn.classList.remove('btn-loading');
        toast(err instanceof ApiError ? err.message : 'Gagal menyimpan pengeluaran.', 'error');
      }
    });
  }
}
