# Data Akun Pengguna Demo (Demo Users) — SPMB Terpadu 2026/2027

Dokumen ini berisi daftar lengkap akun demo yang digenerate oleh `php artisan db:seed` (via `DemoSeeder.php`) untuk keperluan pengujian dan eksplorasi fitur di lingkungan pengembangan lokal (*non-production*).

> **PENTING:**
> - Seluruh akun demo menggunakan kata sandi (*password*) yang sama: **`Rahasia-123`**
> - Akun demo ini dibuat secara otomatis jika menjalankan `php artisan db:seed` dan **tidak boleh digunakan di lingkungan produksi**.

---

## 1. Akun Staf & Administrasi Sekolah (Berdasarkan Role / Peran)

| Role / Jabatan | Alamat Email | Password | Hak Akses & Tanggung Jawab Utama |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `super_admin@demo.test` | `Rahasia-123` | Akses penuh seluruh sistem: Dashboard Super Admin, Pengguna, Jejak Audit, Data Master, Seleksi, Keuangan, MPLS. |
| **Admission Admin** | `admission_admin@demo.test` | `Rahasia-123` | Pengaturan gelombang/periode, persyaratan berkas, manajemen aplikasi, dan monitoring SPMB. |
| **Petugas Verifikasi (Verifier)** | `verifier@demo.test` | `Rahasia-123` | Memeriksa dan memvalidasi kelengkapan berkas fisik/dokumen (KK, Akta Kelahiran, dll) calon siswa di menu **Verifikasi Berkas**. |
| **Petugas Keuangan (Finance)** | `finance@demo.test` | `Rahasia-123` | Memvalidasi dan menyetujui/menolak bukti transfer pembayaran biaya pendaftaran & daftar ulang di menu **Keuangan**. |
| **Penguji / Penilai (Assessor)** | `assessor@demo.test` | `Rahasia-123` | Mengatur jadwal tes dan menginput penilaian komponen seleksi (tes tulis, wawancara, baca Al-Qur'an) di menu **Jadwal Asesmen** & **Penilaian**. |
| **Kepala Sekolah (Principal)** | `principal@demo.test` | `Rahasia-123` | Menyetujui perangkingan seleksi, menetapkan keputusan kelulusan (Diterima / Cadangan / Ditolak), dan menerbitkan pengumuman resmi di menu **Seleksi**. |
| **Panitia MPLS (MPLS Officer)** | `mpls_officer@demo.test` | `Rahasia-123` | Mengelola kelompok/gugus MPLS, penempatan calon siswa baru secara manual/otomatis merata, dan rekapitulasi kelulusan orientasi di menu **MPLS**. |

---

## 2. Akun Orang Tua / Wali Calon Siswa (Skenario Alur Pendaftaran)

Setiap akun wali murid telah dipersiapkan dengan variasi tahapan proses pendaftaran untuk mempermudah verifikasi alur sistem:

| Nama Wali Murid | Email Login | Password | Calon Siswa (Anak) | Status Pendaftaran & Skenario |
| :--- | :--- | :--- | :--- | :--- |
| **Akun Orang Tua Utama** | `parent@demo.test` | `Rahasia-123` | **Kayla Az-Zahra** | `ACCEPTED` (Lolos Seleksi — siap simulasi pembayaran biaya daftar ulang). |
| **Wali Rizky** | `wali.rizky@demo.test` | `Rahasia-123` | **Rizky Pratama** | `MPLS_ACTIVE` (Siswa Resmi terdaftar di Gugus 1 - Garuda). |
| **Wali Aisyah** | `wali.aisyah@demo.test` | `Rahasia-123` | **Aisyah Nur Ramadhani** | `ENROLLED` (Sudah lunas daftar ulang dan memiliki NIS resmi, siap masuk kelompok MPLS). |
| **Wali Fajar** | `wali.fajar@demo.test` | `Rahasia-123` | **Fajar Hidayat** | `ENROLLED` (Sudah lunas daftar ulang dan memiliki NIS resmi, siap masuk kelompok MPLS). |
| **Wali Dimas** | `wali.dimas@demo.test` | `Rahasia-123` | **Dimas Arya Sena** | `RE_REGISTRATION` (Diterima, sedang dalam proses pemenuhan berkas daftar ulang & pelunasan). |
| **Wali Nabila** | `wali.nabila@demo.test` | `Rahasia-123` | **Nabila Syakieb** | `WAITLISTED` (Masuk daftar cadangan / tunggu). |
| **Wali Rafi** | `wali.rafi@demo.test` | `Rahasia-123` | **Rafi Ahmad Fauzi** | `REJECTED` (Tidak lolos seleksi penerimaan). |
| **Wali Sarah** | `wali.sarah@demo.test` | `Rahasia-123` | **Siti Sarah Maulida** | `ASSESSMENT_SCHEDULED` (Jadwal ujian asesmen telah terbit, siap dinilai). |
| **Wali Bintang** | `wali.bintang@demo.test` | `Rahasia-123` | **Bintang Ramadhan** | `SUBMITTED` (Formulir terkirim, siap diverifikasi berkasnya oleh tim verifikator). |
| **Wali Tiara** | `wali.tiara@demo.test` | `Rahasia-123` | **Tiara Andini Putri** | `REVISION_REQUIRED` (Berkas ditolak verifikator dan butuh revisi perbaikan oleh orang tua). |
| **Wali Alif** | `wali.alif@demo.test` | `Rahasia-123` | **Alif Danendra** | `DRAFT` (Formulir pendaftaran masih berupa draf dan belum dikirimkan). |

---

## 3. Cara Menggunakan Akun Demo

1. Pastikan database lokal telah di-seed:
   ```bash
   php artisan migrate:fresh --seed
   ```
2. Jalankan aplikasi web lokal:
   ```bash
   php artisan serve
   ```
   dan pada terminal lain jalankan:
   ```bash
   npm run dev
   ```
3. Buka browser di [http://localhost:8000/masuk](http://localhost:8000/masuk).
4. Masukkan salah satu email di atas beserta password: **`Rahasia-123`**.

