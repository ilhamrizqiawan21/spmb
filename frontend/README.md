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

- Klien API bertipe (`src/lib/api.ts`) dengan penanganan envelope error dan token
  bearer (disimpan di `localStorage`).
- Autentikasi: masuk, daftar, rute terproteksi, pengecekan permission untuk staf.
- Publik: daftar periode + status ketersediaan, cek hasil seleksi (no. pendaftaran + tanggal lahir).
- Portal orang tua: calon siswa, mulai pendaftaran, wali, unggah berkas per
  persyaratan, kirim pendaftaran, riwayat status.
- Staf: antrean verifikasi (baca-saja).
- TanStack Query untuk data server, React Router untuk routing, Vitest + Testing Library.

## Belum ada / berikutnya

Aksi verifikasi (setujui/revisi berkas), penilaian, ranking, keputusan, daftar ulang,
pembayaran, MPLS, pengelolaan data master oleh admin, dan unduh surat hasil (PDF).
Direncanakan menyusul sesuai `docs/TODO.md` (F19). React Hook Form + Zod, Tailwind,
dan shadcn/ui dari PRD belum dipasang; gaya saat ini CSS biasa agar ringan.

## Kontrak API yang perlu diketahui frontend

- Basis URL: `http://localhost:8000/api/v1`
- Login: `POST /auth/login` `{identifier, password}` → `{token, token_type, user}`;
  kirim `Authorization: Bearer <token>`; `GET /auth/me` untuk profil + permission.
- Error: `{"error": {"code", "message", "details"}}` (400 validasi, 401, 403, 404, 429).
- Waktu: ISO-8601 UTC (`...Z`); tanggal murni `YYYY-MM-DD`.
- Decimal (skor, bobot, penghasilan) dikirim sebagai **string**.
- CORS: atur `CORS_ALLOWED_ORIGINS` di `backend/.env`.
