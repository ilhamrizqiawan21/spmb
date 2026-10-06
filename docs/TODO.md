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

## Status saat ini (2026-10-06)

| Area | Status |
| --- | --- |
| Auth, RBAC, token Sanctum | Selesai (F1–F3) |
| Tahun ajaran, periode, ketersediaan | Selesai (F4) |
| Calon siswa, wali, pendaftaran + state machine | Selesai (F5–F6) |
| Berkas privat, verifikasi | Selesai (F7–F8) |
| Penilaian, ranking, keputusan, daftar tunggu | Selesai (F9–F10) |
| Pengumuman + surat PDF, daftar ulang | Selesai (F11–F12) |
| Frontend: semua alur di atas + data master admin | Ada, belum dipoles (F19) |
| Pembayaran, enrollment/siswa, MPLS | Belum (F13–F15) |
| Notifikasi, dashboard/laporan | Belum (F16–F17) |
| Audit log, hardening privasi | Belum (F18) |
| Paket deploy, E2E, go-live | Belum (F20–F22) |

Test: 47 backend (PHPUnit), 20 frontend (Vitest); CI backend (SQLite + MySQL) dan frontend.

---

# P0 — Fondasi dan keamanan (kerjakan lebih dulu)

## F0 — Repo & tooling
- [ ] Merge branch `merge-backend-frontend` ke `main` (layout satu project).
- [ ] `phpunit.xml`: buat `tests/Unit` atau hapus suite Unit, agar `php artisan test` jalan tanpa argumen.
- [ ] `.devcontainer/setup.sh`: `DB_DATABASE=spmb` membuat SQLite menulis ke file `spmb`; arahkan ke `database/database.sqlite`.
- [ ] Script composer `dev` memanggil `artisan dev` yang tidak ada: ganti dengan serve + `npm run dev` bersamaan, atau hapus.
- [ ] Verifikasi CI hijau di GitHub (backend SQLite, backend MySQL, frontend) pada layout baru.
- [ ] Dokumentasikan variabel env wajib untuk production (tanpa nilai rahasia).

## F18 — Audit, privasi, keamanan
- [ ] Audit log append-only: siapa mengubah apa dan kapan untuk keputusan seleksi, nilai, status berkas, status pendaftaran, dan akses dokumen privat.
- [ ] Rate limit seluruh endpoint auth dan unggah (throttle baru ada di sebagian rute); penundaan setelah gagal login berulang.
- [ ] Reset kata sandi lewat email; revoke token saat logout dan ganti sandi; tinjau masa berlaku token.
- [ ] Masking data sensitif (NIK, HP, penghasilan) di respons yang tidak membutuhkannya.
- [ ] Review akses dokumen privat: hanya pemilik dan staf berizin; URL bertanda tangan bila memakai S3.
- [ ] Pastikan `DemoSeeder` tidak pernah jalan di production dan tidak ada kredensial default di luar demo.
- [ ] Kebijakan retensi dan penghapusan data/berkas pendaftar; catat di dokumen.
- [ ] Header keamanan (CSP, HSTS, X-Frame-Options) dan CORS dikunci ke origin yang dipakai.

## F16 — Notifikasi (minimum)
- [ ] Email transaksional: reset sandi, status pendaftaran berubah, berkas perlu revisi, hasil seleksi, jadwal asesmen, tenggat daftar ulang.
- [ ] Kirim lewat queue (driver `database`, tabel `jobs` sudah ada) dengan worker; bisnis hanya memicu *notification intent*, bukan memanggil provider langsung.
- [ ] Template Bahasa Indonesia dan log pengiriman.
- [ ] (Opsional) WhatsApp/SMS setelah email stabil.

---

# P1 — Melengkapi siklus penerimaan

## F13 — Keuangan & pembayaran
- [ ] Skema biaya per periode (biaya pendaftaran, uang pangkal) dan tagihan per pendaftar: migrasi, model, permission `finance.*`.
- [ ] Alur manual: orang tua unggah bukti bayar → staf keuangan verifikasi/tolak; status dihitung di server, riwayat dan audit tiap perubahan.
- [ ] Integrasi payment gateway (Midtrans/Xendit) hanya bila diputuskan; webhook idempoten dan rekonsiliasi.
- [ ] Daftar ulang baru bisa selesai setelah syarat pembayaran terpenuhi (sesuai PRD).
- [ ] UI orang tua (tagihan, status, bukti) dan UI staf keuangan; test backend + frontend.

## F14 — Enrollment & siswa
- [ ] Buat record siswa (NIS, kelas) dari pendaftar ACCEPTED yang selesai daftar ulang dan lunas/dibebaskan.
- [ ] Penempatan kelas dan tahun ajaran aktif; riwayat pendaftaran asli tidak diubah.
- [ ] Ekspor data siswa (CSV/XLSX) untuk sistem sekolah/Dapodik.

## F15 — MPLS
- [ ] Jadwal, kelompok, peserta (hanya siswa enrolled), dan kehadiran QR (token unik, tanpa data pribadi, bisa dirotasi).
- [ ] Informasi MPLS untuk orang tua di portal.

## F17 — Dashboard & laporan
- [ ] Dashboard staf: pendaftar per status, kuota vs terisi, antrean verifikasi, progres seleksi dan daftar ulang.
- [ ] Laporan ekspor CSV/XLSX: pendaftar, hasil seleksi, keuangan, siswa; filter per tahun ajaran/periode.

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
- [ ] Test unit `ApplicationStateMachine` dan aturan ranking (seri, bobot, daftar tunggu, promosi).
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
