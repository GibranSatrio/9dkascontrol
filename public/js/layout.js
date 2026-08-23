import { icon, toast, confirmDialog, openDrawer, timeAgo } from './core/ui.js';
import { api } from './core/api.js';
import { navigate } from './core/router.js';
import { getState, setUser, setUnreadNotif, subscribe } from './core/state.js';

const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/admin/members', label: 'Members', icon: 'members' },
  { path: '/admin/weekly-cash', label: 'Kas Mingguan', icon: 'weekly' },
  { path: '/admin/payments', label: 'Pemasukan', icon: 'income' },
  { path: '/admin/expenses', label: 'Pengeluaran', icon: 'expense' },
  { path: '/admin/arrears', label: 'Tunggakan', icon: 'arrears' },
  { path: '/admin/notifications', label: 'Notifications', icon: 'bell' },
  { path: '/admin/reports', label: 'Reports', icon: 'report' },
  { path: '/admin/audit-logs', label: 'Audit Logs', icon: 'audit' },
  { path: '/admin/settings', label: 'Settings', icon: 'settings' }
];

const ADMIN_BOTTOM = ['/admin/dashboard', '/admin/members', '/admin/payments', '/admin/expenses'];

const MEMBER_NAV = [
  { path: '/member/dashboard', label: 'Home', icon: 'home' },
  { path: '/member/cash', label: 'Kas Saya', icon: 'wallet' },
  { path: '/member/history', label: 'Riwayat', icon: 'history' },
  { path: '/member/notifications', label: 'Notifikasi', icon: 'bell' },
  { path: '/member/reports', label: 'Report', icon: 'report' },
  { path: '/member/profile', label: 'Profile', icon: 'user' }
];

const MEMBER_BOTTOM = ['/member/dashboard', '/member/cash', '/member/history', '/member/notifications', '/member/profile'];

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function setPageTitle(title, sub = '') {
  const t = document.getElementById('page-title');
  const s = document.getElementById('page-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

async function doLogout() {
  try { await api.post('/auth/logout', {}); } catch { /* ignore, clear client state regardless */ }
  setUser(null);
  location.hash = '/login';
  location.reload();
}

function navItemHtml(item, mode = 'side') {
  if (mode === 'side') {
    return `<a class="nav-item" href="#${item.path}" data-route="${item.path}">${icon(item.icon, 18)}<span>${item.label}</span></a>`;
  }
  return `<a class="bn-item" href="#${item.path}" data-route="${item.path}">${icon(item.icon, 20)}<span>${item.label}</span></a>`;
}

async function openNotifDrawer(user) {
  openDrawer({
    title: 'Notifikasi',
    body: async (el, close) => {
      el.innerHTML = `<div class="flex flex-col gap-12">${Array.from({length:4}).map(()=>'<div class="skel skel-row"></div>').join('')}</div>`;
      try {
        const res = await api.get('/notifications');
        if (!res.notifications.length) {
          el.innerHTML = '';
          el.appendChild(emptyNotif());
          return;
        }
        el.innerHTML = `<div class="flex flex-col gap-10 stagger">${res.notifications.map(n => `
          <div class="notif-item ${n.read_at ? '' : 'unread'}" data-rid="${n.recipient_id}">
            <div class="notif-dot-icon">${icon(iconForType(n.type), 16)}</div>
            <div>
              <div class="notif-title">${escapeHtml(n.title)}</div>
              <div class="notif-body">${escapeHtml(n.body)}</div>
              <div class="notif-time">${timeAgo(n.created_at)}</div>
            </div>
          </div>
        `).join('')}</div>`;
        el.querySelectorAll('[data-rid]').forEach(item => {
          item.addEventListener('click', async () => {
            if (!item.classList.contains('unread')) return;
            item.classList.remove('unread');
            try {
              await api.patch(`/notifications/${item.dataset.rid}/read`, {});
              refreshUnread();
            } catch { /* non-critical */ }
          });
        });
      } catch (err) {
        el.innerHTML = '';
        const { errorState } = await import('./core/ui.js');
        el.appendChild(errorState({ onRetry: () => openNotifDrawer(user) }));
      }
    }
  });
}

function iconForType(type) {
  return { PAYMENT: 'income', EXPENSE: 'expense', ANNOUNCEMENT: 'bell', REPORT: 'report', SYSTEM: 'settings' }[type] || 'bell';
}

function emptyNotif() {
  const wrap = document.createElement('div');
  wrap.className = 'state-block';
  wrap.innerHTML = `<div class="state-icon">${icon('inbox', 24)}</div><div class="state-title">Belum Ada Notifikasi</div><div class="state-desc">Notifikasi baru akan muncul di sini.</div>`;
  return wrap;
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function refreshUnread() {
  try {
    const res = await api.get('/notifications');
    setUnreadNotif(res.unread_count || 0);
  } catch { /* ignore */ }
}

export function renderShell(rootEl, user) {
  const isAdmin = user.role === 'ADMIN';
  const nav = isAdmin ? ADMIN_NAV : MEMBER_NAV;
  const bottomPaths = isAdmin ? ADMIN_BOTTOM : MEMBER_BOTTOM;
  const bottomItems = bottomPaths.map(p => nav.find(n => n.path === p));

  rootEl.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">9D</div>
          <div class="brand-text">
            <div class="name">CONTROL KAS</div>
            <div class="sub">${isAdmin ? 'Admin Panel' : 'Member Panel'}</div>
          </div>
        </div>
        <div class="nav-group">
          <div class="nav-label">Menu</div>
          ${nav.map(item => navItemHtml(item, 'side')).join('')}
        </div>
        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="avatar">${initials(user.name)}</div>
            <div>
              <div class="u-name">${escapeHtml(user.name)}</div>
              <div class="u-role">Absen ${escapeHtml(user.absen)} &middot; ${isAdmin ? 'Admin' : 'Member'}</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-block logout-btn" id="logout-btn" type="button">${icon('logout', 15)} Keluar</button>
        </div>
      </aside>

      <div class="main-col">
        <header class="topbar">
          <div>
            <div class="page-title" id="page-title">Dashboard</div>
            <div class="page-sub" id="page-sub"></div>
          </div>
          <div class="topbar-actions">
            <button class="icon-btn" id="bell-btn" type="button" aria-label="Notifikasi">
              ${icon('bell', 18)}
              <span class="notif-dot" id="notif-dot" hidden></span>
            </button>
          </div>
        </header>
        <main class="content" id="route-outlet"></main>
      </div>
    </div>

    <nav class="bottom-nav">
      <div class="bottom-nav-row">
        ${bottomItems.map(item => navItemHtml(item, 'bottom')).join('')}
      </div>
    </nav>
  `;

  rootEl.querySelector('#logout-btn').addEventListener('click', () => {
    confirmDialog({
      title: 'Keluar dari Akun',
      message: 'Anda yakin ingin keluar? Anda perlu login kembali untuk mengakses 9D CONTROL KAS.',
      confirmLabel: 'Keluar',
      danger: true,
      onConfirm: doLogout
    });
  });

  rootEl.querySelector('#bell-btn').addEventListener('click', () => openNotifDrawer(user));

  subscribe((s) => {
    const dot = document.getElementById('notif-dot');
    if (dot) dot.hidden = !s.unreadNotif;
  });
  refreshUnread();

  return document.getElementById('route-outlet');
}
