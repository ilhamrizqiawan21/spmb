# SPMB Terpadu 2026/2027

Sistem penerimaan murid baru end-to-end untuk mengelola proses mulai dari informasi pendaftaran, akun orang tua/wali, pendaftaran calon siswa, verifikasi, seleksi, pengumuman, daftar ulang, pembayaran, enrollment, hingga MPLS.

## Arsitektur

Versi pertama menggunakan modular monolith:

- Frontend: React + TypeScript + Vite
- Backend: Python + Django + Django REST Framework
- Database: PostgreSQL dengan Django ORM dan Django Migrations
- Cache/queue: Redis (Django cache framework + Celery)
- Dokumen: object storage yang kompatibel dengan S3
- Deployment: Docker Compose dengan reverse proxy

> **Catatan migrasi:** versi awal backend dibangun dengan FastAPI +
> SQLAlchemy + Alembic. Proyek ini sedang bermigrasi ke Django + DRF.
> Implementasi FastAPI sebelumnya (F0-F5, teruji) tersimpan di riwayat git
> pada commit `b984024` sebagai referensi. Lihat `docs/AGENTS.md` §1 dan
> `docs/TODO.md` untuk detail.

Struktur utama:

```text
backend/   Backend Django (DRF) dan modul domain per app
frontend/  Frontend React berbasis feature
docs/      PRD, ERD, aturan agen, dan roadmap eksekusi
```

## Prasyarat

- Python 3.11+
- Node.js 20+
- Docker dan Docker Compose
- PostgreSQL 15+
- Redis 7+

Versi final yang digunakan proyek akan dikunci oleh konfigurasi backend/frontend masing-masing.

## Setup Lokal

1. Salin `.env.example` menjadi `.env` dan sesuaikan nilainya untuk mesin lokal.
2. Jalankan stack pengembangan dengan Docker Compose setelah konfigurasi Compose tersedia.
3. Siapkan backend dan frontend mengikuti README pada direktori masing-masing setelah bootstrap selesai.

Jangan masukkan `.env` atau kredensial nyata ke repository.

## Perintah Pengembangan

Perintah konkret akan mengikuti package manager dan script yang didefinisikan saat backend/frontend diinisialisasi. Target perintahnya:

```bash
# Backend
pytest
ruff check .
mypy .

# Frontend
npm run lint
npm run typecheck
npm run test
npm run build
```

## Dokumen Sumber Kebenaran

- [PRD](docs/PRD_SPMB_Terpadu_2026_2027.md)
- [ERD](docs/ERD_SPMB_Terpadu_2026_2027.md)
- [Aturan AI](docs/AI_RULES.md)
- [Instruksi agen](docs/AGENTS.md)
- [Roadmap TODO](docs/TODO.md)

Implementasi harus mengikuti urutan milestone dan aturan workflow pada dokumen tersebut.
