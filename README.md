# 9D CONTROL KAS

Sistem manajemen kas kelas 9D — premium, aman, dan real-time. Full-stack (Node.js + Express + SQLite di backend, vanilla JS SPA dengan tema glassmorphism gelap di frontend — tanpa build step).

---

## 🚀 Quick Start

```bash
npm install
cp .env.example .env
```

Buka `.env` dan **ganti minimal**:
- `JWT_SECRET` dan `COOKIE_SECRET` — string acak yang panjang. Bisa generate dengan:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `ADMIN_PASSWORD` — password akun admin pertama kali.

Lalu jalankan:

```bash
npm start
```

Server berjalan di `http://localhost:3000`. Database SQLite (`database/kas.db`) dan data demo dibuat otomatis saat pertama kali dijalankan (idempotent — tidak akan menimpa data yang sudah ada).

---

## 🔑 Akun Demo

| Role   | Absen             | Password                                 |
|--------|--------------------|-------------------------------------------|
| Admin  | `ADMIN` (atau sesuai `ADMIN_ABSEN` di `.env`) | sesuai `ADMIN_PASSWORD` di `.env` |
| Member | `18` (Gibran Dwi Satrio) | sesuai `DEMO_MEMBER_PASSWORD` di `.env` (default: `kas9d2026`) |

Member demo lain yang ikut dibuat: `01` Andi Pratama, `02` Bima Saputra, `03` Citra Lestari, `04` Dinda Maharani, `05` Fajar Ramadhan — semua memakai password demo yang sama.

**Ganti semua password demo sebelum dipakai sungguhan di kelas.**

---

## 🧱 Tech Stack

- **Backend:** Node.js, Express, better-sqlite3 (SQLite, tanpa server DB terpisah), JWT (httpOnly cookie), bcryptjs, multer (upload bukti/lampiran), helmet, express-rate-limit
- **Frontend:** Vanilla JS (ES Modules) SPA dengan hash router — tanpa framework/bundler, tema dark glassmorphism (violet/magenta/silver), Chart.js untuk grafik
- **Database:** SQLite (file lokal di `database/kas.db`) — tidak perlu setup server database terpisah

---

## 📁 Struktur Proyek

```
9d-control-kas/
├── server/
│   ├── index.js            # entry point Express
│   ├── seed.js              # pembuat data demo (idempotent)
│   ├── db.js                 # koneksi SQLite + schema
│   ├── routes/                # semua endpoint API
│   ├── middleware/            # auth (JWT + role), upload, error handler
│   ├── services/               # logika kas (saldo, tunggakan, minggu), notifikasi
│   └── utils/                   # audit log, validasi input, async handler
├── public/
│   ├── index.html
│   ├── css/style.css          # design system (glassmorphism, dark violet/magenta)
│   └── js/
│       ├── core/               # api client, router, ui kit (toast/modal/drawer), charts
│       ├── layout.js            # sidebar/topbar/bottom-nav shell
│       └── pages/                # halaman admin/ dan member/
├── database/                  # file kas.db dibuat otomatis di sini
├── uploads/                   # bukti pengeluaran & lampiran report
├── .env.example
└── package.json
```

---

## ✅ Fitur Utama

- **Autentikasi & Role:** login nomor absen + password, JWT di httpOnly cookie, sesi dapat dicabut (logout / revoke), rate limiting + auto-lock setelah 5 kali gagal login. RBAC diverifikasi di **backend** (bukan hanya sembunyikan menu di frontend).
- **Dashboard Admin:** saldo kas, total pemasukan/pengeluaran, jumlah member, status bayar minggu ini, total tunggakan, grafik pemasukan/pengeluaran/saldo/pembayaran per minggu, daftar tunggakan terbesar.
- **Tambah Pemasukan:** alur terpandu (cari member → pilih → isi detail → preview → konfirmasi), backend menghitung ulang saldo & status tunggakan otomatis, member menerima notifikasi.
- **Tambah Pengeluaran:** dengan bukti (upload gambar/PDF), alasan, target notifikasi (semua/tertentu).
- **Kas Mingguan:** ringkasan per minggu (siapa sudah/belum bayar, total masuk), detail per minggu untuk admin.
- **Tunggakan:** dihitung otomatis di backend berdasarkan jumlah minggu berjalan dikurangi minggu yang sudah dibayar member — **tidak pernah** mempercayai nominal dari frontend.
- **Kenaikan Nominal Kas:** riwayat nominal tersimpan (`cash_rate_history`), transaksi lama tidak diubah otomatis, member mendapat notifikasi otomatis saat nominal berubah.
- **Notifikasi:** admin dapat kirim ke semua/tertentu, badge unread, tersimpan di database.
- **Report Center:** member dapat melaporkan masalah (dengan lampiran), admin bisa membalas & mengubah status (Open/Diproses/Selesai/Ditolak).
- **Audit Log:** semua aksi penting (login/logout, tambah/void pemasukan & pengeluaran, ubah nominal, ubah member, kirim notifikasi, dll) tercatat dengan aktor & waktu.
- **UI/UX:** dark glassmorphism premium (violet/magenta/silver — tanpa merah/hijau/biru sebagai warna utama), modal/drawer/toast, skeleton loading, empty & error state, animasi halus, responsive (mobile bottom-nav + FAB, desktop sidebar).
- **Banner APK Coming Soon** — tanpa link palsu.

---

## 🔒 Keamanan yang Diimplementasikan

- Password di-hash dengan bcrypt (12 rounds), tidak pernah disimpan plaintext
- Sesi JWT di httpOnly cookie (bukan localStorage), dengan tabel `sessions` agar bisa dicabut/logout sungguhan
- Rate limiting khusus endpoint login + auto-lock akun 15 menit setelah 5 kali gagal
- Middleware otorisasi berbasis role di **setiap** endpoint backend — bukan hanya UI
- Validasi & sanitasi input di semua endpoint yang menerima data
- Parameterized query (better-sqlite3 prepared statements) — aman dari SQL injection
- Escaping HTML konsisten di frontend untuk semua teks bebas dari user (nama, catatan, alasan, deskripsi report) — mencegah XSS
- Validasi tipe & ukuran file upload (JPG/PNG/WEBP/PDF, maksimum sesuai `MAX_UPLOAD_MB`)
- Helmet untuk security headers + Content-Security-Policy, CORS dikonfigurasi, `x-powered-by` dimatikan
- Error handler terpusat — tidak pernah membocorkan stack trace ke client
- Saldo & tunggakan **selalu dihitung ulang di backend** dari data transaksi, tidak pernah dipercaya dari frontend
- Audit log untuk semua aksi sensitif

---

## 🧪 Checklist Testing Sebelum Dipakai

- [ ] Login admin berhasil dengan kredensial dari `.env`
- [ ] Login member berhasil (absen `18`, password demo)
- [ ] Tambah pemasukan → saldo & status member ter-update
- [ ] Tambah pengeluaran (dengan & tanpa bukti) → saldo berkurang
- [ ] Perhitungan saldo (`total pemasukan - total pengeluaran`) akurat
- [ ] Perhitungan tunggakan akurat sesuai jumlah minggu berjalan
- [ ] Kas mingguan menampilkan status bayar per member dengan benar
- [ ] Ubah nominal kas → riwayat tersimpan, notifikasi terkirim ke semua member
- [ ] Notifikasi (broadcast & tertentu) diterima dan bisa ditandai dibaca
- [ ] Member dapat membuat report, admin dapat membalas & mengubah status
- [ ] Member **tidak bisa** mengakses endpoint/menu admin (coba akses langsung via API)
- [ ] Semua aksi penting muncul di Audit Log
- [ ] Tampilan responsive di mobile (bottom nav + FAB), tablet, dan desktop (sidebar)

---

## ⚠️ Catatan Penting

- **Ganti semua secret & password default** (`JWT_SECRET`, `COOKIE_SECRET`, `ADMIN_PASSWORD`, `DEMO_MEMBER_PASSWORD`) sebelum dipakai di luar demo lokal.
- File di `uploads/` (bukti pengeluaran, lampiran report) disajikan secara statis dengan nama file acak/tidak mudah ditebak. Untuk keamanan lebih ketat (mewajibkan login untuk membuka setiap file), pindahkan route `/uploads` ke belakang middleware otentikasi.
- Aplikasi ini didesain agar **tetap ringan** meski banyak elemen visual — tanpa framework frontend besar, animasi memakai CSS, dan library eksternal (Chart.js) dimuat lewat CDN.
- Versi APK mobile masih dalam pengembangan (lihat banner "Coming Soon" di dashboard).

---

## 📡 Ringkasan API

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/members                 (admin, ?search=&status=)
GET    /api/members/:id
POST   /api/members                 (admin)
PATCH  /api/members/:id             (admin)

POST   /api/payments                (admin)
GET    /api/payments
GET    /api/payments/:id
PATCH  /api/payments/:id/void       (admin)

POST   /api/expenses                (admin, multipart: receipt)
GET    /api/expenses
GET    /api/expenses/:id
PATCH  /api/expenses/:id/void       (admin)

GET    /api/weekly-cash
GET    /api/weekly-cash/:week       (admin)

GET    /api/notifications
POST   /api/notifications           (admin)
PATCH  /api/notifications/:id/read
PATCH  /api/notifications/read-all

GET    /api/reports
POST   /api/reports                 (multipart: attachment)
PATCH  /api/reports/:id             (admin)

GET    /api/audit-logs              (admin)

GET    /api/settings/public
GET    /api/settings                (admin)
PATCH  /api/settings/cash           (admin)
PATCH  /api/settings/app            (admin)

GET    /api/dashboard/admin         (admin)
GET    /api/dashboard/member
```

---

Dibuat dengan fokus pada **security, backend fungsional, dan akurasi perhitungan kas** sebagai prioritas utama — bukan sekadar tampilan.
