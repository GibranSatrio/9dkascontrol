import { api } from './core/api.js';
import { registerRoute, setNotFound, beforeEach, startRouter, navigate } from './core/router.js';
import { getState, setUser, setReady } from './core/state.js';
import { renderShell } from './layout.js';
import { renderLogin } from './pages/login.js';
import { errorState, icon } from './core/ui.js';

import { renderAdminDashboard } from './pages/admin/dashboard.js';
import { renderAdminMembers } from './pages/admin/members.js';
import { renderAdminWeeklyCash } from './pages/admin/weeklyCash.js';
import { renderAdminPayments } from './pages/admin/payments.js';
import { renderAdminExpenses } from './pages/admin/expenses.js';
import { renderAdminArrears } from './pages/admin/arrears.js';
import { renderAdminNotifications } from './pages/admin/notifications.js';
import { renderAdminReports } from './pages/admin/reports.js';
import { renderAdminAuditLogs } from './pages/admin/auditLogs.js';
import { renderAdminSettings } from './pages/admin/settings.js';

import { renderMemberDashboard } from './pages/member/dashboard.js';
import { renderMemberCash } from './pages/member/cash.js';
import { renderMemberHistory } from './pages/member/history.js';
import { renderMemberNotifications } from './pages/member/notifications.js';
import { renderMemberReports } from './pages/member/reports.js';
import { renderMemberProfile } from './pages/member/profile.js';

const appRoot = document.getElementById('app');

async function boot() {
  let user = null;
  try {
    const res = await api.get('/auth/me');
    user = res.user;
  } catch {
    user = null;
  }
  setUser(user);
  setReady(true);

  if (!user) {
    renderLoginFlow();
    return;
  }
  renderAppFlow(user);
}

function renderLoginFlow() {
  appRoot.innerHTML = '<div id="login-outlet"></div>';
  const outlet = document.getElementById('login-outlet');
  renderLogin(outlet, (user) => {
    renderAppFlow(user);
  });
}

function guardRole(path, role) {
  if (role === 'ADMIN') return path.startsWith('/admin');
  return path.startsWith('/member');
}

function renderAppFlow(user) {
  const outlet = renderShell(appRoot, user);
  registerRoutes(outlet, user);

  beforeEach(({ path }) => {
    if (path === '/login') { location.hash = user.role === 'ADMIN' ? '/admin/dashboard' : '/member/dashboard'; return false; }
    if (!guardRole(path, user.role)) {
      location.hash = user.role === 'ADMIN' ? '/admin/dashboard' : '/member/dashboard';
      return false;
    }
    return true;
  });

  setNotFound((container) => {
    container.innerHTML = '';
    container.appendChild(errorState({
      title: 'Halaman Tidak Ditemukan',
      desc: 'Halaman yang Anda cari tidak tersedia.',
      onRetry: () => { location.hash = user.role === 'ADMIN' ? '/admin/dashboard' : '/member/dashboard'; }
    }));
  });

  startRouter(outlet);

  if (!location.hash || location.hash === '#/' || location.hash === '#/login') {
    location.hash = user.role === 'ADMIN' ? '/admin/dashboard' : '/member/dashboard';
  }
}

function registerRoutes(outlet, user) {
  // Admin
  registerRoute('/admin/dashboard', renderAdminDashboard);
  registerRoute('/admin/members', renderAdminMembers);
  registerRoute('/admin/weekly-cash', renderAdminWeeklyCash);
  registerRoute('/admin/payments', renderAdminPayments);
  registerRoute('/admin/expenses', renderAdminExpenses);
  registerRoute('/admin/arrears', renderAdminArrears);
  registerRoute('/admin/notifications', renderAdminNotifications);
  registerRoute('/admin/reports', renderAdminReports);
  registerRoute('/admin/audit-logs', renderAdminAuditLogs);
  registerRoute('/admin/settings', renderAdminSettings);

  // Member
  registerRoute('/member/dashboard', renderMemberDashboard);
  registerRoute('/member/cash', renderMemberCash);
  registerRoute('/member/history', renderMemberHistory);
  registerRoute('/member/notifications', renderMemberNotifications);
  registerRoute('/member/reports', renderMemberReports);
  registerRoute('/member/profile', renderMemberProfile);
}

boot();
