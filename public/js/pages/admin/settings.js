import { api, ApiError } from '../../core/api.js';
import { icon, rupiah, formatDateShort, toast, errorState, confirmDialog, skeletonRows } from '../../core/ui.js';
import { setPageTitle } from '../../layout.js';
import { getState } from '../../core/state.js';

export async function renderAdminSettings(container) {
  setPageTitle('Settings', 'Pengaturan aplikasi dan nominal kas');
  container.innerHTML = skeletonRows(6);

  let data;
  try {
    data = await api.get('/settings');
  } catch {
    container.innerHTML = '';
    container.appendChild(errorState({ onRetry: () => renderAdminSettings(container) }));
    return;
  }

  const s = data.settings;
  const user = getState().user;

  container.innerHTML = `
    <div class="grid grid-2 stagger">
      <div class="card">
        <div class="section-head"><h2>Identitas Kelas</h2></div>
        <div class="field"><label>Nama Kelas</label><input class="input" id="st-class" value="${s.class_name}"></div>
        <div class="field"><label>Nama Aplikasi</label><input class="input" id="st-app" value="${s.app_name}"></div>
        <button class="btn btn-primary mt-8" id="st-save-app">${icon('check', 15)} Simpan Identitas</button>
      </div>

      <div class="card">
        <div class="section-head"><h2>Nominal Kas Mingguan</h2></div>
        <div class="preview-box" style="margin-bottom:14px;">
          <div class="preview-row"><span class="k">Nominal saat ini</span><span class="v mono">${rupiah(s.weekly_amount)}</span></div>
          <div class="preview-row"><span class="k">Periode mulai</span><span class="v">${formatDateShort(s.period_start_date)}</span></div>
        </div>
        <div class="field"><label>Nominal Baru</label><input class="input mono" id="st-amount" inputmode="numeric" value="${s.weekly_amount}"></div>
        <div class="field"><label>Berlaku Mulai</label><input class="input" id="st-effective" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        <button class="btn btn-primary mt-8" id="st-save-cash">${icon('check', 15)} Perbarui Nominal</button>
      </div>
    </div>

    <div class="card mt-16">
      <div class="section-head"><h2>Riwayat Nominal Kas</h2></div>
      <div class="table-wrap">
        <table class="dtable">
          <thead><tr><th>Berlaku Mulai</th><th>Nominal Lama</th><th>Nominal Baru</th><th>Dicatat</th></tr></thead>
          <tbody>
            ${data.rate_history.map(h => `
              <tr>
                <td>${formatDateShort(h.effective_date)}</td>
                <td class="mono">${h.old_amount ? rupiah(h.old_amount) : '-'}</td>
                <td class="mono">${rupiah(h.new_amount)}</td>
                <td class="row-sub">${formatDateShort(h.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid grid-2 stagger mt-16">
      <div class="card">
        <div class="section-head"><h2>Notifikasi Otomatis</h2></div>
        <label class="flex items-center gap-12 mt-8" style="font-size:13px;">
          <input type="checkbox" id="st-notif-pay" ${s.notif_on_payment ? 'checked' : ''}> Kirim notifikasi saat pembayaran dicatat
        </label>
        <label class="flex items-center gap-12 mt-16" style="font-size:13px;">
          <input type="checkbox" id="st-notif-exp" ${s.notif_on_expense ? 'checked' : ''}> Kirim notifikasi saat ada pengeluaran baru
        </label>
        <button class="btn btn-secondary mt-16" id="st-save-notif">${icon('check', 15)} Simpan Preferensi</button>
      </div>

      <div class="card">
        <div class="section-head"><h2>Keamanan Akun Admin</h2></div>
        <div class="text-3" style="font-size:12.5px;margin-bottom:10px;">Masuk sebagai ${user.name} (absen ${user.absen})</div>
        <div class="field"><label>Password Baru</label><input class="input" id="st-pass" type="password" placeholder="Minimal 6 karakter"></div>
        <button class="btn btn-secondary mt-8" id="st-save-pass">${icon('check', 15)} Ubah Password</button>
      </div>
    </div>
  `;

  container.querySelector('#st-save-app').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const class_name = container.querySelector('#st-class').value.trim();
    const app_name = container.querySelector('#st-app').value.trim();
    if (!class_name || !app_name) { toast('Nama kelas dan aplikasi wajib diisi.', 'error'); return; }
    btn.classList.add('btn-loading');
    try {
      await api.patch('/settings/app', { class_name, app_name });
      toast('Identitas kelas berhasil diperbarui', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Gagal menyimpan.', 'error');
    } finally { btn.classList.remove('btn-loading'); }
  });

  container.querySelector('#st-save-cash').addEventListener('click', () => {
    const amount = Number(container.querySelector('#st-amount').value);
    const effective = container.querySelector('#st-effective').value;
    if (!amount || amount <= 0) { toast('Nominal tidak valid.', 'error'); return; }
    if (amount === s.weekly_amount) { toast('Nominal baru sama dengan nominal saat ini.', 'error'); return; }

    confirmDialog({
      title: 'Ubah Nominal Kas',
      message: `Nominal kas mingguan akan berubah dari ${rupiah(s.weekly_amount)} menjadi ${rupiah(amount)}, berlaku mulai ${effective}. Semua member akan menerima notifikasi.`,
      confirmLabel: 'Ubah Nominal',
      onConfirm: async () => {
        await api.patch('/settings/cash', { weekly_amount: amount, effective_date: effective });
        toast('Nominal kas berhasil diperbarui', 'success');
        renderAdminSettings(container);
      }
    });
  });

  container.querySelector('#st-save-notif').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('btn-loading');
    try {
      await api.patch('/settings/app', {
        notif_on_payment: container.querySelector('#st-notif-pay').checked,
        notif_on_expense: container.querySelector('#st-notif-exp').checked
      });
      toast('Preferensi notifikasi disimpan', 'success');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Gagal menyimpan.', 'error');
    } finally { btn.classList.remove('btn-loading'); }
  });

  container.querySelector('#st-save-pass').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const password = container.querySelector('#st-pass').value;
    if (password.length < 6) { toast('Password minimal 6 karakter.', 'error'); return; }
    btn.classList.add('btn-loading');
    try {
      await api.patch(`/members/${user.id}`, { password });
      toast('Password berhasil diubah', 'success');
      container.querySelector('#st-pass').value = '';
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Gagal mengubah password.', 'error');
    } finally { btn.classList.remove('btn-loading'); }
  });
}
