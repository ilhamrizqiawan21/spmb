import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Field } from '../components/Field'
import { ApiError, api } from '../lib/api'
import type { AdmissionPeriod, AnnouncementResult, Availability } from '../types/api'

export function HomePage() {
  return (
    <section className="card">
      <h1>Penerimaan Murid Baru 2026/2027</h1>
      <p>Daftarkan calon siswa, unggah berkas, pantau verifikasi, dan lihat hasil seleksi secara daring.</p>
    </section>
  )
}

const fmt = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

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

export function AnnouncementLookupPage() {
  const [result, setResult] = useState<AnnouncementResult | null>(null)
  const lookup = useMutation({
    mutationFn: (body: { registration_number: string; birth_date: string }) =>
      api<AnnouncementResult>('/selection/announcements/lookup', { method: 'POST', body, auth: false }),
    onSuccess: setResult,
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setResult(null)
    lookup.mutate({ registration_number: String(f.get('registration_number')), birth_date: String(f.get('birth_date')) })
  }

  return (
    <section className="card narrow">
      <h1>Cek Hasil Seleksi</h1>
      <form onSubmit={onSubmit}>
        <Field label="Nomor pendaftaran" name="registration_number" required placeholder="REG-2026-000001" />
        <Field label="Tanggal lahir" name="birth_date" type="date" required />
        <button disabled={lookup.isPending}>Cek hasil</button>
      </form>
      {lookup.error && <p className="error" role="alert">{lookup.error instanceof ApiError ? lookup.error.message : 'Terjadi kesalahan.'}</p>}
      {result && (result.is_published ? (
        <div className="result">
          <p><strong>{result.applicant_name_masked}</strong> — {result.admission_period_name}</p>
          <p className={`decision decision-${result.decision?.toLowerCase()}`}>{result.decision}</p>
          <ul>{result.next_steps?.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      ) : <p>{result.message}</p>)}
    </section>
  )
}
