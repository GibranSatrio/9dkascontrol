const BASE = '/api';

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: {}
  };

  if (body !== undefined) {
    if (isForm) {
      opts.body = body; // FormData - browser sets multipart headers
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  let res;
  try {
    res = await fetch(BASE + path, opts);
  } catch (err) {
    throw new ApiError('Tidak dapat terhubung ke server. Periksa koneksi Anda.', 0, null);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    const message = (data && data.message) || 'Terjadi kesalahan. Silakan coba lagi.';
    throw new ApiError(message, res.status, data);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  postForm: (path, formData) => request(path, { method: 'POST', body: formData, isForm: true }),
  patchForm: (path, formData) => request(path, { method: 'PATCH', body: formData, isForm: true })
};

export { ApiError };
