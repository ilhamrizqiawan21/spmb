# Frontend

Belum diinisialisasi — framework frontend belum diputuskan. Backend adalah API
JSON murni (`/api/v1`, bearer token Sanctum), sehingga frontend bebas dipilih
dan dapat diganti tanpa menyentuh backend.

## Rekomendasi

**React + TypeScript + Vite (SPA)** — tetap sesuai PRD/AGENTS (TanStack Query,
React Hook Form + Zod, Tailwind CSS, shadcn/ui). Alasannya:

- backend sudah dipisah sebagai API, jadi SPA cocok dan tidak membawa
  ketergantungan ke templating server;
- portal orang tua (formulir panjang bertahap, unggah dokumen, status) dan
  panel staf (antrean verifikasi, penilaian, ranking) sangat interaktif;
- ekosistem komponen/form/tabel paling besar, dan tipe TypeScript dapat
  dibuat dari kontrak API.

## Alternatif jika tim lebih nyaman dengan ekosistem Laravel

| Opsi | Cocok jika | Catatan |
| --- | --- | --- |
| **Inertia + Vue 3 (atau React)** | ingin satu repo/deploy dan routing dari Laravel | mengubah backend: tambah controller Inertia & auth session; endpoint `/api/v1` tetap bisa dipakai |
| **Blade + Livewire** | tim kecil, mayoritas PHP, minim JS | UI interaktif berat (tabel, wizard) lebih terbatas |
| **Nuxt (Vue)** | tim lebih suka Vue, butuh SSR/SEO untuk halaman publik | tetap konsumsi API yang sama |

## Kontrak API yang perlu diketahui frontend

- Basis URL: `http://localhost:8000/api/v1`
- Login: `POST /auth/login` `{identifier, password}` → `{token, token_type, user}`;
  kirim `Authorization: Bearer <token>`; `GET /auth/me` untuk profil + permission.
- Error: `{"error": {"code", "message", "details"}}` (400 validasi, 401, 403, 404, 429).
- Waktu: ISO-8601 UTC (`...Z`); tanggal murni `YYYY-MM-DD`.
- Decimal (skor, bobot, penghasilan) dikirim sebagai **string**.
- CORS: atur `CORS_ALLOWED_ORIGINS` di `backend/.env`.
