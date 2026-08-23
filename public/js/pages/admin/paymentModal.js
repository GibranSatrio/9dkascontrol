import { api, ApiError } from '../../core/api.js';
import { openModal, closeModal, toast, rupiah, icon } from '../../core/ui.js';
import { escapeHtml } from '../../layout.js';

export function openAddPaymentModal({ onSuccess, presetMember = null } = {}) {
  let selected = presetMember; // { id, absen, name, unpaid_week_numbers, weeks_elapsed }
  let settings = null;

  const { close, root } = openModal({
    title: 'Tambah Pemasukan',
    desc: 'Catat pembayaran kas untuk salah satu member.',
    size: 'lg',
    body: (el) => { renderStep(el); }
  });

  async function renderStep(el) {
    el.innerHTML = `<div class="skel skel-row"></div><div class="skel skel-row"></div><div class="skel skel-row"></div>`;
    if (!settings) {
      try {
        const res = await api.get('/weekly-cash');
        settings = res.settings;
      } catch {
        settings = { weekly_amount: 10000 };
      }
    }
    if (!selected) renderPickMember(el);
    else renderPaymentForm(el);
  }

  function renderPickMember(el) {
    el.innerHTML = `
      <div class="step-dots"><span class="on"></span><span></span></div>
      <div class="field">
        <label>Cari Member</label>
        <div class="input-icon-wrap">
          ${icon('search', 16)}
          <input class="input" id="pm-search" placeholder="Nomor absen atau nama..." autocomplete="off">
        </div>
      </div>
      <div class="search-results" id="pm-results"></div>
    `;
    const input = el.querySelector('#pm-search');
    const results = el.querySelector('#pm-results');
    let debounce;

    async function doSearch(q) {
      results.innerHTML = `<div class="skel skel-row"></div>`;
      try {
        const res = await api.get(`/members?search=${encodeURIComponent(q)}`);
        if (!res.members.length) {
          results.innerHTML = `<div class="text-3" style="font-size:13px;padding:10px 2px;">Member tidak ditemukan.</div>`;
          return;
        }
        results.innerHTML = res.members.map(m => `
          <div class="member-pick" data-id="${m.id}">
            <div class="avatar" style="width:36px;height:36px;font-size:12px;">${m.absen}</div>
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13.5px;">${escapeHtml(m.name)}</div>
              <div class="text-3" style="font-size:11.5px;">Absen ${m.absen} &middot; ${m.weeks_unpaid} minggu belum bayar</div>
            </div>
            ${icon('chevron', 16)}
          </div>
        `).join('');
        results.querySelectorAll('.member-pick').forEach(node => {
          node.addEventListener('click', () => {
            const m = res.members.find(x => String(x.id) === node.dataset.id);
            selected = m;
            renderStep(el);
          });
        });
      } catch {
        results.innerHTML = `<div class="text-3" style="font-size:13px;padding:10px 2px;">Gagal memuat data member.</div>`;
      }
    }

    doSearch('');
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => doSearch(input.value.trim()), 280);
    });
    input.focus();
  }

  function suggestedWeek() {
    if (selected.unpaid_week_numbers && selected.unpaid_week_numbers.length) return selected.unpaid_week_numbers[0];
    return (selected.weeks_elapsed || 0) + 1;
  }

  function renderPaymentForm(el) {
    const suggestWeek = suggestedWeek();
    el.innerHTML = `
      <div class="step-dots"><span class="on"></span><span class="on"></span></div>

      <div class="preview-box" style="margin-bottom:2px;">
        <div class="flex items-center gap-12">
          <div class="avatar" style="width:38px;height:38px;font-size:12px;">${selected.absen}</div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:14px;">${escapeHtml(selected.name)}</div>
            <div class="text-3" style="font-size:11.5px;">Absen ${selected.absen}</div>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="pm-change">Ganti</button>
        </div>
      </div>

      <div class="field">
        <label>Jenis Pembayaran</label>
        <select class="select" id="pm-type">
          <option value="Kas Mingguan">Kas Mingguan</option>
          <option value="Lainnya">Lainnya</option>
        </select>
      </div>

      <div class="field" id="pm-week-field">
        <label>Periode / Minggu ke-</label>
        <select class="select" id="pm-week"></select>
      </div>

      <div class="field">
        <label>Nominal</label>
        <input class="input mono" id="pm-amount" inputmode="numeric" value="${settings.weekly_amount}">
      </div>

      <div class="field">
        <label>Catatan <span class="text-3">(opsional)</span></label>
        <textarea class="textarea" id="pm-note" placeholder="Contoh: Pembayaran kas minggu ke-3" rows="2"></textarea>
      </div>

      <div class="preview-box" id="pm-preview"></div>
    `;

    el.querySelector('#pm-change').addEventListener('click', () => { selected = null; renderStep(el); });

    const typeSel = el.querySelector('#pm-type');
    const weekField = el.querySelector('#pm-week-field');
    const weekSel = el.querySelector('#pm-week');
    const amountInput = el.querySelector('#pm-amount');
    const noteInput = el.querySelector('#pm-note');

    function populateWeeks() {
      const opts = [];
      const totalWeeks = Math.max(selected.weeks_elapsed || 0, suggestWeek) + 2;
      for (let w = 1; w <= totalWeeks; w++) {
        const paid = selected.unpaid_week_numbers && !selected.unpaid_week_numbers.includes(w) && w <= (selected.weeks_elapsed || 0);
        opts.push(`<option value="${w}" ${w === suggestWeek ? 'selected' : ''}>${paid ? `Minggu ke-${w} (sudah lunas)` : `Minggu ke-${w}`}</option>`);
      }
      weekSel.innerHTML = opts.join('');
    }
    populateWeeks();

    function updatePreview() {
      const type = typeSel.value;
      const week = weekSel.value;
      const amount = Number(amountInput.value) || 0;
      el.querySelector('#pm-preview').innerHTML = `
        <div class="preview-row"><span class="k">Member</span><span class="v">${escapeHtml(selected.name)} (${selected.absen})</span></div>
        <div class="preview-row"><span class="k">Pembayaran</span><span class="v">${type}</span></div>
        ${type === 'Kas Mingguan' ? `<div class="preview-row"><span class="k">Periode</span><span class="v">Minggu ke-${week}</span></div>` : ''}
        <div class="preview-row"><span class="k">Nominal</span><span class="v mono">${rupiah(amount)}</span></div>
      `;
    }

    typeSel.addEventListener('change', () => {
      weekField.style.display = typeSel.value === 'Kas Mingguan' ? '' : 'none';
      updatePreview();
    });
    weekSel.addEventListener('change', updatePreview);
    amountInput.addEventListener('input', updatePreview);
    updatePreview();

    // Footer actions injected manually since openModal actions are fixed at creation time.
    let foot = root.querySelector('[data-foot]');
    if (!foot) {
      foot = document.createElement('div');
      foot.className = 'modal-foot';
      foot.setAttribute('data-foot', '');
      root.querySelector('.modal').appendChild(foot);
    }
    foot.innerHTML = `
      <button type="button" class="btn btn-secondary" id="pm-cancel">Batal</button>
      <button type="button" class="btn btn-primary" id="pm-confirm">${icon('check', 15)} Konfirmasi Pembayaran</button>
    `;
    foot.querySelector('#pm-cancel').addEventListener('click', close);
    foot.querySelector('#pm-confirm').addEventListener('click', async () => {
      const btn = foot.querySelector('#pm-confirm');
      const amount = Number(amountInput.value);
      if (!amount || amount <= 0) { toast('Nominal tidak valid.', 'error'); return; }

      btn.classList.add('btn-loading');
      try {
        await api.post('/payments', {
          member_id: selected.id,
          amount,
          payment_type: typeSel.value,
          week_number: typeSel.value === 'Kas Mingguan' ? Number(weekSel.value) : null,
          period_label: typeSel.value === 'Kas Mingguan' ? `Minggu ke-${weekSel.value}` : null,
          note: noteInput.value.trim() || null
        });
        toast('Pembayaran berhasil dicatat', 'success');
        close();
        if (onSuccess) onSuccess();
      } catch (err) {
        btn.classList.remove('btn-loading');
        toast(err instanceof ApiError ? err.message : 'Gagal menyimpan pembayaran.', 'error');
      }
    });
  }
}
