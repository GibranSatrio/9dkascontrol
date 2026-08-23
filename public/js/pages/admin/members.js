import { api, ApiError } from '../../core/api.js';
import { icon, rupiah, statusBadge, statusLabel, formatDateShort, errorState, emptyState, openDrawer, openModal, confirmDialog, toast, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';
import { openAddPaymentModal } from './paymentModal.js';

let cachedMembers = [];

export async function renderAdminMembers(container) {
  setPageTitle('Members', 'Kelola data dan status pembayaran member kelas');

  container.innerHTML = `
    <div class="search-bar">
      <div class="input-icon-wrap">${icon('search', 16)}<input class="input" id="mem-search" placeholder="Cari nomor absen atau nama..."></div>
      <select class="select" id="mem-filter" style="max-width:200px;">
        <option value="">Semua Status</option>
        <option value="LUNAS">Lunas</option>
        <option value="SEBAGIAN">Sebagian</option>
        <option value="MENUNGGAK">Menunggak</option>
        <option value="BELUM_BAYAR">Belum Bayar</option>
      </select>
      <button class="btn btn-primary" id="mem-add" type="button">${icon('plus', 15)} Tambah Member</button>
    </div>
    <div id="mem-table-wrap">${skeletonRows(6)}</div>
  `;

  const searchInput = container.querySelector('#mem-search');
  const filterSel = container.querySelector('#mem-filter');
  const tableWrap = container.querySelector('#mem-table-wrap');
  let debounce;

  async function load() {
    tableWrap.innerHTML = skeletonRows(6);
    try {
      const q = new URLSearchParams();
      if (searchInput.value.trim()) q.set('search', searchInput.value.trim());
      if (filterSel.value) q.set('status', filterSel.value);
      const res = await api.get(`/members?${q.toString()}`);
      cachedMembers = res.members;
      renderTable(res.members);
    } catch {
      tableWrap.innerHTML = '';
      tableWrap.appendChild(errorState({ onRetry: load }));
    }
  }

  function renderTable(members) {
    if (!members.length) {
      tableWrap.innerHTML = '';
      tableWrap.appendChild(emptyState({
        icon: 'members', title: 'Member Tidak Ditemukan', desc: 'Coba ubah kata kunci pencarian atau filter status.'
      }));
      return;
    }
    tableWrap.innerHTML = `
      <div class="table-wrap">
        <table class="dtable">
          <thead><tr><th>Absen</th><th>Nama</th><th>Status</th><th>Total Dibayar</th><th>Tunggakan</th><th>Last Payment</th><th>Aktif</th></tr></thead>
          <tbody>
            ${members.map(m => `
              <tr class="row-click" data-id="${m.id}" style="cursor:pointer;">
                <td class="mono">${m.absen}</td>
                <td class="row-name">${escapeHtml(m.name)}</td>
                <td>${statusBadge(m.status)}</td>
                <td class="mono">${rupiah(m.total_paid)}</td>
                <td class="mono" style="color:${m.arrears_amount > 0 ? 'var(--rose)' : 'var(--text-2)'}">${rupiah(m.arrears_amount)}</td>
                <td class="row-sub">${m.last_payment_at ? formatDateShort(m.last_payment_at) : 'Belum pernah'}</td>
                <td>${m.active ? '<span class="badge badge-lunas">Aktif</span>' : '<span class="badge badge-neutral">Nonaktif</span>'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    tableWrap.querySelectorAll('.row-click').forEach(row => {
      row.addEventListener('click', () => openMemberDrawer(Number(row.dataset.id), load));
    });
  }

  searchInput.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(load, 300); });
  filterSel.addEventListener('change', load);
  container.querySelector('#mem-add').addEventListener('click', () => openAddMemberModal(load));

  load();
}

function openMemberDrawer(id, onChange) {
  openDrawer({
    title: 'Detail Member',
    body: async (el) => {
      el.innerHTML = skeletonRows(4);
      try {
        const res = await api.get(`/members/${id}`);
        const m = res.member;
        el.innerHTML = `
          <div class="flex items-center gap-12 mt-8" style="margin-bottom:18px;">
            <div class="avatar" style="width:48px;height:48px;font-size:14px;">${m.absen}</div>
            <div>
              <div style="font-weight:700;font-size:16px;">${escapeHtml(m.name)}</div>
              <div class="text-3" style="font-size:12px;">Absen ${m.absen} &middot; Bergabung ${formatDateShort(m.created_at)}</div>
            </div>
          </div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
            <div class="card" style="padding:14px;"><div class="text-3" style="font-size:11px;">Status</div><div class="mt-8">${statusBadge(m.status)}</div></div>
            <div class="card" style="padding:14px;"><div class="text-3" style="font-size:11px;">Total Dibayar</div><div class="mono mt-8" style="font-size:15px;">${rupiah(m.total_paid)}</div></div>
            <div class="card" style="padding:14px;"><div class="text-3" style="font-size:11px;">Tunggakan</div><div class="mono mt-8" style="font-size:15px;color:${m.arrears_amount>0?'var(--rose)':'var(--text-1)'}">${rupiah(m.arrears_amount)}</div></div>
            <div class="card" style="padding:14px;"><div class="text-3" style="font-size:11px;">Minggu Belum Bayar</div><div class="mt-8" style="font-size:15px;">${m.weeks_unpaid}</div></div>
          </div>
          <div class="flex flex-col gap-8">
            <button class="btn btn-primary btn-block" id="d-add-payment">${icon('plus', 15)} Tambah Pemasukan</button>
            <button class="btn btn-secondary btn-block" id="d-edit">${icon('edit', 15)} Edit Member</button>
            <button class="btn btn-secondary btn-block" id="d-reset">${icon('settings', 15)} Reset Password</button>
            <button class="btn ${m.active ? 'btn-danger' : 'btn-secondary'} btn-block" id="d-toggle">${icon(m.active ? 'close' : 'check', 15)} ${m.active ? 'Nonaktifkan' : 'Aktifkan'} Member</button>
          </div>
        `;

        el.querySelector('#d-add-payment').addEventListener('click', () => {
          openAddPaymentModal({ presetMember: m, onSuccess: onChange });
        });
        el.querySelector('#d-edit').addEventListener('click', () => openEditMemberModal(m, onChange));
        el.querySelector('#d-reset').addEventListener('click', () => openResetPasswordModal(m));
        el.querySelector('#d-toggle').addEventListener('click', () => {
          confirmDialog({
            title: m.active ? 'Nonaktifkan Member' : 'Aktifkan Member',
            message: m.active
              ? `${m.name} tidak akan bisa login sampai diaktifkan kembali.`
              : `${m.name} akan bisa login kembali ke sistem.`,
            confirmLabel: m.active ? 'Nonaktifkan' : 'Aktifkan',
            danger: m.active,
            onConfirm: async () => {
              await api.patch(`/members/${m.id}`, { active: !m.active });
              toast(`Member berhasil ${m.active ? 'dinonaktifkan' : 'diaktifkan'}`, 'success');
              onChange();
            }
          });
        });
      } catch {
        el.innerHTML = '';
        el.appendChild(errorState({ onRetry: () => openMemberDrawer(id, onChange) }));
      }
    }
  });
}

function openAddMemberModal(onSuccess) {
  openModal({
    title: 'Tambah Member',
    desc: 'Buat akun baru untuk member kelas.',
    body: (el) => {
      el.innerHTML = `
        <div class="field"><label>Nomor Absen</label><input class="input" id="nm-absen" placeholder="Contoh: 19"></div>
        <div class="field"><label>Nama Lengkap</label><input class="input" id="nm-name" placeholder="Nama member"></div>
        <div class="field"><label>Password Awal</label><input class="input" id="nm-pass" type="text" placeholder="Minimal 6 karakter"></div>
      `;
    },
    actions: [
      { label: 'Batal', variant: 'btn-secondary', onClick: (close) => close() },
      {
        label: 'Simpan Member', variant: 'btn-primary',
        onClick: async (close, btn) => {
          const absen = document.getElementById('nm-absen').value.trim();
          const name = document.getElementById('nm-name').value.trim();
          const password = document.getElementById('nm-pass').value;
          if (!absen || !name || password.length < 6) {
            toast('Lengkapi semua field (password minimal 6 karakter).', 'error');
            return;
          }
          btn.classList.add('btn-loading');
          try {
            await api.post('/members', { absen, name, password });
            toast('Member berhasil ditambahkan', 'success');
            close();
            onSuccess();
          } catch (err) {
            btn.classList.remove('btn-loading');
            toast(err instanceof ApiError ? err.message : 'Gagal menambahkan member.', 'error');
          }
        }
      }
    ]
  });
}

function openEditMemberModal(m, onSuccess) {
  openModal({
    title: 'Edit Member',
    body: (el) => {
      el.innerHTML = `<div class="field"><label>Nama Lengkap</label><input class="input" id="em-name" value="${escapeHtml(m.name)}"></div>`;
    },
    actions: [
      { label: 'Batal', variant: 'btn-secondary', onClick: (close) => close() },
      {
        label: 'Simpan', variant: 'btn-primary',
        onClick: async (close, btn) => {
          const name = document.getElementById('em-name').value.trim();
          if (!name) { toast('Nama wajib diisi.', 'error'); return; }
          btn.classList.add('btn-loading');
          try {
            await api.patch(`/members/${m.id}`, { name });
            toast('Data member diperbarui', 'success');
            close();
            onSuccess();
          } catch (err) {
            btn.classList.remove('btn-loading');
            toast(err instanceof ApiError ? err.message : 'Gagal menyimpan.', 'error');
          }
        }
      }
    ]
  });
}

function openResetPasswordModal(m) {
  openModal({
    title: 'Reset Password',
    desc: `Atur ulang password untuk ${m.name}.`,
    body: (el) => {
      el.innerHTML = `<div class="field"><label>Password Baru</label><input class="input" id="rp-pass" placeholder="Minimal 6 karakter"></div>`;
    },
    actions: [
      { label: 'Batal', variant: 'btn-secondary', onClick: (close) => close() },
      {
        label: 'Reset Password', variant: 'btn-primary',
        onClick: async (close, btn) => {
          const password = document.getElementById('rp-pass').value;
          if (password.length < 6) { toast('Password minimal 6 karakter.', 'error'); return; }
          btn.classList.add('btn-loading');
          try {
            await api.patch(`/members/${m.id}`, { password });
            toast('Password berhasil direset', 'success');
            close();
          } catch (err) {
            btn.classList.remove('btn-loading');
            toast(err instanceof ApiError ? err.message : 'Gagal reset password.', 'error');
          }
        }
      }
    ]
  });
}
