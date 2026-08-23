class ValidationError extends Error {
  constructor(message, fields = {}) {
    super(message);
    this.name = 'ValidationError';
    this.status = 422;
    this.fields = fields;
  }
}

function isNonEmptyString(v, max = 500) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function isPositiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0;
}

function isPositiveAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 100000000 && Number.isInteger(n);
}

function isValidDateStr(v) {
  if (typeof v !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

// Strip characters that have no legitimate place in plain text fields and
// trim whitespace. This is defense-in-depth; output encoding on the
// frontend is what actually prevents XSS, but we never trust raw input.
function sanitizeText(v) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

function assert(cond, message, fields) {
  if (!cond) throw new ValidationError(message, fields);
}

module.exports = {
  ValidationError,
  isNonEmptyString,
  isPositiveInt,
  isPositiveAmount,
  isValidDateStr,
  sanitizeText,
  assert
};
