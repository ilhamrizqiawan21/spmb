import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Fragment } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Field } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { useAuth } from '../features/auth/AuthContext'
import { api } from '../lib/api'
import { isoDate, requiredText } from '../lib/validation'
import type { AdmissionPeriod, AnnouncementResult, Availability, DocumentRequirement, SchoolInfo } from '../types/api'

const STEPS = [
  ['Buat akun', 'Daftar sebagai orang tua/wali memakai email atau nomor HP.'],
  ['Isi data calon siswa', 'Lengkapi biodata calon siswa dan data orang tua/wali.'],
  ['Unggah berkas', 'Unggah berkas persyaratan (PDF/JPG/PNG), lalu kirim pendaftaran.'],
  ['Verifikasi', 'Panitia memeriksa berkas. Bila ada yang perlu diperbaiki, Anda mendapat pemberitahuan.'],
  ['Asesmen', 'Ikuti jadwal tes/wawancara yang tampil di halaman pendaftaran.'],
  ['Pengumuman', 'Lihat hasil seleksi di portal atau lewat menu Cek Hasil.'],
  ['Daftar ulang & pembayaran', 'Calon siswa yang diterima melengkapi daftar ulang dan pembayaran.'],
  ['Menjadi siswa & MPLS', 'Sekolah menetapkan NIS dan kelompok MPLS; kode QR presensi tersedia di portal.'],
] as const

const MIME_LABELS: Record<string, string> = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' }
const fileTypes = (types: string[]) => types.map((t) => MIME_LABELS[t] ?? t).join(', ')
const megabytes = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`

function Requirements({ period }: { period: AdmissionPeriod }) {
  const reqs = useQuery({
    queryKey: ['public-requirements', period.id],
    queryFn: () => api<DocumentRequirement[]>(`/admission/document-requirements?admission_period_id=${period.id}`, { auth: false }),
  })
  if (reqs.isPending) return <p role="status">Memuat persyaratan…</p>
  if (reqs.error) return <p className="error">Gagal memuat persyaratan.</p>
  if (reqs.data.length === 0) return <p>Persyaratan berkas belum diumumkan.</p>
  return (
    <ul>
      {reqs.data.map((r) => (
        <li key={r.id}>
          {r.name}{!r.is_required && ' (opsional)'} — <small>{fileTypes(r.allowed_mime_types)}, maks. {megabytes(r.max_file_size_bytes)}</small>
        </li>
      ))}
    </ul>
  )
}

function Contact() {
  const school = useQuery({ queryKey: ['public-school'], queryFn: () => api<SchoolInfo>('/public/school', { auth: false }) })
  const s = school.data
  const rows = s ? ([
    ['Alamat', s.address], ['Telepon', s.phone], ['WhatsApp', s.whatsapp], ['Email', s.email], ['Situs web', s.website], ['Jam layanan', s.office_hours],
  ] as const).filter(([, v]) => v) : []
  return (
    <section className="card" aria-labelledby="contact-title">
      <h2 id="contact-title">Kontak Panitia{s?.name ? ` — ${s.name}` : ''}</h2>
      {school.isPending && <p role="status">Memuat…</p>}
      {rows.length > 0 ? (
        <dl className="details">{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
      ) : !school.isPending && <p>Hubungi panitia SPMB di sekolah untuk informasi lebih lanjut.</p>}
    </section>
  )
}

export function HomePage() {
  const { user } = useAuth()
  const periods = useQuery({
    queryKey: ['periods'],
    queryFn: () => api<AdmissionPeriod[]>('/admission/periods?is_active=true', { auth: false }),
  })

  return (
    <>
      <section className="card hero">
        <h1>Penerimaan Murid Baru 2026/2027</h1>
        <p>Daftarkan calon siswa, unggah berkas, pantau verifikasi, dan lihat hasil seleksi secara daring.</p>
        <p className="row">
          {user ? <Link className="button" to="/dashboard">Buka pendaftaran saya</Link> : (
            <>
              <Link className="button" to="/register">Daftar sekarang</Link>
              <Link className="button secondary" to="/login">Masuk</Link>
            </>
          )}
          <Link className="button secondary" to="/hasil">Cek hasil seleksi</Link>
        </p>
      </section>

      <section className="card" aria-labelledby="steps-title">
        <h2 id="steps-title">Alur Pendaftaran</h2>
        <ol className="steps">
          {STEPS.map(([title, text]) => <li key={title}><strong>{title}</strong><br /><span>{text}</span></li>)}
        </ol>
      </section>

      <section className="card" aria-labelledby="schedule-title">
        <h2 id="schedule-title">Jadwal & Persyaratan</h2>
        {periods.isPending && <p role="status">Memuat…</p>}
        {periods.error && <p className="error">Gagal memuat jadwal. Coba muat ulang halaman.</p>}
        {periods.data?.length === 0 && <p>Belum ada gelombang pendaftaran yang dibuka.</p>}
        {periods.data?.map((p) => (
          <article key={p.id} className="period">
            <h3>{p.name}</h3>
            <dl className="details">
              <dt>Pendaftaran</dt><dd>{fmt(p.registration_start)} – {fmt(p.registration_end)}</dd>
              {p.announcement_at && <><dt>Pengumuman</dt><dd>{fmt(p.announcement_at)}</dd></>}
              {p.quota !== null && <><dt>Kuota</dt><dd>{p.quota} siswa</dd></>}
            </dl>
            <h4>Berkas yang perlu disiapkan</h4>
            <Requirements period={p} />
          </article>
        ))}
      </section>

      <Contact />
    </>
  )
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function PeriodRow({ period }: { period: AdmissionPeriod }) {
  const { data } = useQuery({
    queryKey: ['availability', period.id],
    queryFn: () => api<Availability>(`/admission/periods/${period.id}/availability`, { auth: false }),
  })
  return (
    <tr>
      <td>{period.name}</td>
      <td>{fmt(period.registration_start)} – {fmt(period.registration_end)}</td>
      <td>{data ? (data.is_open ? 'Dibuka' : (data.reason ?? data.status)) : '…'}</td>
    </tr>
  )
}

export function PeriodsPage() {
  const { data, isPending, error } = useQuery({
    queryKey: ['periods'],
    queryFn: () => api<AdmissionPeriod[]>('/admission/periods?is_active=true', { auth: false }),
  })
  if (isPending) return <p>Memuat…</p>
  if (error) return <p className="error">Gagal memuat periode.</p>
  return (
    <section className="card">
      <h1>Periode Pendaftaran</h1>
      <table>
        <thead><tr><th>Gelombang</th><th>Jadwal</th><th>Status</th></tr></thead>
        <tbody>{data.map((p) => <PeriodRow key={p.id} period={p} />)}</tbody>
      </table>
      {data.length === 0 && <p>Belum ada periode aktif.</p>}
    </section>
  )
}

const lookupSchema = z.object({ registration_number: requiredText(50), birth_date: isoDate })

export function AnnouncementLookupPage() {
  const lookup = useMutation({
    mutationFn: (body: z.infer<typeof lookupSchema>) =>
      api<AnnouncementResult>('/selection/announcements/lookup', { method: 'POST', body, auth: false }),
  })
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(lookupSchema), defaultValues: { registration_number: '', birth_date: '' } })
  const result = lookup.data

  return (
    <section className="card narrow">
      <h1>Cek Hasil Seleksi</h1>
      <form onSubmit={handleSubmit((v) => lookup.mutate({ ...v, registration_number: v.registration_number.toUpperCase() }))} noValidate>
        <Field label="Nomor pendaftaran" required placeholder="REG-2026-000001" autoCapitalize="characters" {...register('registration_number')}
          error={formState.errors.registration_number?.message} />
        <Field label="Tanggal lahir" type="date" required {...register('birth_date')} error={formState.errors.birth_date?.message} />
        <button disabled={lookup.isPending}>{lookup.isPending ? 'Memeriksa…' : 'Cek hasil'}</button>
      </form>
      <ErrorNote error={lookup.error} />
      {result && (result.is_published ? (
        <div className="result" role="status">
          <p><strong>{result.applicant_name_masked}</strong> — {result.admission_period_name}</p>
          <p className={`decision decision-${result.decision?.toLowerCase()}`}>{result.decision}</p>
          <ul>{result.next_steps?.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      ) : <p role="status">{result.message}</p>)}
    </section>
  )
}
