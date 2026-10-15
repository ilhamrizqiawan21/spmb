import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../features/auth/AuthContext'
import { api, openBlob } from '../lib/api'
import type { Applicant, Application, ApplicationDocument, Guardian, QueueItem, StaffMember } from '../types/api'

function renderDocStatusBadge(status: string) {
  switch (status) {
    case 'VALID':
      return (
        <span className="badge badge-verified" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="check" size={12} /> Valid
        </span>
      )
    case 'PENDING':
      return (
        <span className="badge badge-draft" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="clock" size={12} /> Menunggu Diperiksa
        </span>
      )
    case 'REVISION_REQUIRED':
      return (
        <span className="badge badge-rejected" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="alert-triangle" size={12} /> Perlu Revisi
        </span>
      )
    case 'INVALID':
      return (
        <span className="badge badge-rejected" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="x" size={12} /> Tidak Valid
        </span>
      )
    default:
      return <span className="badge">{status}</span>
  }
}

const COMMON_REVISION_REASONS = [
  'Foto atau hasil pemindaian berkas buram dan tidak terbaca jelas.',
  'Dokumen yang diunggah tidak sesuai dengan persyaratan yang diminta.',
  'Data identitas (Nama/NIK) pada dokumen berbeda dengan data formulir.',
  'Masa berlaku berkas telah kedaluwarsa atau belum dilegalisir.',
]

export function VerificationDetailPage() {
  const { id = '' } = useParams()
  const { user, can } = useAuth()
  const qc = useQueryClient()

  const [notes, setNotes] = useState('')
  const [verifierId, setVerifierId] = useState('')
  const [actionDoc, setActionDoc] = useState<{
    doc: ApplicationDocument
    action: 'REVISE' | 'INVALID'
  } | null>(null)
  const [docReason, setDocReason] = useState('')

  const canAssign = can('application.verify', 'application.override')
  const canAct = can('document.verify', 'application.verify', 'application.override')

  const app = useQuery({
    queryKey: ['application', id],
    queryFn: () => api<Application>(`/admission/applications/${id}`),
  })
  const applicantId = app.data?.applicant_id
  const applicant = useQuery({
    queryKey: ['applicant', applicantId],
    enabled: !!applicantId,
    queryFn: () => api<Applicant>(`/admission/applicants/${applicantId}`),
  })
  const guardians = useQuery({
    queryKey: ['guardians', applicantId],
    enabled: !!applicantId,
    queryFn: () => api<Guardian[]>(`/admission/applicants/${applicantId}/guardians`),
  })
  const docs = useQuery({
    queryKey: ['documents', id],
    queryFn: () => api<ApplicationDocument[]>(`/admission/applications/${id}/documents`),
  })

  const regNo = app.data?.registration_number
  const verifiers = useQuery({
    queryKey: ['staff', 'verifier'],
    enabled: canAssign,
    queryFn: () => api<StaffMember[]>('/auth/staff?role=verifier'),
  })
  const queueItem = useQuery({
    queryKey: ['verification-queue', 'item', id, regNo],
    enabled: !!regNo,
    queryFn: async () =>
      (await api<QueueItem[]>(`/verification/queue?search=${encodeURIComponent(regNo ?? '')}`)).find((i) => i.id === id) ??
      null,
  })

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['application', id] }),
      qc.invalidateQueries({ queryKey: ['documents', id] }),
      qc.invalidateQueries({ queryKey: ['verification-queue'] }),
    ])
  }

  const verifyDoc = useMutation({
    mutationFn: (v: { docId: string; valid: boolean; note?: string }) =>
      api(`/admission/documents/${v.docId}/verify`, {
        method: 'POST',
        body: { is_valid_doc: v.valid, verification_note: v.note ?? null },
      }),
    onSuccess: async () => {
      setActionDoc(null)
      setDocReason('')
      await refresh()
    },
  })

  const revise = useMutation({
    mutationFn: (v: { docId: string; reason: string }) =>
      api(`/admission/documents/${v.docId}/request-revision`, {
        method: 'POST',
        body: { reason: v.reason },
      }),
    onSuccess: async () => {
      setActionDoc(null)
      setDocReason('')
      await refresh()
    },
  })

  const assign = useMutation({
    mutationFn: (verifier: string) =>
      api('/verification/assignments', {
        method: 'POST',
        body: { application_id: id, verifier_id: verifier },
      }),
    onSuccess: refresh,
  })

  const complete = useMutation({
    mutationFn: (toStatus: 'VERIFIED' | 'REVISION_REQUIRED') =>
      api('/verification/applications/' + id + '/complete', {
        method: 'POST',
        body: { to_status: toStatus, notes: notes || null },
      }),
    onSuccess: refresh,
  })

  const download = useMutation({
    mutationFn: (docId: string) => openBlob(`/admission/documents/${docId}/download`),
  })

  if (app.isPending) {
    return <p className="loading-indicator">Memuat data verifikasi calon siswa…</p>
  }
  if (app.error) {
    return <ErrorNote error={app.error} />
  }

  const a = app.data!
  const finished = !['SUBMITTED', 'UNDER_VERIFICATION', 'RESUBMITTED'].includes(a.status)

  // Analisis kelengkapan dokumen
  const docList = docs.data ?? []
  const totalDocs = docList.length
  const validDocs = docList.filter((d) => d.status === 'VALID').length
  const pendingDocs = docList.filter((d) => d.status === 'PENDING').length
  const revisionDocs = docList.filter((d) => d.status === 'REVISION_REQUIRED').length
  const invalidDocs = docList.filter((d) => d.status === 'INVALID').length

  const allDocumentsValid = totalDocs > 0 && validDocs === totalDocs
  const hasIncompleteDocs = pendingDocs > 0 || revisionDocs > 0 || invalidDocs > 0

  function handleOpenActionModal(doc: ApplicationDocument, action: 'REVISE' | 'INVALID') {
    setActionDoc({ doc, action })
    setDocReason(doc.verification_note ?? '')
  }

  function handleConfirmDocAction() {
    if (!actionDoc) return
    const reasonText = docReason.trim()
    if (!reasonText) {
      alert('Mohon masukkan alasan catatan untuk calon siswa.')
      return
    }

    if (actionDoc.action === 'REVISE') {
      revise.mutate({ docId: actionDoc.doc.id, reason: reasonText })
    } else {
      verifyDoc.mutate({ docId: actionDoc.doc.id, valid: false, note: reasonText })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tombol Navigasi Kembali */}
      <div>
        <Link
          to="/verifikasi"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'var(--muted)',
          }}
        >
          ← Kembali ke Antrean Verifikasi
        </Link>
      </div>

      {/* Header Halaman Utama */}
      <PageHeader
        title={a.applicant_name}
        description={`Pemeriksaan kelengkapan berkas fisik & digital pendaftaran calon siswa baru • ${a.period_name}`}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={a.status} />
            <button
              type="button"
              className="button secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
              onClick={() => void refresh()}
              aria-label="Segarkan data"
            >
              <Icon name="refresh-cw" size={14} /> Segarkan
            </button>
          </div>
        }
      />

      {/* Grid Informasi Pendaftaran & Biodata Calon Siswa */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Kolom 1: Informasi Pendaftaran & Verifikator */}
        <section className="card" style={{ margin: 0 }}>
          <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Informasi Pendaftaran</h2>
            <span className="badge" style={{ fontSize: '0.75rem' }}>
              No: {a.registration_number ?? 'Draf'}
            </span>
          </div>

          <dl className="details" style={{ fontSize: '0.9rem' }}>
            <dt>Gelombang</dt>
            <dd>
              <strong>{a.period_name}</strong>
            </dd>

            <dt>Tgl Diajukan</dt>
            <dd>
              {a.submitted_at ? (
                <span>
                  <strong>
                    {new Date(a.submitted_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>{' '}
                  <span className="hint">
                    ({new Date(a.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
                  </span>
                </span>
              ) : (
                <span className="hint">Belum Diajukan Resmi</span>
              )}
            </dd>

            {a.created_at && (
              <>
                <dt>Draf Dibuat</dt>
                <dd>
                  {new Date(a.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </>
            )}

            <dt>Verifikator</dt>
            <dd>
              <strong>{queueItem.data?.assigned_verifier_name ?? 'Belum Ditugaskan'}</strong>
            </dd>
          </dl>

          {/* Form Penugasan Verifikator (Untuk Admin / Supervisor) */}
          {canAssign && !finished && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: '1px solid var(--line)',
              }}
            >
              <label className="hint" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>
                PENUGASAN STAF VERIFIKATOR:
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={verifierId}
                  onChange={(e) => setVerifierId(e.target.value)}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                  aria-label="Pilih verifikator"
                >
                  <option value="">Pilih Staf Verifikator…</option>
                  {verifiers.data?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.id === user?.id ? '(Saya)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="button secondary"
                  style={{ fontSize: '0.85rem' }}
                  onClick={() => assign.mutate(verifierId)}
                  disabled={!verifierId || assign.isPending}
                >
                  {assign.isPending ? 'Menugaskan…' : 'Tugaskan'}
                </button>
              </div>
              <ErrorNote error={assign.error} />
            </div>
          )}
        </section>

        {/* Kolom 2: Biodata Calon Siswa & Wali */}
        <section className="card" style={{ margin: 0 }}>
          <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Biodata Calon Siswa</h2>
            <span className="badge badge-verified" style={{ fontSize: '0.75rem' }}>
              Identitas Pendaftar
            </span>
          </div>

          {applicant.isPending ? (
            <p className="loading-indicator">Memuat biodata calon siswa…</p>
          ) : applicant.data ? (
            <dl className="details" style={{ fontSize: '0.9rem' }}>
              <dt>Nama Lengkap</dt>
              <dd>
                <strong>{applicant.data.full_name}</strong>
              </dd>

              <dt>NIK / NISN</dt>
              <dd>
                <span>{applicant.data.nik ?? '—'}</span> / <span>{applicant.data.nisn ?? '—'}</span>
              </dd>

              <dt>TTL</dt>
              <dd>
                {applicant.data.birth_place ? `${applicant.data.birth_place}, ` : ''}
                {applicant.data.birth_date
                  ? new Date(applicant.data.birth_date).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </dd>

              <dt>Alamat Siswa</dt>
              <dd>{applicant.data.address || '—'}</dd>

              <dt>Orang Tua / Wali</dt>
              <dd>
                {guardians.data && guardians.data.length > 0 ? (
                  guardians.data.map((g, idx) => (
                    <div key={g.id || idx}>
                      <strong>{g.full_name}</strong> <span className="hint">({g.relationship})</span>
                      {g.phone ? ` • ${g.phone}` : ''}
                    </div>
                  ))
                ) : (
                  <span className="hint">— Tidak ada data wali —</span>
                )}
              </dd>
            </dl>
          ) : (
            <span className="hint">Data biodata tidak ditemukan.</span>
          )}
        </section>
      </div>

      {/* Section 2: Pemeriksaan & Validasi Dokumen Persyaratan */}
      <section className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Berkas Persyaratan Calon Siswa</h2>
            <small className="hint">
              Periksa kecocokan dan keabsahan dokumen persyaratan yang telah diunggah oleh pendaftar.
            </small>
          </div>

          {/* Indikator Kelengkapan Berkas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              className={`badge ${
                allDocumentsValid
                  ? 'badge-verified'
                  : revisionDocs > 0
                  ? 'badge-rejected'
                  : 'badge-draft'
              }`}
              style={{ fontWeight: 600, fontSize: '0.85rem' }}
            >
              {validDocs} / {totalDocs} Dokumen Valid
            </span>
          </div>
        </div>

        <ErrorNote error={verifyDoc.error ?? revise.error ?? download.error} />

        {docs.isPending ? (
          <p className="loading-indicator">Memuat daftar dokumen pendaftaran…</p>
        ) : docList.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Dokumen Persyaratan</th>
                  <th>Status Validasi</th>
                  <th>Nama Berkas Asli</th>
                  <th>Catatan Verifikator</th>
                  <th style={{ textAlign: 'center', minWidth: 260 }}>Aksi Pemeriksaan</th>
                </tr>
              </thead>
              <tbody>
                {docList.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.requirement_name}</strong>
                      <div style={{ marginTop: 2 }}>
                        <span className="badge" style={{ fontSize: '0.7rem' }}>
                          Versi ke-{d.version}
                        </span>
                      </div>
                    </td>

                    <td>{renderDocStatusBadge(d.status)}</td>

                    <td>
                      <code style={{ fontSize: '0.825rem' }}>{d.original_filename}</code>
                    </td>

                    <td>
                      {d.verification_note ? (
                        <span
                          style={{
                            fontSize: '0.85rem',
                            color: d.status === 'REVISION_REQUIRED' || d.status === 'INVALID' ? 'var(--danger)' : 'inherit',
                          }}
                        >
                          {d.verification_note}
                        </span>
                      ) : (
                        <span className="hint" style={{ fontSize: '0.8rem' }}>
                          — Tidak ada catatan khusus —
                        </span>
                      )}
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {/* Tombol Lihat Berkas */}
                        <button
                          type="button"
                          className="button secondary"
                          style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          onClick={() => download.mutate(d.id)}
                          title="Buka atau unduh berkas untuk diperiksa"
                        >
                          <Icon name="eye" size={13} /> Lihat
                        </button>

                        {/* Tombol Aksi Verifikasi jika masih dalam proses */}
                        {canAct && !finished && (
                          <>
                            <button
                              type="button"
                              className="button secondary"
                              style={{
                                fontSize: '0.8rem',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                borderColor: 'var(--brand)',
                                color: 'var(--brand)',
                                fontWeight: d.status === 'VALID' ? 700 : 500,
                              }}
                              onClick={() => verifyDoc.mutate({ docId: d.id, valid: true })}
                              disabled={verifyDoc.isPending || d.status === 'VALID'}
                              title="Setujui dan nyatakan dokumen ini valid"
                            >
                              <Icon name="check" size={13} /> Valid
                            </button>

                            <button
                              type="button"
                              className="button secondary"
                              style={{
                                fontSize: '0.8rem',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                color: 'var(--warning)',
                                borderColor: 'var(--warning)',
                              }}
                              onClick={() => handleOpenActionModal(d, 'REVISE')}
                              disabled={revise.isPending}
                              title="Minta calon siswa untuk memperbaiki atau mengunggah ulang dokumen ini"
                            >
                              <Icon name="refresh-cw" size={13} /> Revisi
                            </button>

                            <button
                              type="button"
                              className="button secondary"
                              style={{
                                fontSize: '0.8rem',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                color: 'var(--danger)',
                                borderColor: 'var(--danger)',
                              }}
                              onClick={() => handleOpenActionModal(d, 'INVALID')}
                              disabled={verifyDoc.isPending}
                              title="Tolak dan nyatakan dokumen ini tidak memenuhi syarat"
                            >
                              <Icon name="x" size={13} /> Tidak Valid
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada berkas terunggah"
            description="Calon siswa belum mengunggah dokumen persyaratan apa pun untuk pendaftaran ini."
          />
        )}
      </section>

      {/* Section 3: Keputusan Akhir Verifikasi */}
      {canAct && !finished ? (
        <section
          className="card"
          style={{
            margin: 0,
            borderLeft: `4px solid ${allDocumentsValid ? 'var(--brand)' : 'var(--warning)'}`,
          }}
        >
          <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Keputusan Akhir Verifikasi</h2>
              <small className="hint">
                Pilih keputusan verifikasi pendaftaran setelah seluruh berkas persyaratan selesai ditinjau.
              </small>
            </div>
          </div>

          {/* Status Kesiapan Dokumen */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: allDocumentsValid ? 'var(--brand-light)' : 'var(--warning-light)',
              color: 'var(--fg)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Icon
              name={allDocumentsValid ? 'check-circle' : 'alert-triangle'}
              size={22}
              style={{ color: allDocumentsValid ? 'var(--brand)' : 'var(--warning)', flexShrink: 0 }}
            />
            <div style={{ fontSize: '0.9rem' }}>
              {allDocumentsValid ? (
                <span>
                  <strong>Seluruh berkas persyaratan telah dinyatakan VALID ({validDocs}/{totalDocs}).</strong> Pendaftaran siap dinyatakan terverifikasi untuk melanjutkan ke tahap seleksi berikutnya.
                </span>
              ) : hasIncompleteDocs ? (
                <span>
                  <strong>Masih terdapat dokumen yang belum memenuhi syarat.</strong> Terdapat {revisionDocs} berkas perlu revisi, {invalidDocs} berkas tidak valid, dan {pendingDocs} berkas belum diperiksa.
                </span>
              ) : (
                <span>Belum ada dokumen yang diverifikasi.</span>
              )}
            </div>
          </div>

          {/* Form Catatan Verifikasi */}
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="verification-notes"
              style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: 6 }}
            >
              Catatan Keputusan Verifikasi (Opsional untuk siswa):
            </label>
            <textarea
              id="verification-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tuliskan catatan kelulusan verifikasi atau instruksi perbaikan umum untuk calon siswa…"
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Tombol Keputusan */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              className="button"
              onClick={() => complete.mutate('VERIFIED')}
              disabled={complete.isPending || !allDocumentsValid}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 18px',
                fontSize: '0.95rem',
              }}
              title={
                !allDocumentsValid
                  ? 'Seluruh dokumen wajib harus disetujui VALID terlebih dahulu'
                  : 'Nyatakan verifikasi selesai dan lolos'
              }
            >
              <Icon name="check-circle" size={16} /> Nyatakan terverifikasi
            </button>

            <button
              type="button"
              className="button secondary"
              onClick={() => complete.mutate('REVISION_REQUIRED')}
              disabled={complete.isPending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 18px',
                fontSize: '0.95rem',
                color: 'var(--warning)',
                borderColor: 'var(--warning)',
              }}
              title="Kirim instruksi perbaikan dokumen ke calon siswa"
            >
              <Icon name="alert-triangle" size={16} /> Minta perbaikan
            </button>
          </div>

          <ErrorNote error={complete.error} />
        </section>
      ) : finished ? (
        <section
          className="card"
          style={{
            margin: 0,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="check-circle" size={24} style={{ color: 'var(--brand)' }} />
            <div>
              <strong style={{ fontSize: '1rem', display: 'block' }}>Proses Verifikasi Selesai</strong>
              <span className="hint" style={{ fontSize: '0.85rem' }}>
                Pendaftaran ini saat ini berada pada status <strong>{a.status}</strong> dan tidak memerlukan tindakan verifikasi ulang.
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {/* Modal Dialog Interaktif untuk Minta Revisi / Tidak Valid (Menggantikan window.prompt) */}
      {actionDoc && (
        <div
          className="modal-overlay"
          onClick={() => setActionDoc(null)}
          role="presentation"
        >
          <div
            className="modal-window"
            style={{ maxWidth: 560, padding: 24 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-action-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 id="modal-action-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                  {actionDoc.action === 'REVISE' ? 'Minta Revisi Dokumen' : 'Tolak Dokumen (Tidak Valid)'}
                </h3>
                <small className="hint">
                  {actionDoc.doc.requirement_name} ({actionDoc.doc.original_filename})
                </small>
              </div>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                onClick={() => setActionDoc(null)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', marginBottom: 12, color: 'var(--muted)' }}>
              {actionDoc.action === 'REVISE'
                ? 'Tuliskan instruksi atau alasan perbaikan yang jelas agar calon siswa dapat mengunggah ulang dokumen yang benar.'
                : 'Tuliskan alasan mengapa dokumen ini dinyatakan tidak valid dan tidak memenuhi syarat pendaftaran.'}
            </p>

            {/* Template Pilihan Alasan Cepat */}
            <div style={{ marginBottom: 14 }}>
              <span className="hint" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 6 }}>
                TEMPLATE ALASAN CEPAT (KLIK UNTUK MEMILIH):
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {COMMON_REVISION_REASONS.map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="button secondary"
                    style={{
                      textAlign: 'left',
                      fontSize: '0.8rem',
                      padding: '6px 10px',
                      whiteSpace: 'normal',
                      lineHeight: 1.4,
                    }}
                    onClick={() => setDocReason(reason)}
                  >
                    • {reason}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea Alasan */}
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="doc-reason-input"
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}
              >
                Keterangan / Alasan untuk Siswa:
              </label>
              <textarea
                id="doc-reason-input"
                value={docReason}
                onChange={(e) => setDocReason(e.target.value)}
                rows={3}
                placeholder="Ketikkan alasan atau instruksi spesifik di sini…"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--line)',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                }}
                autoFocus
              />
            </div>

            {/* Tombol Aksi Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setActionDoc(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className={actionDoc.action === 'REVISE' ? 'button' : 'button danger'}
                onClick={handleConfirmDocAction}
                disabled={!docReason.trim() || revise.isPending || verifyDoc.isPending}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: actionDoc.action === 'REVISE' ? 'var(--warning)' : undefined,
                  borderColor: actionDoc.action === 'REVISE' ? 'var(--warning)' : undefined,
                  color: actionDoc.action === 'REVISE' ? '#fff' : undefined,
                }}
              >
                {actionDoc.action === 'REVISE' ? (
                  <>
                    <Icon name="refresh-cw" size={13} /> Kirim Permintaan Revisi
                  </>
                ) : (
                  <>
                    <Icon name="x" size={13} /> Konfirmasi Tidak Valid
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
