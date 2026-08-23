import { api, ApiError } from '../core/api.js';
import { icon, toast } from '../core/ui.js';
import { setUser } from '../core/state.js';

export async function renderLogin(container, onSuccess) {
  let branding = { app_name: '9D CONTROL KAS', class_name: '9D' };
  try {
    branding = await api.get('/settings/public');
  } catch { /* fall back to defaults silently */ }

  container.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <div class="login-mark">9D</div>
          <div>
            <div class="login-title">${branding.app_name}</div>
            <div class="login-sub">Manajemen kas kelas ${branding.class_name} — aman &amp; real-time</div>
          </div>
        </div>

        <form class="login-form" id="login-form" novalidate>
          <div class="field">
            <label for="absen">Nomor Absen</label>
            <div class="input-icon-wrap">
              ${icon('user', 16)}
              <input class="input" id="absen" name="absen" type="text" inputmode="numeric" placeholder="Contoh: 18" autocomplete="username" required>
            </div>
            <span class="error-text" id="err-absen" hidden></span>
          </div>

          <div class="field">
            <label for="password">Password</label>
            <div class="input-icon-wrap">
              ${icon('eye', 16)}
              <input class="input" id="password" name="password" type="password" placeholder="Masukkan password" autocomplete="current-password" required style="padding-right:40px;">
              <button type="button" class="pw-toggle" id="pw-toggle" aria-label="Tampilkan password">${icon('eye', 16)}</button>
            </div>
            <span class="error-text" id="err-password" hidden></span>
          </div>

          <button type="submit" class="btn btn-primary btn-block" id="login-btn">
            ${icon('send', 15)} Masuk
          </button>
        </form>

        <div class="demo-hint">
          <b>Akun demo member:</b> absen <b>18</b> · Gibran Dwi Satrio<br>
          Gunakan password demo yang diberikan admin kelas kamu.
        </div>
        <div class="login-footer-note">Dilindungi otentikasi terenkripsi &middot; ${branding.app_name}</div>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const pwInput = container.querySelector('#password');
  const pwToggle = container.querySelector('#pw-toggle');
  const btn = container.querySelector('#login-btn');

  pwToggle.addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    pwToggle.innerHTML = icon(show ? 'eye-off' : 'eye', 16);
  });

  function clearErrors() {
    ['absen', 'password'].forEach(f => {
      container.querySelector(`#err-${f}`).hidden = true;
      container.querySelector(`#${f}`).classList.remove('has-error');
    });
  }

  function showFieldError(field, message) {
    const el = container.querySelector(`#err-${field}`);
    el.textContent = message;
    el.hidden = false;
    container.querySelector(`#${field}`).classList.add('has-error');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();
    const absen = form.absen.value.trim();
    const password = form.password.value;

    let hasError = false;
    if (!absen) { showFieldError('absen', 'Nomor absen wajib diisi.'); hasError = true; }
    if (!password) { showFieldError('password', 'Password wajib diisi.'); hasError = true; }
    if (hasError) return;

    btn.classList.add('btn-loading');
    btn.disabled = true;
    try {
      const res = await api.post('/auth/login', { absen, password });
      setUser(res.user);
      toast(`Selamat datang, ${res.user.name.split(' ')[0]}!`, 'success');
      onSuccess(res.user);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 423) {
          toast(err.message, 'error', 6000);
        } else if (err.status === 401) {
          showFieldError('password', err.message);
        } else {
          toast(err.message, 'error');
        }
      } else {
        toast('Terjadi kesalahan tak terduga.', 'error');
      }
    } finally {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  });
}
