import { icon } from './icons.js';

/* ---------------- Formatters ---------------- */
export function rupiah(n) {
  const v = Math.round(Number(n) || 0);
  return 'Rp' + v.toLocaleString('id-ID');
}

export function formatDateShort(input) {
  if (!input) return '-';
  const d = new Date(String(input).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(input) {
  if (!input) return '-';
  const d = new Date(String(input).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return input;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(input) {
  if (!input) return '-';
  const d = new Date(String(input).replace(' ', 'T'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} hari lalu`;
  return formatDateShort(input);
}

export function statusLabel(status) {
  const map = {
    LUNAS: 'Lunas', SEBAGIAN: 'Sebagian', MENUNGGAK: 'Menunggak', BELUM_BAYAR: 'Belum Bayar',
    OPEN: 'Open', DIPROSES: 'Diproses', SELESAI: 'Selesai', DITOLAK: 'Ditolak'
  };
  return map[status] || status;
}

export function statusBadge(status) {
  const cls = String(status || '').toLowerCase();
  return `<span class="badge badge-${cls}">${statusLabel(status)}</span>`;
}

/* ---------------- Animated counter ---------------- */
export function animateCounter(el, target, { duration = 900, prefix = '', isCurrency = false } = {}) {
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const value = Math.round(start + (target - start) * eased);
    el.textContent = isCurrency ? rupiah(value) : (prefix + value.toLocaleString('id-ID'));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------------- Toast ---------------- */
const toastRoot = () => document.getElementById('toast-root');

export function toast(message, type = 'info', duration = 4200) {
  const root = toastRoot();
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert' : 'bell';
  el.innerHTML = `<span class="toast-icon">${icon(iconName, 13)}</span><span class="toast-msg"></span>`;
  el.querySelector('.toast-msg').textContent = message;
  root.appendChild(el);
  const remove = () => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
  };
  const t = setTimeout(remove, duration);
  el.addEventListener('click', () => { clearTimeout(t); remove(); });
}

/* ---------------- Modal ---------------- */
let modalStack = [];

export function closeModal() {
  const root = document.getElementById('modal-root');
  root.innerHTML = '';
  modalStack = [];
  document.removeEventListener('keydown', onModalKey);
}

function onModalKey(e) {
  if (e.key === 'Escape') closeModal();
}

/**
 * Opens a modal. `render(container, close)` should populate container.innerHTML
 * and wire up its own event listeners; call `close()` to dismiss.
 */
export function openModal({ title, desc = '', size = '', body, actions = [], onClose } = {}) {
  const root = document.getElementById('modal-root');
  const close = () => { closeModal(); if (onClose) onClose(); };

  root.innerHTML = `
    <div class="overlay" data-overlay>
      <div class="modal ${size === 'lg' ? 'modal-lg' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <div class="modal-title">${title}</div>
            ${desc ? `<div class="modal-desc">${desc}</div>` : ''}
          </div>
          <button class="modal-close" data-close type="button">${icon('close', 16)}</button>
        </div>
        <div class="modal-body" data-body></div>
        ${actions.length ? `<div class="modal-foot" data-foot></div>` : ''}
      </div>
    </div>
  `;

  root.querySelector('[data-overlay]').addEventListener('mousedown', (e) => {
    if (e.target.hasAttribute('data-overlay')) close();
  });
  root.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onModalKey);

  const bodyEl = root.querySelector('[data-body]');
  if (typeof body === 'function') body(bodyEl, close);
  else if (typeof body === 'string') bodyEl.innerHTML = body;

  if (actions.length) {
    const foot = root.querySelector('[data-foot]');
    for (const a of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${a.variant || 'btn-secondary'}`;
      btn.textContent = a.label;
      btn.addEventListener('click', () => a.onClick(close, btn));
      foot.appendChild(btn);
    }
  }

  modalStack.push(true);
  return { close, root };
}

export function confirmDialog({ title, message, confirmLabel = 'Konfirmasi', cancelLabel = 'Batal', danger = false, onConfirm }) {
  openModal({
    title,
    body: (el) => {
      el.innerHTML = `
        <div class="confirm-icon ${danger ? 'danger' : 'warn'}">${icon(danger ? 'trash' : 'alert', 22)}</div>
        <p style="font-size:13.5px;color:var(--text-2);line-height:1.6;margin:0;">${message}</p>
      `;
    },
    actions: [
      { label: cancelLabel, variant: 'btn-secondary', onClick: (close) => close() },
      {
        label: confirmLabel,
        variant: danger ? 'btn-danger' : 'btn-primary',
        onClick: async (close, btn) => {
          btn.classList.add('btn-loading');
          try {
            await onConfirm();
            close();
          } catch (err) {
            btn.classList.remove('btn-loading');
            toast(err.message || 'Terjadi kesalahan.', 'error');
          }
        }
      }
    ]
  });
}

export function reasonModal({ title, message, confirmLabel = 'Konfirmasi', onConfirm }) {
  openModal({
    title,
    body: (el) => {
      el.innerHTML = `
        <div class="confirm-icon danger">${icon('trash', 22)}</div>
        <p style="font-size:13.5px;color:var(--text-2);line-height:1.6;margin:0 0 4px;">${message}</p>
        <div class="field"><label>Alasan Pembatalan</label><textarea class="textarea" id="reason-input" rows="3" placeholder="Jelaskan alasan pembatalan..."></textarea></div>
      `;
    },
    actions: [
      { label: 'Batal', variant: 'btn-secondary', onClick: (close) => close() },
      {
        label: confirmLabel, variant: 'btn-danger',
        onClick: async (close, btn) => {
          const val = document.getElementById('reason-input').value.trim();
          if (!val) { toast('Alasan pembatalan wajib diisi.', 'error'); return; }
          btn.classList.add('btn-loading');
          try {
            await onConfirm(val);
            close();
          } catch (err) {
            btn.classList.remove('btn-loading');
            toast(err.message || 'Terjadi kesalahan.', 'error');
          }
        }
      }
    ]
  });
}

/* ---------------- Drawer ---------------- */
export function openDrawer({ title, body, onClose }) {
  const root = document.getElementById('drawer-root');
  const close = () => { root.innerHTML = ''; if (onClose) onClose(); };
  root.innerHTML = `
    <div class="drawer-overlay" data-doverlay></div>
    <div class="drawer" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div class="modal-title">${title}</div>
        <button class="modal-close" data-dclose type="button">${icon('close', 16)}</button>
      </div>
      <div data-dbody></div>
    </div>
  `;
  root.querySelector('[data-doverlay]').addEventListener('click', close);
  root.querySelector('[data-dclose]').addEventListener('click', close);
  const bodyEl = root.querySelector('[data-dbody]');
  if (typeof body === 'function') body(bodyEl, close);
  return { close };
}

/* ---------------- State blocks ---------------- */
export function emptyState({ icon: iconName = 'inbox', title, desc, actionLabel, onAction }) {
  const wrap = document.createElement('div');
  wrap.className = 'state-block fade-in';
  wrap.innerHTML = `
    <div class="state-icon">${icon(iconName, 26)}</div>
    <div class="state-title">${title}</div>
    <div class="state-desc">${desc}</div>
    ${actionLabel ? `<button class="btn btn-primary" type="button">${icon('plus', 15)} ${actionLabel}</button>` : ''}
  `;
  if (actionLabel && onAction) wrap.querySelector('button').addEventListener('click', onAction);
  return wrap;
}

export function errorState({ title = 'Terjadi Kesalahan', desc = 'Data belum dapat dimuat. Silakan coba lagi.', onRetry }) {
  const wrap = document.createElement('div');
  wrap.className = 'state-block fade-in';
  wrap.innerHTML = `
    <div class="state-icon err">${icon('alert', 26)}</div>
    <div class="state-title">${title}</div>
    <div class="state-desc">${desc}</div>
    <button class="btn btn-secondary" type="button">${icon('refresh', 15)} Coba Lagi</button>
  `;
  if (onRetry) wrap.querySelector('button').addEventListener('click', onRetry);
  return wrap;
}

export function skeletonCards(n = 4) {
  return `<div class="grid grid-stats">${Array.from({ length: n }).map(() => '<div class="skel skel-card"></div>').join('')}</div>`;
}

export function skeletonRows(n = 5) {
  return `<div>${Array.from({ length: n }).map(() => '<div class="skel skel-row"></div>').join('')}</div>`;
}

export { icon };
