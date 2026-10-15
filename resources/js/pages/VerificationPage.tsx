import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import type { AdmissionPeriod, QueueItem } from '../types/api'

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

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
    case 'NOT_UPLOADED':
      return (
        <span className="badge" style={{ background: 'var(--muted)', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="circle" size={10} /> Belum Diunggah
        </span>
      )
    default:
      return <span className="badge">{status}</span>
  }
}

export function VerificationPage() {
  const [assignment, setAssignment] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null)

  const periods = useQuery({
    queryKey: ['periods-list'],
    queryFn: () => api<AdmissionPeriod[]>('/admission/periods', { auth: false }),
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedItem(null)
      }
    }
    if (selectedItem) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItem])

  const q = new URLSearchParams()
  if (assignment) q.set('assignment', assignment)
  if (periodId) q.set('admission_period_id', periodId)
  if (search) q.set('search', search)
  const { data, isPending } = useQuery({
    queryKey: ['verification-queue', assignment, periodId, search],
    queryFn: () => api<QueueItem[]>(`/verification/queue?${q}`),
  })

  return (
    <>
      <section className="card">
        <PageHeader
          title="Antrean Verifikasi"
          description="Daftar berkas pendaftaran calon siswa yang menunggu penugasan dan pemeriksaan oleh staf verifikator."
        />
        <div className="row">
          <input
            placeholder="Cari nama / no. pendaftaran"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari"
          />
          <select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            aria-label="Filter Gelombang"
          >
            <option value="">Semua Gelombang</option>
            {periods.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
            aria-label="Penugasan"
          >
            <option value="">Semua Penugasan</option>
            <option value="unassigned">Belum ditugaskan</option>
            <option value="assigned_to_me">Ditugaskan ke saya</option>
          </select>
        </div>

        {isPending ? (
          <p className="loading-indicator">Memuat data antrean…</p>
        ) : data && data.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>No. Pendaftaran</th>
                  <th>Nama Calon Siswa</th>
                  <th>Gelombang</th>
                  <th>Tgl Daftar / Submit</th>
                  <th>Status</th>
                  <th>Verifikator</th>
                  <th>Berkas (Valid / Total)</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map((i) => {
                  const counts = i.document_counts
                  const isAllValid = counts.valid === counts.total && counts.total > 0
                  const hasRevision = counts.revision_required > 0
                  const hasPending = counts.pending > 0

                  return (
                    <tr key={i.id}>
                      <td>
                        <Link to={`/verifikasi/${i.id}`}>
                          <strong>{i.registration_number ?? 'DRAF'}</strong>
                        </Link>
                      </td>
                      <td>
                        <strong>{i.applicant_name}</strong>
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--muted-bg, rgba(0,0,0,0.06))', color: 'var(--fg)', fontSize: '0.75rem' }}>
                          {i.period_name ?? '—'}
                        </span>
                      </td>
                      <td>
                        {i.submitted_at ? (
                          <div title={`Diajukan: ${new Date(i.submitted_at).toLocaleString('id-ID')}`}>
                            <span style={{ fontWeight: 500 }}>
                              {new Date(i.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <br />
                            <small className="hint" style={{ fontSize: '0.75rem' }}>
                              {new Date(i.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </small>
                          </div>
                        ) : i.created_at ? (
                          <span className="hint" style={{ fontSize: '0.8rem' }} title="Draf dibuat tapi belum resmi disubmit">
                            Draf ({new Date(i.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
                          </span>
                        ) : (
                          <span className="hint">—</span>
                        )}
                      </td>
                      <td><StatusBadge status={i.status} /></td>
                      <td>{i.assigned_verifier_name ?? '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className={`badge ${
                              isAllValid
                                ? 'badge-verified'
                                : hasRevision
                                ? 'badge-rejected'
                                : hasPending
                                ? 'badge-draft'
                                : ''
                            }`}
                            style={{ fontWeight: 600 }}
                          >
                            {counts.valid} / {counts.total} Valid
                          </span>

                          <button
                            type="button"
                            className="button secondary"
                            style={{ fontSize: '0.75rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => setSelectedItem(i)}
                            title="Rincian Berkas yang Sudah Dikirim & Status Validasi"
                            aria-label={`Rincian berkas ${i.applicant_name}`}
                          >
                            <Icon name="eye" size={13} /> Rincian Berkas
                          </button>
                        </div>
                      </td>
                      <td>
                        <Link
                          to={`/verifikasi/${i.id}`}
                          className="button secondary"
                          style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                        >
                          Periksa →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Tidak ada pendaftaran di antrean"
            description="Semua berkas pendaftaran calon siswa telah diverifikasi atau belum ada berkas baru yang diajukan."
          />
        )}
      </section>

      {/* Modal Dialog Rincian Status Berkas Persyaratan (Menonjol ke depan / Floating Modal Window) */}
      {selectedItem && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedItem(null)}
          role="presentation"
        >
          <div
            className="modal-window"
            style={{
              maxWidth: 780,
              padding: 24,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-doc-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 id="modal-doc-title" style={{ fontSize: '1.2rem', margin: 0 }}>
                  Rincian Berkas Persyaratan
                </h2>
                <small className="hint">
                  {selectedItem.applicant_name} • {selectedItem.registration_number ?? 'Draf'} ({selectedItem.period_name})
                </small>
              </div>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '4px 10px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => setSelectedItem(null)}
              >
                <Icon name="x" size={14} /> Tutup
              </button>
            </div>

            {/* Rincian Pendaftaran & Gelombang */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                marginBottom: 16,
                padding: '12px 14px',
                background: 'var(--bg)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>GELOMBANG PENDAFTARAN</span>
                <strong>{selectedItem.period_name}</strong>
                {selectedItem.period_start && selectedItem.period_end && (
                  <small className="hint" style={{ display: 'block', fontSize: '0.75rem', marginTop: 2 }}>
                    {new Date(selectedItem.period_start).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} s/d {new Date(selectedItem.period_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </small>
                )}
              </div>
              <div>
                <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>TANGGAL DAFTAR (SUBMIT)</span>
                <strong>
                  {selectedItem.submitted_at ? (
                    <>
                      {new Date(selectedItem.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      <br />
                      <small className="hint" style={{ fontWeight: 'normal' }}>
                        {new Date(selectedItem.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                      </small>
                    </>
                  ) : (
                    <span className="hint">Belum Diajukan (Draf)</span>
                  )}
                </strong>
              </div>
              {selectedItem.created_at && (
                <div>
                  <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>DRAF DIBUAT</span>
                  <span>
                    {new Date(selectedItem.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    <br />
                    <small className="hint">
                      {new Date(selectedItem.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </small>
                  </span>
                </div>
              )}
              <div>
                <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>STATUS PENDAFTARAN</span>
                <StatusBadge status={selectedItem.status} />
              </div>
            </div>

            {/* Ringkasan Jumlah Berkas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: 10,
                marginBottom: 16,
                padding: '10px 14px',
                background: 'var(--bg)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div>
                <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>TOTAL PERSYARATAN</span>
                <strong style={{ fontSize: '1.15rem' }}>{selectedItem.document_counts.total} Berkas</strong>
              </div>
              <div>
                <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>SUDAH DIKIRIM</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--brand)' }}>
                  {selectedItem.document_counts.uploaded ?? selectedItem.documents?.filter((d) => d.is_uploaded).length ?? 0}
                </strong>
              </div>
              <div>
                <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>SUDAH VALID</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--brand)' }}>
                  {selectedItem.document_counts.valid}
                </strong>
              </div>
              <div>
                <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>PERLU PERBAIKAN</span>
                <strong style={{ fontSize: '1.15rem', color: selectedItem.document_counts.revision_required > 0 ? 'var(--danger)' : 'inherit' }}>
                  {selectedItem.document_counts.revision_required}
                </strong>
              </div>
              <div>
                <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>BELUM DIPERIKSA</span>
                <strong style={{ fontSize: '1.15rem' }}>
                  {selectedItem.document_counts.pending}
                </strong>
              </div>
            </div>

            {/* Tabel Daftar Berkas Persyaratan */}
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Berkas Persyaratan</th>
                    <th>Status Validasi</th>
                    <th>Nama Berkas Terunggah</th>
                    <th>Ukuran File</th>
                    <th>Keterangan / Catatan Verifikator</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.documents && selectedItem.documents.length > 0 ? (
                    selectedItem.documents.map((doc, idx) => (
                      <tr key={doc.requirement_id || idx}>
                        <td>
                          <strong>{doc.requirement_name}</strong>
                          {doc.is_required && (
                            <span className="badge" style={{ marginLeft: 6, fontSize: '0.7rem' }}>
                              Wajib
                            </span>
                          )}
                        </td>
                        <td>{renderDocStatusBadge(doc.status)}</td>
                        <td>
                          {doc.is_uploaded && doc.original_filename ? (
                            <code style={{ fontSize: '0.8rem' }}>{doc.original_filename}</code>
                          ) : (
                            <span className="hint" style={{ fontStyle: 'italic' }}>— Belum dikirim —</span>
                          )}
                        </td>
                        <td className="num">{formatBytes(doc.file_size)}</td>
                        <td>
                          {doc.verification_note ? (
                            <span style={{ fontSize: '0.85rem', color: doc.status === 'REVISION_REQUIRED' ? 'var(--danger)' : 'inherit' }}>
                              {doc.verification_note}
                            </span>
                          ) : doc.is_uploaded ? (
                            <span className="hint" style={{ fontSize: '0.8rem' }}>Telah diunggah oleh pendaftar</span>
                          ) : (
                            <span className="hint" style={{ fontSize: '0.8rem' }}>Menunggu unggahan pendaftar</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: 16 }}>
                        <span className="hint">Tidak ada rincian dokumen yang terdaftar.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Tombol Aksi di Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setSelectedItem(null)}
              >
                Tutup
              </button>
              <Link
                to={`/verifikasi/${selectedItem.id}`}
                className="button"
                onClick={() => setSelectedItem(null)}
              >
                Buka Halaman Verifikasi Lengkap →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

