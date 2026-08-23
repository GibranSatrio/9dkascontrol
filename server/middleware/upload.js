const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safeName);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
    return cb(new Error('Tipe file tidak diizinkan. Gunakan JPG, PNG, WEBP, atau PDF.'));
  }
  cb(null, true);
}

const maxMb = Number(process.env.MAX_UPLOAD_MB || 5);

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxMb * 1024 * 1024, files: 1 }
});

module.exports = { upload, UPLOAD_DIR };
