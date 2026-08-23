import { api } from '../../core/api.js';
import { icon, rupiah, statusBadge, formatDateShort, errorState, skeletonRows } from '../../core/ui.js';
import { setPageTitle } from '../../layout.js';
import { getState } from '../../core/state.js';

export async function renderMemberProfile(container) {
  const user = getState().user;
  setPageTitle('Profile', 'Informasi akun kamu');
  container.innerHTML = skeletonRows(4);

  let member;
  try {
    const res = await api.get(`/members/${user.id}`);
    member = res.member;
  } catch {
    container.innerHTML = '';
    container.appendChild(errorState({ onRetry: () => renderMemberProfile(container) }));
    return;
  }

  container.innerHTML = `
    <div class="card card-glass-strong fade-in" style="text-align:center;padding:32px 20px;">
      <div class="avatar" style="width:72px;height:72px;font-size:22px;margin:0 auto 14px;">${member.absen}</div>
      <div style="font-family:var(--font-display);font-weight:700;font-size:18px;">${member.name}</div>
      <div class="text-3" style="font-size:12.5px;margin-top:2px;">Absen ${member.absen} &middot; Member Kelas 9D</div>
      <div style="margin-top:12px;">${statusBadge(member.status)}</div>
    </div>

    <div class="grid grid-2 stagger mt-16">
      <div class="card"><div class="stat-label">Total Dibayar</div><div class="mono mt-8" style="font-size:17px;">${rupiah(member.total_paid)}</div></div>
      <div class="card"><div class="stat-label">Tunggakan</div><div class="mono mt-8" style="font-size:17px;color:${member.arrears_amount>0?'var(--rose)':'var(--text-1)'};">${rupiah(member.arrears_amount)}</div></div>
      <div class="card"><div class="stat-label">Bergabung Sejak</div><div class="mt-8" style="font-size:14px;">${formatDateShort(member.created_at)}</div></div>
      <div class="card"><div class="stat-label">Status Akun</div><div class="mt-8">${member.active ? '<span class="badge badge-lunas">Aktif</span>' : '<span class="badge badge-neutral">Nonaktif</span>'}</div></div>
    </div>

    <div class="card mt-16">
      <div class="section-head"><h2>Keamanan Akun</h2></div>
      <div class="flex items-start gap-12" style="font-size:12.5px;color:var(--text-2);line-height:1.6;">
        ${icon('settings', 16)}
        <p style="margin:0;">Untuk mengubah password, hubungi admin kelas melalui menu <b>Report</b> dengan kategori <b>Akun</b>.</p>
      </div>
    </div>
  `;
}
