import { api } from '../../core/api.js';
import { icon, timeAgo, errorState, emptyState, skeletonRows, toast } from '../../core/ui.js';
import { setPageTitle, refreshUnread, escapeHtml } from '../../layout.js';

export async function renderMemberNotifications(container) {
  setPageTitle('Notifikasi', 'Semua pemberitahuan untuk kamu');

  container.innerHTML = `
    <div class="flex justify-between items-center mt-8" style="margin-bottom:16px;">
      <span class="text-3" style="font-size:12.5px;" id="unread-label"></span>
      <button class="btn btn-ghost btn-sm" id="mark-all">Tandai semua dibaca</button>
    </div>
    <div id="nlist">${skeletonRows(6)}</div>
  `;

  const listEl = container.querySelector('#nlist');

  async function load() {
    listEl.innerHTML = skeletonRows(6);
    try {
      const res = await api.get('/notifications');
      container.querySelector('#unread-label').textContent = `${res.unread_count} belum dibaca`;
      if (!res.notifications.length) {
        listEl.innerHTML = '';
        listEl.appendChild(emptyState({ icon: 'inbox', title: 'Belum Ada Notifikasi', desc: 'Notifikasi baru akan muncul di sini.' }));
        return;
      }
      listEl.innerHTML = `<div class="flex flex-col gap-10 stagger">${res.notifications.map(n => `
        <div class="notif-item ${n.read_at ? '' : 'unread'}" data-rid="${n.recipient_id}" style="cursor:pointer;">
          <div class="notif-dot-icon">${icon(iconForType(n.type), 16)}</div>
          <div>
            <div class="notif-title">${escapeHtml(n.title)}</div>
            <div class="notif-body">${escapeHtml(n.body)}</div>
            <div class="notif-time">${timeAgo(n.created_at)}</div>
          </div>
        </div>
      `).join('')}</div>`;

      listEl.querySelectorAll('[data-rid]').forEach(item => {
        item.addEventListener('click', async () => {
          if (!item.classList.contains('unread')) return;
          item.classList.remove('unread');
          try { await api.patch(`/notifications/${item.dataset.rid}/read`, {}); refreshUnread(); } catch { /* ignore */ }
        });
      });
    } catch {
      listEl.innerHTML = '';
      listEl.appendChild(errorState({ onRetry: load }));
    }
  }

  function iconForType(type) {
    return { PAYMENT: 'income', EXPENSE: 'expense', ANNOUNCEMENT: 'bell', REPORT: 'report', SYSTEM: 'settings' }[type] || 'bell';
  }

  container.querySelector('#mark-all').addEventListener('click', async () => {
    try {
      await api.patch('/notifications/read-all', {});
      toast('Semua notifikasi ditandai dibaca', 'success');
      refreshUnread();
      load();
    } catch {
      toast('Gagal menandai notifikasi.', 'error');
    }
  });

  load();
}
