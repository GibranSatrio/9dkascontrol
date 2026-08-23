const { ValidationError } = require('../utils/validate');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Always log full detail server-side for debugging.
  console.error(`[error] ${req.method} ${req.originalUrl} ::`, err);

  if (err instanceof ValidationError || err.name === 'ValidationError') {
    return res.status(err.status || 422).json({ error: 'VALIDATION_ERROR', message: err.message, fields: err.fields || {} });
  }

  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'File atau data yang dikirim terlalu besar.' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'FILE_TOO_LARGE', message: 'Ukuran file melebihi batas maksimum.' });
  }

  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const message = status === 500
    ? 'Terjadi kesalahan pada server. Silakan coba lagi.'
    : (err.publicMessage || err.message || 'Terjadi kesalahan.');

  res.status(status).json({ error: err.code || 'SERVER_ERROR', message });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint tidak ditemukan.' });
}

module.exports = { errorHandler, notFoundHandler };
