import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Field, StatusBadge } from '../components/Field'
import { ApiError, api, fieldErrors } from '../lib/api'
import type { AdmissionPeriod, Applicant, Application } from '../types/api'

function NewApplicantForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const create = useMutation({
    mutationFn: (body: Record<string, string>) => api<Applicant>('/admission/applicants', { method: 'POST', body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['applicants'] })
      onDone()
    },
    onError: (e) => setErrors(fieldErrors(e)),
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    const body = Object.fromEntries(
      [...new FormData(e.currentTarget).entries()].filter(([, v]) => String(v) !== '').map(([k, v]) => [k, String(v)]),
    )
    create.mutate(body)
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Data Calon Siswa</h2>
      <Field label="Nama lengkap" name="full_name" required error={errors.full_name} />
      <label className="field">
        <span>Jenis kelamin</span>
        <select name="gender" required defaultValue="">
          <option value="" disabled>Pilih…</option>
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
        </select>
      </label>
      <Field label="Tempat lahir" name="birth_place" required error={errors.birth_place} />
      <Field label="Tanggal lahir" name="birth_date" type="date" required error={errors.birth_date} />
      <Field label="Agama" name="religion" error={errors.religion} />
      <Field label="NISN" name="nisn" error={errors.nisn} />
      <Field label="NIK" name="nik" error={errors.nik} />
      <Field label="Alamat" name="address" required error={errors.address} />
      <button disabled={create.isPending}>Simpan</button>
    </form>
  )
}

function StartApplication({ applicant, periods }: { applicant: Applicant; periods: AdmissionPeriod[] }) {
  const qc = useQueryClient()
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? '')
  const start = useMutation({
    mutationFn: () => api<Application>('/admission/applications', { method: 'POST', body: { applicant_id: applicant.id, admission_period_id: periodId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  })
  return (
    <div className="row">
      <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} aria-label="Periode">
        {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button onClick={() => start.mutate()} disabled={!periodId || start.isPending}>Mulai pendaftaran</button>
      {start.error && <small className="error">{start.error instanceof ApiError ? start.error.message : 'Gagal.'}</small>}
    </div>
  )
}

export function DashboardPage() {
  const [adding, setAdding] = useState(false)
  const applicants = useQuery({ queryKey: ['applicants'], queryFn: () => api<Applicant[]>('/admission/applicants') })
  const applications = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/admission/applications') })
  const periods = useQuery({ queryKey: ['periods'], queryFn: () => api<AdmissionPeriod[]>('/admission/periods?is_active=true', { auth: false }) })

  if (applicants.isPending || applications.isPending) return <p>Memuat…</p>

  return (
    <>
      <section className="card">
        <h1>Pendaftaran Saya</h1>
        {applications.data?.length === 0 && <p>Belum ada pendaftaran.</p>}
        <ul className="list">
          {applications.data?.map((a) => (
            <li key={a.id}>
              <Link to={`/applications/${a.id}`}>{a.applicant_name} — {a.period_name}</Link>
              <StatusBadge status={a.status} />
              <span>{a.registration_number}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Calon Siswa</h2>
        <ul className="list">
          {applicants.data?.map((a) => (
            <li key={a.id}>
              <strong>{a.full_name}</strong>
              {periods.data && periods.data.length > 0 && <StartApplication applicant={a} periods={periods.data} />}
            </li>
          ))}
        </ul>
        {adding ? <NewApplicantForm onDone={() => setAdding(false)} /> : <button onClick={() => setAdding(true)}>Tambah calon siswa</button>}
      </section>
    </>
  )
}
