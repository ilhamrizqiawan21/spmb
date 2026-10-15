import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { z } from 'zod'
import { Field, StatusBadge } from '../components/Field'
import { FormError } from '../components/Notice'
import { ApiError, api } from '../lib/api'
import { applyServerErrors, optionalPhone, requiredText } from '../lib/validation'
import { MplsCard } from './mpls/MplsCard'
import { PaymentCard } from './PaymentCard'
import { ReRegistrationCard, ResultCard, ScheduleCard, StudentCard } from './ReRegistrationCard'
import type { Application, ApplicationDocument, DocumentRequirement, Guardian } from '../types/api'

const RELATIONS = { FATHER: 'Ayah', MOTHER: 'Ibu', GUARDIAN: 'Wali' } as const
const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Terjadi kesalahan.')

const guardianSchema = z.object({
  relationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN']),
  full_name: requiredText(200),
  phone: optionalPhone,
  is_primary_contact: z.boolean(),
})
type GuardianInput = z.input<typeof guardianSchema>

function Guardians({ applicantId }: { applicantId: string }) {
  const qc = useQueryClient()
  const key = ['guardians', applicantId]
  const [error, setError] = useState<string | null>(null)
  const list = useQuery({ queryKey: key, queryFn: () => api<Guardian[]>(`/admission/applicants/${applicantId}/guardians`) })
  const { register, handleSubmit, formState, reset, setError: setFieldError } = useForm<GuardianInput>({
    resolver: zodResolver(guardianSchema),
    defaultValues: { relationship: 'FATHER', full_name: '', phone: '', is_primary_contact: false },
  })

  // Only clear the form once the server accepted it, so a rejected entry is not lost.
  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await api(`/admission/applicants/${applicantId}/guardians`, { method: 'POST', body: { ...v, phone: v.phone || null } })
      reset()
      await qc.invalidateQueries({ queryKey: key })
      await qc.invalidateQueries({ queryKey: ['application'] })
    } catch (err) {
      setError(applyServerErrors(err, setFieldError, ['full_name', 'phone']))
    }
  })

  return (
    <section className="card">
      <h2>Orang Tua / Wali</h2>
      {list.isPending && <p role="status">Memuat…</p>}
      {list.data?.length === 0 && <p>Belum ada data orang tua/wali. Minimal satu wajib diisi sebelum mengirim pendaftaran.</p>}
      <ul className="list">
        {list.data?.map((g) => <li key={g.id}>{RELATIONS[g.relationship]}: {g.full_name} {g.phone && `(${g.phone})`}</li>)}
      </ul>
      <form onSubmit={onSubmit} className="row" noValidate aria-label="Tambah orang tua/wali">
        <label className="field">
          <span>Hubungan</span>
          <select {...register('relationship')}>
            {Object.entries(RELATIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <Field label="Nama" required {...register('full_name')} error={formState.errors.full_name?.message} />
        <Field label="No. HP" type="tel" inputMode="tel" {...register('phone')} error={formState.errors.phone?.message} />
        <label className="field"><span>Kontak utama</span><input type="checkbox" {...register('is_primary_contact')} /></label>
        <button className="field" disabled={formState.isSubmitting}>Tambah</button>
      </form>
      <FormError message={error ?? (list.error ? message(list.error) : null)} />
    </section>
  )
}

function Documents({ application, editable }: { application: Application; editable: boolean }) {
  const qc = useQueryClient()
  const reqs = useQuery({
    queryKey: ['requirements', application.admission_period_id],
    queryFn: () => api<DocumentRequirement[]>(`/admission/document-requirements?admission_period_id=${application.admission_period_id}`, { auth: false }),
  })
  const docs = useQuery({ queryKey: ['documents', application.id], queryFn: () => api<ApplicationDocument[]>(`/admission/applications/${application.id}/documents`) })
  const upload = useMutation({
    mutationFn: ({ requirementId, file }: { requirementId: string; file: File }) => {
      const form = new FormData()
      form.set('requirement_id', requirementId)
      form.set('file', file)
      return api(`/admission/applications/${application.id}/documents`, { method: 'POST', form })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['documents', application.id] })
      await qc.invalidateQueries({ queryKey: ['application', application.id] })
    },
  })

  return (
    <section className="card">
      <h2>Berkas</h2>
      {upload.error && <p className="error" role="alert">{message(upload.error)}</p>}
      <table>
        <thead><tr><th>Berkas</th><th>Status</th><th /></tr></thead>
        <tbody>
          {reqs.data?.map((r) => {
            const latest = docs.data?.find((d) => d.requirement_id === r.id)
            return (
              <tr key={r.id}>
                <td>{r.name}{r.is_required && ' *'}</td>
                <td>
                  {latest ? <><StatusBadge status={latest.status} /> v{latest.version} {latest.verification_note && <small>({latest.verification_note})</small>}</> : 'Belum diunggah'}
                </td>
                <td>
                  {editable && (
                    <input
                      type="file"
                      accept={r.allowed_mime_types.join(',')}
                      aria-label={`Unggah ${r.name}`}
                      onChange={(e) => e.target.files?.[0] && upload.mutate({ requirementId: r.id, file: e.target.files[0] })}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

export function ApplicationPage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const app = useQuery({ queryKey: ['application', id], queryFn: () => api<Application>(`/admission/applications/${id}`) })
  const submit = useMutation({
    mutationFn: () => api<Application>(`/admission/applications/${id}/submit`, { method: 'POST' }),
    onSuccess: (data) => qc.setQueryData(['application', id], data),
  })

  if (app.isPending) return <p>Memuat…</p>
  if (app.error) return <p className="error">{message(app.error)}</p>
  const a = app.data
  const editable = a.status === 'DRAFT' || a.status === 'REVISION_REQUIRED'

  return (
    <>
      <section className="card">
        <h1>{a.applicant_name}</h1>
        <p>{a.period_name} · No. {a.registration_number ?? 'DRAF'} · <StatusBadge status={a.status} /></p>
        <p className="hint" style={{ fontSize: '0.85rem', marginTop: -6, marginBottom: 10 }}>
          {a.submitted_at
            ? `Tanggal Diajukan: ${new Date(a.submitted_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })} WIB`
            : a.created_at
            ? `Draf Dibuat: ${new Date(a.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB`
            : null}
        </p>
        <progress value={a.completion_percentage} max={100} aria-label="Kelengkapan" /> {a.completion_percentage}%
        {a.status === 'DRAFT' && (
          <p>
            <button onClick={() => submit.mutate()} disabled={submit.isPending}>Kirim pendaftaran</button>
            {submit.error && <span className="error" role="alert"> {message(submit.error)}</span>}
          </p>
        )}
      </section>
      <ScheduleCard application={a} />
      <ResultCard application={a} />
      <ReRegistrationCard application={a} />
      <PaymentCard application={a} />
      <StudentCard application={a} />
      <MplsCard application={a} />
      <Guardians applicantId={a.applicant_id} />
      <Documents application={a} editable={editable} />
      <section className="card">
        <h2>Riwayat Status</h2>
        <ol>
          {a.status_histories.map((h) => (
            <li key={h.id}>{new Date(h.created_at).toLocaleString('id-ID')} — <StatusBadge status={h.to_status} /> {h.reason}</li>
          ))}
        </ol>
      </section>
    </>
  )
}
