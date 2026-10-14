# TODO — SPMB Terpadu 2026/2027

Roadmap menuju aplikasi **siap pakai**. Satu project Laravel 13 + MySQL dengan frontend
React (`resources/js/`). Sumber kebenaran tetap: [PRD](PRD_SPMB_Terpadu_2026_2027.md),
[ERD](ERD_SPMB_Terpadu_2026_2027.md), [AGENTS](AGENTS.md), [AI_RULES](AI_RULES.md).
Panduan frontend: [FRONTEND.md](FRONTEND.md).

Versi sebelumnya (2257 baris, ditulis untuk stack Django) sudah diganti. Nomor milestone
F13–F22 dipertahankan karena dirujuk dokumen lain.

**Konvensi:** `[ ]` belum, `[-]` berjalan, `[x]` selesai, `[!]` terblokir (beri catatan satu baris).
Jangan centang bila test atau kriteria selesai belum terpenuhi (lihat *Definition of Done* di
`AGENTS.md`). Prioritas bila ada konflik: benar → aman → integritas data → integritas
workflow → mudah dirawat → UX → performa.

## Status saat ini (2026-10-14)

| Area | Status |
| --- | --- |
| Auth, RBAC, token Sanctum | Selesai (F1–F3) |
| Tahun ajaran, periode, ketersediaan | Selesai (F4) |
| Calon siswa, wali, pendaftaran + state machine | Selesai (F5–F6) |
| Berkas privat, verifikasi | Selesai (F7–F8) |
| Penilaian, ranking, keputusan, daftar tunggu | Selesai (F9–F10) |
| Pengumuman + surat PDF, daftar ulang | Selesai (F11–F12) |
| Frontend: semua alur di atas + data master admin | Ada, belum dipoles (F19) |
| Pembayaran manual (F13), enrollment/siswa (F14), MPLS (F15) | Selesai |
| Notifikasi email (F16), dashboard + laporan CSV (F17) | Selesai (inti) |
| Audit log, hardening privasi | Sebagian besar (F18) |
| Paket deploy, E2E, go-live | Belum (F20–F22) |

Test: 115 backend (PHPUnit, lulus di SQLite dan MySQL 8), 48 frontend (Vitest); CI backend (SQLite + MySQL) dan frontend.

---

# P0 — Fondasi dan keamanan (kerjakan lebih dulu)

## F0 — Repo & tooling
- [x] Merge branch `merge-backend-frontend` ke `main` (PR #2).
- [x] Suite Unit kini ada (`tests/Unit/ApplicationStateMachineTest.php`); `php artisan test` jalan tanpa argumen (59 test).
- [x] `.devcontainer/setup.sh`: `DB_DATABASE` diarahkan ke `database/database.sqlite` (sebelumnya SQLite menulis ke file `spmb`).
- [x] `composer dev` ternyata valid (`artisan dev` bawaan Laravel 13: server, queue, logs, vite); tidak perlu diubah.
- [ ] Verifikasi CI hijau di GitHub (backend SQLite, backend MySQL, frontend) pada layout baru.
- [x] Variabel env production didokumentasikan di `INFRASTRUCTURE.md`.

## F18 — Audit, privasi, keamanan
- [x] Audit log append-only (`audit_logs`, `AuditService`, `GET /api/v1/audit-logs` dengan izin `audit.read`): status pendaftaran, keputusan (termasuk override), nilai, verifikasi/revisi/akses berkas, penugasan verifikator, publikasi pengumuman. Test: `AuditLogTest`.
- [ ] Audit log lanjutan: perubahan role/permission pengguna (belum ada endpoint-nya), konfigurasi sensitif (periode, bobot komponen), dan halaman viewer audit di frontend.
- [x] Rate limit: login (5 gagal / 15 menit + throttle rute), register, cek hasil publik, unggah berkas, lupa/reset/ganti sandi (`throttle:*` di `routes/api.php`).
- [x] Reset kata sandi lewat email (`POST /auth/forgot-password`, `/auth/reset-password`; tanpa membocorkan email terdaftar; email via queue; halaman `/forgot-password` dan `/reset-password`) dan ganti sandi (`POST /auth/change-password`, mencabut token lain). Reset/ganti sandi tercatat di audit log; token API dicabut saat reset.
- [ ] Tinjau masa berlaku token Sanctum (default 7 hari) dan UI ganti sandi di halaman akun (F19). Akun yang hanya memakai nomor HP belum bisa reset sandi mandiri.
- [x] Masking data sensitif (`App\Support\Masking`): NIK, nomor KK, serta NIK/HP/email/penghasilan wali hanya penuh untuk pemilik dan peran dengan `application.verify` / `document.verify` / `application.override`; penilai, keuangan, dan petugas MPLS menerima nilai tersamar (4 digit terakhir; penghasilan `null`). Test: `PrivacyTest`. Catatan: aturan ini keputusan desain (data minimisation), tinjau bersama PRD bila peran baru ditambahkan.
- [x] Akses dokumen privat ditinjau: hanya pemilik dan staf berizin (`checkAccess`), setiap akses termasuk unduhan lewat token bertanda tangan masuk audit log, dan `storage_key` tidak lagi bocor di respons API.
- [ ] Bila memakai S3: ganti unduhan streaming dengan URL bertanda tangan berumur pendek (token bertanda tangan sudah ada di `PrivateStorage::signedToken`, belum ada endpoint penerbitnya).
- [x] `DemoSeeder` menolak jalan di production (guard + test); `DatabaseSeeder` juga melewatinya.
- [ ] Kebijakan retensi dan penghapusan data/berkas pendaftar; catat di dokumen.
- [x] Header keamanan (`SecurityHeaders` middleware global): `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, CSP ketat untuk shell SPA (dilewati saat dev server Vite aktif), HSTS hanya di HTTPS production. CORS default tidak mengizinkan origin mana pun (app satu origin). Test: `SecurityHeadersTest`; CSP diuji di browser tanpa pelanggaran.
- [ ] Di belakang reverse proxy: set trusted proxies agar `isSecure()` benar (HSTS) dan pastikan proxy meneruskan `X-Forwarded-Proto` (dicatat di F21).

## F16 — Notifikasi (minimum)
- [x] Email transaksional (Indonesia, queue, `afterCommit`, mailer `log` di dev): reset sandi, pendaftaran diterima, berkas perlu revisi, pendaftaran terverifikasi, jadwal asesmen (baru/diubah/dibatalkan, waktu dalam WIB), dan hasil seleksi diumumkan. Aturan privasi: email tidak pernah memuat isi keputusan, keputusan tidak memicu email sebelum pengumuman, dan pengumuman hanya dikirim sekali (publikasi ulang atau bertanggal masa depan tidak mengirim). Test: `NotificationTest`.
- [x] Bisnis hanya memicu *notification intent* lewat `NotificationService`; kelas notifikasi ada di `app/Notifications`. Akun tanpa email (hanya nomor HP) dilewati tanpa error.
- [x] Log pengiriman: tabel `notification_logs` (user, jenis, channel, SENT/FAILED), diisi listener `NotificationSent`/`NotificationFailed`.
- [ ] Email pengumuman yang dijadwalkan ke masa depan, dan pengingat tenggat daftar ulang: butuh scheduler (`schedule:run`, dikerjakan bersama F21).
- [ ] Worker queue wajib jalan di production (`queue:work`); tanpa worker email tidak terkirim. Tampilkan/alert pengiriman FAILED (viewer log di frontend atau monitoring).
- [ ] (Opsional) WhatsApp/SMS setelah email stabil.

---

# P1 — Melengkapi siklus penerimaan

## F13 — Keuangan & pembayaran
- [x] Skema sesuai ERD 13: `invoices`, `payments`, `payment_histories` (migrasi 000203; ditambah metadata bukti: nama berkas, MIME, ukuran, checksum) dan izin `payment.read` untuk finance/admin (migrasi 000204). Tagihan dibuat manual oleh staf (`payment.verify` / `application.override`) per pendaftaran; jenis tagihan bebas (ERD tidak membakukan).
- [x] Alur manual: orang tua unggah bukti (PDF/JPG/PNG ≤ 2 MB, MIME dideteksi server, disimpan privat) → status `PENDING` → staf keuangan setujui/tolak (alasan wajib saat menolak, tidak bisa diulang). Status tagihan (UNPAID/PARTIALLY_PAID/PAID) selalu dihitung server dari pembayaran yang disetujui; jumlah `PENDING` dicadangkan sehingga tidak bisa melebihi sisa; kedaluwarsa dihitung lazy (EXPIRED). Pembebasan = batalkan tagihan dengan alasan wajib. Riwayat (`payment_histories`) dan audit log di setiap perubahan, termasuk akses ke bukti. Test: `PaymentFlowTest`.
- [ ] Integrasi payment gateway (Midtrans/Xendit) hanya bila diputuskan; webhook idempoten dan rekonsiliasi. (`PaymentService` dipisah dari controller agar mudah ditambah penyedia.)
- [x] Daftar ulang tidak bisa diselesaikan selama ada tagihan belum lunas; tagihan yang dibatalkan (dibebaskan) tidak menghalangi (AGENTS §22).
- [x] UI orang tua (`PaymentCard` di halaman pendaftaran) dan UI staf (`/keuangan`: antrean verifikasi, lihat bukti, setujui/tolak, buat/batalkan tagihan); test Vitest `payment.test.tsx`. Diuji di browser dengan alur penuh (buat tagihan → unggah bukti sebagian → setujui → PARTIALLY_PAID).
- [ ] Keputusan produk: penetapan biaya otomatis per periode/jenis (saat ini staf mengisi nominal manual), nomor rekening/instruksi transfer yang ditampilkan ke orang tua, refund (`REFUNDED` sudah ada sebagai status, belum ada aksinya), dan email "tagihan baru"/"pembayaran diverifikasi" (F16).

## F14 — Enrollment & siswa
- [x] Skema ERD 14 (`enrollments`, `students`; migrasi 000205). Enrollment dipicu **manual** oleh staf (`enrollment.manage` / `application.override`) di halaman `/siswa`; **NIS diketik staf** (huruf/angka/`.`/`/`/`-`, unik tanpa beda huruf besar-kecil). Semua prasyarat AGENTS §22 dicek ulang saat enroll: status `RE_REGISTRATION_VERIFIED`, keputusan ACCEPTED, daftar ulang COMPLETED, tidak ada tagihan terbuka (tagihan dibatalkan = dibebaskan), tidak ada berkas PENDING/INVALID/REVISION_REQUIRED. Data inti disalin sebagai snapshot; status aplikasi → `ENROLLED` lewat state machine; audit `enrollment.created`. Koreksi NIS/NISN wajib alasan dan tercatat (`student.updated`). Test: `EnrollmentTest`, `enrollment.test.tsx`.
- [x] Orang tua melihat NIS di portal (`StudentCard`); petugas MPLS boleh membaca daftar siswa (untuk F15) tanpa aksi enrollment.
- [x] Ekspor CSV (UTF-8 + BOM, aman dari formula injection) dengan filter tahun ajaran/periode/pencarian: `GET /enrollment/students/export`. XLSX tidak dibuat (butuh dependensi baru; CSV terbuka di Excel).
- [ ] Penempatan kelas: **ditunda** (keputusan 2026-10-14) — ERD tidak punya kolom kelas; kelas diatur di sistem sekolah/Dapodik dari ekspor.
- [ ] Pembatalan enrollment (status `CANCELLED` ada di ERD) belum ada aksinya; state machine tidak mengizinkan mundur dari `ENROLLED`.

## F15 — MPLS
- [x] Skema ERD 15 (migrasi 000206; tambahan `mpls_events.academic_year_id` dan `mpls_participants.completed_at`, dicatat di ERD). Halaman `/mpls` (izin `mpls.manage` / `application.override`): kelompok (kode unik per tahun ajaran, kapasitas, pendamping), kegiatan (untuk semua atau satu kelompok), penempatan manual/pindah kelompok dan **bagi otomatis merata** (PRD 10.15) dengan batas kapasitas.
- [x] Hanya siswa ACTIVE dengan aplikasi `ENROLLED` dan tahun ajaran yang sama yang bisa jadi peserta; penempatan → `MPLS_ACTIVE`. Penyelesaian oleh petugas → `MPLS_COMPLETED` → `COMPLETED` (PRD tidak menetapkan syarat kehadiran minimum, jadi tidak dipaksakan).
- [x] Presensi unik per (kegiatan, peserta): manual 4 status (koreksi diaudit beserta status lama) atau scan QR. QR hanya berisi token acak 40 karakter (tanpa data pribadi), unik, bisa dirotasi; scan ganda idempoten; token tidak pernah muncul di daftar staf. Scanner genggam cukup mengetik token ke kolom input (tanpa kamera).
- [x] Portal orang tua (`MplsCard`): kelompok, pendamping, QR presensi, jadwal + status kehadiran sendiri. Ekspor CSV peserta + rekap kehadiran; funnel dashboard menampilkan peserta MPLS dan selesai. Test: `MplsTest` (8), `mpls.test.tsx` (5). Dependensi baru: `qrcode-generator` 2.0.4 (MIT, tanpa dependensi).
- [ ] Belum: status `WITHDRAWN` (mengundurkan diri) tanpa aksi, materi/pengumuman MPLS (PRD 10.14), scan via kamera ponsel, email "informasi MPLS" (F16).

## F17 — Dashboard & laporan
- [x] Dashboard staf `/ringkasan` (`GET /reports/summary`, izin `application.read`/`application.override`): total dan per status, funnel PRD §11 (registrasi → submit → verifikasi → dinilai → diterima → daftar ulang → enrolled), antrean kerja (verifikasi, revisi, keputusan, daftar ulang, enrollment), kuota vs diterima/enrolled per gelombang, 10 asal sekolah dan kota terbanyak; blok keuangan hanya untuk pemegang izin pembayaran. Filter tahun ajaran/gelombang.
- [x] Ekspor CSV: pendaftar (tanpa NIK/kontak), hasil seleksi (izin approve/publish/override), pembayaran (izin keuangan), siswa (F14). Test: `ReportTest`, `reports.test.tsx`.
- [x] Semua laporan (pendaftar, hasil seleksi, pembayaran, siswa, peserta MPLS) bisa diunduh sebagai CSV, XLSX, atau PDF lewat `?format=` (`App\Support\TableExport`; keputusan 2026-10-14: openspout untuk XLSX, dompdf untuk PDF). XLSX hanya memakai sel teks (tidak ada formula), kolom angka ditandai eksplisit; PDF A4 landscape, remote/PHP dimatikan, maksimal `SPMB_EXPORT_PDF_MAX_ROWS` (default 1000) baris; lebih dari itu ditolak dengan saran pakai XLSX. Test: `ExportFormatTest`.
- [ ] Laporan dokumen belum lengkap dan waiting list (PRD §14) belum ada sebagai ekspor tersendiri.

---

# P2 — Kualitas, deploy, dan go-live

## F19 — Frontend
- [ ] State loading, kosong, dan error konsisten di semua halaman.
- [ ] Validasi form terpusat (React Hook Form + Zod sesuai PRD) menggantikan validasi ad hoc.
- [ ] Responsif HP (mayoritas orang tua mengakses dari ponsel) dan aksesibilitas dasar (label, fokus, kontras).
- [ ] Beranda publik: alur pendaftaran, jadwal, persyaratan, kontak sekolah.
- [ ] Halaman akun: ubah profil dan kata sandi.
- [ ] UI untuk F13–F17 (pembayaran, MPLS, dashboard) saat backend-nya siap.

## F20 — Testing & QA
- [ ] E2E Playwright alur utama: daftar → berkas → verifikasi → seleksi → pengumuman → daftar ulang (→ bayar).
- [-] Test unit `ApplicationStateMachine` sudah ada; tinggal aturan ranking (seri, bobot, daftar tunggu, promosi).
- [ ] Test otorisasi per peran untuk setiap endpoint (tidak ada kebocoran lintas pendaftar).
- [ ] Uji beban ringan masa puncak: unggah berkas dan cek hasil serentak.
- [ ] Target cakupan logika bisnis ≥ 80%.

## F21 — Deploy & operasi
- [ ] `Dockerfile` (php-fpm + nginx, build aset Vite) dan `docker-compose.prod.yml` dengan reverse proxy + HTTPS.
- [ ] Konfigurasi production: `APP_ENV=production`, `APP_DEBUG=false`, MySQL terkelola, cache config/route, `npm run build`.
- [ ] Worker queue dan scheduler (`schedule:run`) sebagai service; healthcheck `/ready`.
- [ ] Penyimpanan berkas: S3-compatible atau volume persisten; backup DB terjadwal dan uji restore.
- [ ] Log terpusat dan alert error (Sentry atau setara).
- [ ] Pipeline CD: build → test → staging otomatis, production dengan persetujuan manual.

## F22 — Siap produksi
- [ ] Staging dengan data tiruan; UAT bersama panitia (orang tua, verifikator, penilai, kepala sekolah).
- [ ] Panduan pengguna per peran dan runbook operasi (restore, reset sandi, buka/tutup periode).
- [ ] Gladi hari-H: simulasi pembukaan pendaftaran dan pengumuman hasil.
- [ ] Rencana rollback dan kontak on-call selama periode pendaftaran.
- [ ] Sign-off pemilik produk atas checklist ini.

---

# Keputusan terbuka (butuh pemilik produk)

- Pembayaran: gateway atau transfer manual dengan verifikasi staf?
- Kanal notifikasi: email saja, atau WhatsApp juga?
- Hosting target (VPS, PaaS, cloud) dan siapa yang mengoperasikan.
- Tanggal pembukaan periode pendaftaran (menentukan tenggat P0/P1).

# Urutan kerja yang disarankan

1. F0 (rapikan fondasi) → F18 (keamanan) → F16 (email), karena menyentuh semua fitur berikutnya.
2. F13 manual → F14 → F17 (dashboard) → F15; gateway pembayaran belakangan bila perlu.
3. F19 dikerjakan berdampingan tiap fitur; F20–F22 mulai dari staging begitu P1 stabil.
