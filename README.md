# SPMB Terpadu 2026/2027

Sistem penerimaan murid baru end-to-end untuk mengelola proses mulai dari informasi pendaftaran, akun orang tua/wali, pendaftaran calon siswa, verifikasi, seleksi, pengumuman, daftar ulang, pembayaran, enrollment, hingga MPLS.

## Arsitektur

Versi pertama menggunakan modular monolith:

- Backend: PHP 8.3 + Laravel 13 (JSON API, autentikasi token via Laravel Sanctum)
- Database: MySQL 8.0.16+ dengan Eloquent dan Laravel Migrations
- Cache/queue: driver database Laravel (Redis opsional)
- Dokumen: disk privat Laravel (lokal) atau object storage kompatibel S3
- Frontend: React + TypeScript + Vite (SPA) yang mengonsumsi REST API — lihat [`frontend/README.md`](frontend/README.md)
- Deployment: Docker Compose dengan reverse proxy

> **Catatan migrasi:** backend awalnya dibangun dengan FastAPI (commit
> `b984024`), kemudian Django + PostgreSQL (commit `e781905`), dan kini
> ditulis ulang di atas **Laravel + MySQL**. Implementasi sebelumnya tersimpan
> di riwayat git sebagai referensi perilaku. Lihat `docs/INFRASTRUCTURE.md`.

Struktur utama:

```text
backend/   Backend Laravel (app/Services, app/Http, database/migrations, tests)
frontend/  Frontend React + TypeScript + Vite
docs/      PRD, ERD, aturan agen, dan roadmap eksekusi
```

## Prasyarat

- PHP 8.3+ (ekstensi: mbstring, intl, pdo_mysql, pdo_sqlite untuk test) dan Composer 2
- MySQL 8.0.16+ (atau lewat Docker Compose)
- Node.js 20+ (frontend)
- Docker dan Docker Compose (opsional)

## Setup Lokal

```bash
docker compose up -d mysql        # MySQL 8.4 di 127.0.0.1:3306 (opsional jika MySQL sudah ada)

cd backend
cp .env.example .env              # sesuaikan DB_* bila perlu
composer install
php artisan key:generate
php artisan migrate               # skema + seed role/permission baseline
php artisan serve                 # http://localhost:8000
```

API tersedia di `http://localhost:8000/api/v1/...`, health check di `/health` dan `/ready`.
Alur autentikasi: `POST /api/v1/auth/register` → `POST /api/v1/auth/login`
(mengembalikan `token`) → kirim header `Authorization: Bearer <token>`.

Frontend (terminal lain): `cd frontend && npm install && npm run dev` → http://localhost:5173

Jangan masukkan `.env` atau kredensial nyata ke repository.

## Perintah Pengembangan

```bash
# Backend (dari direktori backend/)
php artisan test                      # PHPUnit, SQLite in-memory
DB_CONNECTION=mysql php artisan test  # jalankan suite terhadap MySQL
vendor/bin/pint --test                # cek code style (hapus --test untuk memperbaiki)
php artisan migrate:fresh             # reset skema lokal

# Frontend (dari direktori frontend/)
npm run typecheck && npm run lint && npm test && npm run build
```

## Status Fitur

Sudah ada (portasi lengkap dari versi Django): auth/RBAC, tahun ajaran & periode,
applicant/guardian, aplikasi pendaftaran + state machine, dokumen privat,
verifikasi, seleksi/penilaian/ranking, keputusan & daftar tunggu, pengumuman,
daftar ulang. Belum: pembayaran, enrollment/siswa, MPLS, notifikasi, dashboard,
audit log. Frontend baru fondasi (login, periode, pendaftaran orang tua, antrean verifikasi). Lihat `docs/TODO.md`.

## Dokumen Sumber Kebenaran

- [PRD](docs/PRD_SPMB_Terpadu_2026_2027.md)
- [ERD](docs/ERD_SPMB_Terpadu_2026_2027.md)
- [Aturan AI](docs/AI_RULES.md)
- [Instruksi agen](docs/AGENTS.md)
- [Roadmap TODO](docs/TODO.md)

Implementasi harus mengikuti urutan milestone dan aturan workflow pada dokumen tersebut.
