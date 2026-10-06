# Frontend — React + TypeScript + Vite

Keputusan: SPA React + TypeScript + Vite yang mengonsumsi API Laravel (`/api/v1`,
bearer token Sanctum). Backend tidak bergantung pada pilihan ini.

## Menjalankan

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, /api diproksikan ke http://localhost:8000
npm run typecheck && npm run lint && npm test && npm run build
```

Jalankan backend (`php artisan serve` di `backend/`) agar API tersedia. Untuk build
produksi dengan API di origin lain, set `VITE_API_BASE_URL` dan tambahkan origin
frontend ke `CORS_ALLOWED_ORIGINS` di `backend/.env`.

## Yang sudah ada

- Klien API bertipe (`src/lib/api.ts`) dengan penanganan envelope error dan token bearer.
- Autentikasi: masuk, daftar, rute terproteksi, menu dan rute dibatasi per permission.
- Publik: periode + status ketersediaan, cek hasil seleksi.
- Portal orang tua: calon siswa, mulai pendaftaran, wali, unggah berkas, kirim pendaftaran, riwayat status.
- **Verifikator** (`/verifikasi`): antrean, detail pendaftar, lihat berkas privat, setujui / tolak / minta revisi berkas, nyatakan terverifikasi atau minta perbaikan, penugasan verifikator oleh admin/pemegang `application.verify` (pilih dari daftar staf berperan verifier) dengan nama verifikator yang sedang bertugas tampil di detail.
- **Penilai** (`/penilaian`): input nilai per komponen (status otomatis ASSESSED setelah semua komponen terisi) dan **jadwal asesmen** (buat, jadwal ulang, batalkan, tandai tidak hadir). Orang tua melihat jadwalnya di halaman pendaftar.
- **Kepala sekolah / admin** (`/seleksi`): hitung peringkat, keputusan (terima / daftar tunggu / tolak, alasan wajib saat mengubah), promosi daftar tunggu, umumkan hasil.
- **Orang tua, setelah seleksi**: kartu hasil seleksi (keputusan, langkah berikutnya, unduh surat PDF) dan **daftar ulang** (mulai, centang persyaratan, selesaikan; tombol selesai aktif setelah semua persyaratan wajib terpenuhi).
- **Admin** (`/admin`, menu *Data Master*): tambah/ubah/hapus tahun ajaran, periode (waktu mengikuti zona waktu browser), persyaratan berkas, komponen seleksi (validasi total bobot ≤ 100%), dan persyaratan daftar ulang. Form dirender dari definisi kolom (`ResourceManager`), jadi master data baru cukup menambah definisi.
- **Audit** (`/audit`, permission `audit.read`): penampil audit log dengan filter aksi / jenis data / rentang tanggal dan paginasi.
- TanStack Query, React Router, Vitest + Testing Library.

## Belum ada / berikutnya

Pembayaran, MPLS. React Hook Form + Zod, Tailwind, dan shadcn/ui dari PRD belum dipasang (CSS biasa).

## Kontrak API yang perlu diketahui frontend

- Basis URL: `http://localhost:8000/api/v1`
- Login: `POST /auth/login` `{identifier, password}` → `{token, token_type, user}`;
  kirim `Authorization: Bearer <token>`; `GET /auth/me` untuk profil + permission.
- Error: `{"error": {"code", "message", "details"}}` (400 validasi, 401, 403, 404, 429).
- Waktu: ISO-8601 UTC (`...Z`); tanggal murni `YYYY-MM-DD`.
- Decimal (skor, bobot, penghasilan) dikirim sebagai **string**.
- CORS: atur `CORS_ALLOWED_ORIGINS` di `backend/.env`.
