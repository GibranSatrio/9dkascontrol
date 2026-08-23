import { api } from '../../core/api.js';
import { icon, rupiah, formatDateShort, errorState, emptyState, openDrawer, skeletonRows } from '../../core/ui.js';
import { setPageTitle, escapeHtml } from '../../layout.js';

export async function renderAdminWeeklyCash(container) {
  setPageTitle('Kas Mingguan', 'Pantau setoran kas per minggu');
  container.innerHTML = skeletonRows(6);

  let data;
  try {
    data = await api.get('/weekly-cash');
  } catch {
    container.innerHTML = '';
    container.appendChild(errorState({ onRetry: () => renderAdminWeeklyCash(container) }));
    return;
  }

  if (!data.weeks.length) {
    container.innerHTML = '';
    container.appendChild(emptyState({
      icon: 'weekly', title: 'Belum Ada Data Minggu', desc: 'Periode kas belum dimulai atau belum ada minggu yang berjalan.'
    }));
    return;
  }

  container.innerHTML = `<div class="grid grid-2 stagger">${data.weeks.map(w => weekCard(w)).join('')}</div>`;

  container.querySelectorAll('[data-week]').forEach(card => {
    card.addEventListener('click', () => openWeekDrawer(Number(card.dataset.week)));
  });
}

function weekCard(w) {
  const pct = w.total_members ? Math.round((w.paid_count / w.total_members) * 100) : 0;
  return `
    <div class="card card-hover fade-in" data-week="${w.week_number}" style="cursor:pointer;">
      <div class="flex items-center justify-between">
        <div>
          <div style="font-family:var(--font-display);font-weight:600;font-size:15px;">Minggu ${w.week_number}${w.is_current ? ' <span class="badge badge-diproses" style="margin-left:6px;">Berjalan</span>' : ''}</div>
          <div class="text-3" style="font-size:12px;">${formatDateShort(w.start_date)} - ${formatDateShort(w.end_date)}</div>
        </div>
        <div class="mono" style="font-size:14px;color:var(--violet-soft);">${rupiah(w.amount_per_member)}</div>
      </div>
      <div class="mt-16">
        <div class="flex justify-between text-3" style="font-size:11.5px;margin-bottom:6px;">
          <span>Sudah bayar: ${w.paid_count}/${w.total_members}</span><span>${pct}%</span>
        </div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="flex justify-between mt-16" style="font-size:12.5px;">
        <span class="text-3">Total masuk</span>
        <span class="mono" style="font-weight:600;">${rupiah(w.total_income)}</span>
      </div>
    </div>
  `;
}

function openWeekDrawer(weekNumber) {
  openDrawer({
    title: `Detail Minggu ${weekNumber}`,
    body: async (el) => {
      el.innerHTML = skeletonRows(5);
      try {
        const res = await api.get(`/weekly-cash/${weekNumber}`);
        const paid = res.members.filter(m => m.paid);
        const unpaid = res.members.filter(m => !m.paid);
        el.innerHTML = `
          <div class="preview-box mt-8" style="margin-bottom:18px;">
            <div class="preview-row"><span class="k">Periode</span><span class="v">${formatDateShort(res.start_date)} - ${formatDateShort(res.end_date)}</span></div>
            <div class="preview-row"><span class="k">Nominal / Member</span><span class="v mono">${rupiah(res.amount_per_member)}</span></div>
          </div>
          <div class="section-head"><h2 style="font-size:13px;">Sudah Bayar (${paid.length})</h2></div>
          <div class="flex flex-col gap-8 mt-8">
            ${paid.map(m => memberRow(m, true)).join('') || `<div class="text-3" style="font-size:12.5px;">Belum ada yang bayar.</div>`}
          </div>
          <div class="section-head mt-24"><h2 style="font-size:13px;">Belum Bayar (${unpaid.length})</h2></div>
          <div class="flex flex-col gap-8 mt-8">
            ${unpaid.map(m => memberRow(m, false)).join('') || `<div class="text-3" style="font-size:12.5px;">Semua sudah bayar 🎉</div>`}
          </div>
        `;
      } catch {
        el.innerHTML = '';
        el.appendChild(errorState({ onRetry: () => openWeekDrawer(weekNumber) }));
      }
    }
  });
}

function memberRow(m, paid) {
  return `
    <div class="flex items-center gap-12" style="padding:8px 0;">
      <div class="avatar" style="width:30px;height:30px;font-size:10.5px;">${m.absen}</div>
      <div style="flex:1;font-size:13px;">${escapeHtml(m.name)}</div>
      <span class="badge ${paid ? 'badge-lunas' : 'badge-menunggak'}">${paid ? 'Lunas' : 'Belum'}</span>
    </div>
  `;
}
