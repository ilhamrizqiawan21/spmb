import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Field, StatusBadge } from '../components/Field'
import { FormError } from '../components/Notice'
import { ApiError, api } from '../lib/api'
import { applyServerErrors, emptyToNull, isoDate, optionalDigits, optionalText, requiredText } from '../lib/validation'
import type { AdmissionPeriod, Applicant, Application } from '../types/api'

const applicantSchema = z.object({
  full_name: requiredText(200),
  gender: z.enum(['MALE', 'FEMALE'], { message: 'Pilih jenis kelamin.' }),
  birth_place: requiredText(150),
  birth_date: isoDate,
  religion: optionalText(50),
  nisn: optionalDigits(10, 'NISN'),
  nik: optionalDigits(16, 'NIK'),
  address: z.string().trim().min(1, 'Wajib diisi.'),
  city: optionalText(100),
  previous_school_name: optionalText(200),
})
type ApplicantInput = z.input<typeof applicantSchema>
const APPLICANT_FIELDS = Object.keys(applicantSchema.shape)

function NewApplicantForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<ApplicantInput>({
    resolver: zodResolver(applicantSchema),
    defaultValues: { full_name: '', birth_place: '', birth_date: '', religion: '', nisn: '', nik: '', address: '', city: '', previous_school_name: '' },
  })
  const e = formState.errors

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await api<Applicant>('/admission/applicants', { method: 'POST', body: emptyToNull(v) })
      await qc.invalidateQueries({ queryKey: ['applicants'] })
      onDone()
    } catch (err) {
      setError(applyServerErrors(err, setFieldError, APPLICANT_FIELDS))
    }
  })

  return (
    <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="applicant-title">
      <h2 id="applicant-title">Data Calon Siswa</h2>
      <Field label="Nama lengkap" required {...register('full_name')} error={e.full_name?.message} />
      <label className="field required">
        <span>Jenis kelamin</span>
        <select {...register('gender')} defaultValue="" aria-invalid={!!e.gender}>
          <option value="" disabled>Pilih…</option>
          <option value="MALE">Laki-laki</option>
          <option value="FEMALE">Perempuan</option>
        </select>
        {e.gender && <small className="error">{e.gender.message}</small>}
      </label>
      <Field label="Tempat lahir" required {...register('birth_place')} error={e.birth_place?.message} />
      <Field label="Tanggal lahir" type="date" required {...register('birth_date')} error={e.birth_date?.message} />
      <Field label="Agama" {...register('religion')} error={e.religion?.message} />
      <Field label="NISN" inputMode="numeric" maxLength={10} {...register('nisn')} error={e.nisn?.message} hint="10 digit, lihat di nisn.data.kemdikbud.go.id" />
      <Field label="NIK" inputMode="numeric" maxLength={16} {...register('nik')} error={e.nik?.message} hint="16 digit sesuai Kartu Keluarga" />
      <Field label="Alamat" required {...register('address')} error={e.address?.message} />
      <Field label="Kota/Kabupaten" {...register('city')} error={e.city?.message} />
      <Field label="Sekolah asal" {...register('previous_school_name')} error={e.previous_school_name?.message} />
      <FormError message={error} />
      <button disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Menyimpan…' : 'Simpan'}</button>{' '}
      <button type="button" className="secondary" onClick={onDone}>Batal</button>
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
