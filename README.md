# SPMB Terpadu 2026/2027

Sistem penerimaan murid baru end-to-end untuk mengelola proses mulai dari informasi pendaftaran, akun orang tua/wali, pendaftaran calon siswa, verifikasi, seleksi, pengumuman, daftar ulang, pembayaran, enrollment, hingga MPLS.

## Arsitektur

Versi pertama menggunakan modular monolith:

- Backend: PHP 8.3 + Laravel 13 (JSON API, autentikasi token via Laravel Sanctum)
- Database: MySQL 8.0.16+ dengan Eloquent dan Laravel Migrations
- Cache/queue: driver database Laravel (Redis opsional)
- Dokumen: disk privat Laravel (lokal) atau object storage kompatibel S3
- Frontend: React + TypeScript + Vite (SPA) di `resources/js/` yang mengonsumsi REST API — lihat [`docs/FRONTEND.md`](docs/FRONTEND.md)
- Deployment: Docker Compose dengan reverse proxy

> **Catatan migrasi:** backend awalnya dibangun dengan FastAPI (commit
> `b984024`), kemudian Django + PostgreSQL (commit `e781905`), dan kini
> ditulis ulang di atas **Laravel + MySQL**. Implementasi sebelumnya tersimpan
> di riwayat git sebagai referensi perilaku. Lihat `docs/INFRASTRUCTURE.md`.

Satu project Laravel standar; frontend React hidup di dalamnya:

```text
app/ routes/ database/ tests/   Backend Laravel (app/Services, app/Http, migrations)
resources/js/                   Frontend React + TypeScript (dibundel Vite)
resources/views/app.blade.php   Shell SPA
docs/                           PRD, ERD, aturan agen, dan roadmap eksekusi
```

Layout backend: `app/Services` (business rules) → `app/Http/Controllers/Api` (controller tipis)
→ `app/Http/Resources` (kontrak respons); rute di `routes/api.php` (`/api/v1`), probe
infrastruktur dan shell SPA di `routes/web.php` (`/health`, `/ready`, sisanya SPA).

## Prasyarat

- PHP 8.3+ (ekstensi: mbstring, intl, pdo_mysql, pdo_sqlite untuk test) dan Composer 2
- MySQL 8.0.16+ (atau lewat Docker Compose)
- Node.js 20+ (frontend)
- Docker dan Docker Compose (opsional)

## Coba Cepat (tanpa instalasi): GitHub Codespaces

Buka repo di GitHub → **Code** → **Codespaces** → **Create codespace** (bisa dari browser HP).
Setelah setup selesai (± 3–5 menit), buka port **8000** di tab *Ports*. Database memakai
SQLite dan data demo sudah terisi (tanpa MySQL). Akun demo (kata sandi `Rahasia-123`):
`parent@demo.test`, `verifier@demo.test`, `admission_admin@demo.test`, `assessor@demo.test`,
`principal@demo.test`, `super_admin@demo.test`. Atau daftar akun orang tua baru lewat halaman *Daftar*.

## Setup Lokal

```bash
docker compose up -d mysql        # MySQL 8.4 di 127.0.0.1:3306 (opsional jika MySQL sudah ada)

cp .env.example .env              # sesuaikan DB_* bila perlu
composer install
npm install
php artisan key:generate
php artisan migrate               # skema + seed role/permission baseline
php artisan serve                 # http://localhost:8000 (aplikasi + API)
npm run dev                       # terminal lain: Vite dev server (HMR)
```

Data demo: `php artisan db:seed` (hanya di luar production).

API tersedia di `http://localhost:8000/api/v1/...`, health check di `/health` dan `/ready`.
Alur autentikasi: `POST /api/v1/auth/register` → `POST /api/v1/auth/login`
(mengembalikan `token`) → kirim header `Authorization: Bearer <token>`.

Buka aplikasi di http://localhost:8000. Untuk build produksi: `npm run build` (hasil di `public/build/`).

Jangan masukkan `.env` atau kredensial nyata ke repository.

## Perintah Pengembangan

```bash
# Backend
php artisan test                      # PHPUnit, SQLite in-memory
DB_CONNECTION=mysql php artisan test  # jalankan suite terhadap MySQL
vendor/bin/pint --test                # cek code style (hapus --test untuk memperbaiki)
php artisan migrate:fresh             # reset skema lokal

# Frontend
npm run typecheck && npm run lint && npm test && npm run build
```

## Status Fitur

Sudah ada (portasi lengkap dari versi Django): auth/RBAC, tahun ajaran & periode,
applicant/guardian, aplikasi pendaftaran + state machine, dokumen privat,
verifikasi, seleksi/penilaian/ranking, keputusan & daftar tunggu, pengumuman,
daftar ulang. Belum: pembayaran, enrollment/siswa, MPLS, notifikasi, dashboard,
audit log. Frontend sudah mencakup alur di atas (orang tua, verifikator, penilai, kepala sekolah, data master admin) tetapi belum dipoles.
Roadmap menuju siap pakai: `docs/TODO.md`.

## Dokumen Sumber Kebenaran

- [PRD](docs/PRD_SPMB_Terpadu_2026_2027.md)
- [ERD](docs/ERD_SPMB_Terpadu_2026_2027.md)
- [Aturan AI](docs/AI_RULES.md)
- [Instruksi agen](docs/AGENTS.md)
- [Roadmap TODO](docs/TODO.md)

Implementasi harus mengikuti urutan milestone dan aturan workflow pada dokumen tersebut.
