import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Field, StatusBadge } from '../components/Field'
import { ApiError, api, fieldErrors } from '../lib/api'
import { ReRegistrationCard, ResultCard } from './ReRegistrationCard'
import type { Application, ApplicationDocument, DocumentRequirement, Guardian } from '../types/api'

const RELATIONS = { FATHER: 'Ayah', MOTHER: 'Ibu', GUARDIAN: 'Wali' } as const
const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Terjadi kesalahan.')

function Guardians({ applicantId }: { applicantId: string }) {
  const qc = useQueryClient()
  const key = ['guardians', applicantId]
  const [errors, setErrors] = useState<Record<string, string>>({})
  const list = useQuery({ queryKey: key, queryFn: () => api<Guardian[]>(`/admission/applicants/${applicantId}/guardians`) })
  const add = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/admission/applicants/${applicantId}/guardians`, { method: 'POST', body }),
    onSuccess: async () => {
      setErrors({})
      await qc.invalidateQueries({ queryKey: key })
      await qc.invalidateQueries({ queryKey: ['application'] })
    },
    onError: (e) => setErrors(fieldErrors(e)),
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    add.mutate({
      relationship: f.get('relationship'),
      full_name: f.get('full_name'),
      phone: f.get('phone') || null,
      is_primary_contact: f.get('is_primary_contact') === 'on',
    })
    e.currentTarget.reset()
  }

  return (
    <section className="card">
      <h2>Orang Tua / Wali</h2>
      <ul className="list">
        {list.data?.map((g) => <li key={g.id}>{RELATIONS[g.relationship]}: {g.full_name} {g.phone && `(${g.phone})`}</li>)}
      </ul>
      <form onSubmit={onSubmit} className="row">
        <select name="relationship" defaultValue="FATHER" aria-label="Hubungan">
          {Object.entries(RELATIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Field label="Nama" name="full_name" required error={errors.full_name} />
        <Field label="No. HP" name="phone" />
        <label><input type="checkbox" name="is_primary_contact" /> Kontak utama</label>
        <button disabled={add.isPending}>Tambah</button>
      </form>
      {errors.relationship && <p className="error">{errors.relationship}</p>}
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
        <p>{a.period_name} · No. {a.registration_number} · <StatusBadge status={a.status} /></p>
        <progress value={a.completion_percentage} max={100} aria-label="Kelengkapan" /> {a.completion_percentage}%
        {a.status === 'DRAFT' && (
          <p>
            <button onClick={() => submit.mutate()} disabled={submit.isPending}>Kirim pendaftaran</button>
            {submit.error && <span className="error" role="alert"> {message(submit.error)}</span>}
          </p>
        )}
      </section>
      <ResultCard application={a} />
      <ReRegistrationCard application={a} />
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
