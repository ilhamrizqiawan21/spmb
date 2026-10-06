import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { useAuth } from '../features/auth/AuthContext'
import { api, openBlob } from '../lib/api'
import type { Applicant, Application, ApplicationDocument, Guardian } from '../types/api'

export function VerificationDetailPage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const qc = useQueryClient()
  const [notes, setNotes] = useState('')

  const app = useQuery({ queryKey: ['application', id], queryFn: () => api<Application>(`/admission/applications/${id}`) })
  const applicantId = app.data?.applicant_id
  const applicant = useQuery({ queryKey: ['applicant', applicantId], enabled: !!applicantId, queryFn: () => api<Applicant>(`/admission/applicants/${applicantId}`) })
  const guardians = useQuery({ queryKey: ['guardians', applicantId], enabled: !!applicantId, queryFn: () => api<Guardian[]>(`/admission/applicants/${applicantId}/guardians`) })
  const docs = useQuery({ queryKey: ['documents', id], queryFn: () => api<ApplicationDocument[]>(`/admission/applications/${id}/documents`) })

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['application', id] }),
      qc.invalidateQueries({ queryKey: ['documents', id] }),
      qc.invalidateQueries({ queryKey: ['verification-queue'] }),
    ])
  }

  const verifyDoc = useMutation({
    mutationFn: (v: { docId: string; valid: boolean; note?: string }) =>
      api(`/admission/documents/${v.docId}/verify`, { method: 'POST', body: { is_valid_doc: v.valid, verification_note: v.note ?? null } }),
    onSuccess: refresh,
  })
  const revise = useMutation({
    mutationFn: (v: { docId: string; reason: string }) => api(`/admission/documents/${v.docId}/request-revision`, { method: 'POST', body: { reason: v.reason } }),
    onSuccess: refresh,
  })
  const assign = useMutation({
    mutationFn: () => api('/verification/assignments', { method: 'POST', body: { application_id: id, verifier_id: user?.id } }),
    onSuccess: refresh,
  })
  const complete = useMutation({
    mutationFn: (toStatus: 'VERIFIED' | 'REVISION_REQUIRED') =>
      api('/verification/applications/' + id + '/complete', { method: 'POST', body: { to_status: toStatus, notes: notes || null } }),
    onSuccess: refresh,
  })
  const download = useMutation({ mutationFn: (docId: string) => openBlob(`/admission/documents/${docId}/download`) })

  if (app.isPending) return <p>Memuat…</p>
  if (app.error) return <ErrorNote error={app.error} />
  const a = app.data
  const canAct = can('document.verify', 'application.verify', 'application.override')
  const finished = !['SUBMITTED', 'UNDER_VERIFICATION', 'RESUBMITTED'].includes(a.status)

  return (
    <>
      <p><Link to="/verifikasi">← Antrean</Link></p>
      <section className="card">
        <h1>{a.applicant_name}</h1>
        <p>{a.period_name} · No. {a.registration_number} · <StatusBadge status={a.status} /></p>
        {applicant.data && (
          <dl className="details">
            <dt>TTL</dt><dd>{applicant.data.birth_place}, {applicant.data.birth_date}</dd>
            <dt>NIK</dt><dd>{applicant.data.nik ?? '—'}</dd>
            <dt>NISN</dt><dd>{applicant.data.nisn ?? '—'}</dd>
            <dt>Alamat</dt><dd>{applicant.data.address}</dd>
            <dt>Wali</dt><dd>{guardians.data?.map((g) => `${g.full_name} (${g.relationship})`).join(', ') || '—'}</dd>
          </dl>
        )}
        {can('application.verify', 'application.override') && ['SUBMITTED', 'RESUBMITTED'].includes(a.status) && (
          <button onClick={() => assign.mutate()} disabled={assign.isPending}>Tugaskan ke saya</button>
        )}
        <ErrorNote error={assign.error} />
      </section>

      <section className="card">
        <h2>Berkas</h2>
        <ErrorNote error={verifyDoc.error ?? revise.error ?? download.error} />
        <table>
          <thead><tr><th>Berkas</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {docs.data?.map((d) => (
              <tr key={d.id}>
                <td>{d.requirement_name} <small>(v{d.version}, {d.original_filename})</small></td>
                <td><StatusBadge status={d.status} /> {d.verification_note && <small>{d.verification_note}</small>}</td>
                <td className="row">
                  <button className="secondary" onClick={() => download.mutate(d.id)}>Lihat</button>
                  {canAct && !finished && (
                    <>
                      <button onClick={() => verifyDoc.mutate({ docId: d.id, valid: true })}>Valid</button>
                      <button className="danger" onClick={() => verifyDoc.mutate({ docId: d.id, valid: false, note: window.prompt('Alasan tidak valid?') ?? undefined })}>Tidak valid</button>
                      <button className="secondary" onClick={() => { const r = window.prompt('Alasan revisi?'); if (r) revise.mutate({ docId: d.id, reason: r }) }}>Minta revisi</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {docs.data?.length === 0 && <p>Belum ada berkas diunggah.</p>}
      </section>

      {canAct && !finished && (
        <section className="card">
          <h2>Keputusan Verifikasi</h2>
          <label className="field"><span>Catatan</span><input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <div className="row">
            <button onClick={() => complete.mutate('VERIFIED')} disabled={complete.isPending}>Nyatakan terverifikasi</button>
            <button className="secondary" onClick={() => complete.mutate('REVISION_REQUIRED')} disabled={complete.isPending}>Minta perbaikan</button>
          </div>
          <ErrorNote error={complete.error} />
        </section>
      )}
    </>
  )
}
