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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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

  // Perhitungan statistik cepat dari antrean
  const totalItems = data?.length ?? 0
  const unassignedCount = data?.filter((i) => !i.assigned_verifier_id && !i.assigned_verifier_name).length ?? 0
  const allValidCount = data?.filter((i) => i.document_counts.valid === i.document_counts.total && i.document_counts.total > 0).length ?? 0
  const hasFilter = Boolean(search || periodId || assignment)

  return (
    <>
      <section className="card">
        <PageHeader
          title="Antrean Verifikasi Dokumen"
          description="Pemeriksaan berkas persyaratan pendaftaran calon siswa baru oleh tim verifikator."
        />

        {/* Ringkasan Cepat Antrean */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
            }}
          >
            <span className="hint" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Antrean
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 2 }}>{totalItems} Pendaftar</div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
            }}
          >
            <span className="hint" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Belum Ditugaskan
            </span>
            <div
              style={{
                fontSize: '1.4rem',
                fontWeight: 700,
                marginTop: 2,
                color: unassignedCount > 0 ? 'var(--warning)' : 'inherit',
              }}
            >
              {unassignedCount} Pendaftar
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
            }}
          >
            <span className="hint" style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Berkas Lengkap & Valid
            </span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 2, color: 'var(--brand)' }}>
              {allValidCount} Pendaftar
            </div>
          </div>
        </div>

        {/* Panel Filter Antrean */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: hasFilter
              ? 'repeat(auto-fit, minmax(200px, 1fr)) auto'
              : 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            alignItems: 'center',
            marginBottom: 20,
            padding: 14,
            background: 'var(--bg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--line)',
          }}
        >
          <div>
            <input
              placeholder="Cari nama siswa atau no. pendaftaran…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Cari nama atau nomor pendaftaran"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              aria-label="Filter Gelombang"
              style={{ width: '100%' }}
            >
              <option value="">Semua Gelombang</option>
              {periods.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
              aria-label="Penugasan"
              style={{ width: '100%' }}
            >
              <option value="">Semua Penugasan</option>
              <option value="unassigned">Belum ditugaskan</option>
              <option value="assigned_to_me">Ditugaskan ke saya</option>
            </select>
          </div>

          {hasFilter && (
            <div>
              <button
                type="button"
                className="button secondary"
                style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setSearch('')
                  setPeriodId('')
                  setAssignment('')
                }}
                title="Kembalikan semua filter ke awal"
              >
                <Icon name="refresh-cw" size={13} /> Reset Filter
              </button>
            </div>
          )}
        </div>

        {isPending ? (
          <p className="loading-indicator">Memuat data antrean…</p>
        ) : data && data.length > 0 ? (
          <div className="table-wrapper" style={{ overflowX: 'auto', marginBottom: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Calon Siswa & No. Pendaftaran</th>
                  <th style={{ width: 130 }}>Gelombang</th>
                  <th style={{ width: 130 }}>Tgl Submit</th>
                  <th style={{ width: 140 }}>Status Pendaftaran</th>
                  <th style={{ width: 140 }}>Verifikator</th>
                  <th style={{ width: 140 }}>Kelengkapan Berkas</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Aksi</th>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: 'var(--brand-light)',
                              color: 'var(--brand)',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              border: '1px solid var(--brand)',
                            }}
                            aria-hidden="true"
                          >
                            {getInitials(i.applicant_name)}
                          </div>
                          <div>
                            <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--fg)', lineHeight: 1.3 }}>
                              {i.applicant_name}
                            </strong>
                            <Link
                              to={`/verifikasi/${i.id}`}
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 600,
                                fontSize: '0.78rem',
                                color: 'var(--brand)',
                                textDecoration: 'none',
                                display: 'inline-block',
                                marginTop: 2,
                              }}
                              title="Buka detail verifikasi"
                            >
                              {i.registration_number ?? 'DRAF'}
                            </Link>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.75rem',
                            border: '1px solid var(--line)',
                            background: 'var(--bg)',
                            color: 'var(--fg)',
                          }}
                        >
                          {i.period_name ?? '—'}
                        </span>
                      </td>

                      <td style={{ whiteSpace: 'nowrap' }}>
                        {i.submitted_at ? (
                          <div style={{ lineHeight: 1.35 }} title={`Diajukan: ${new Date(i.submitted_at).toLocaleString('id-ID')}`}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                              {new Date(i.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            <div className="hint" style={{ fontSize: '0.75rem', marginTop: 1 }}>
                              {new Date(i.submitted_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </div>
                          </div>
                        ) : i.created_at ? (
                          <span className="hint" style={{ fontSize: '0.8rem' }} title="Draf dibuat tapi belum resmi disubmit">
                            Draf ({new Date(i.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})
                          </span>
                        ) : (
                          <span className="hint">—</span>
                        )}
                      </td>

                      <td>
                        <StatusBadge status={i.status} />
                      </td>

                      <td>
                        {i.assigned_verifier_name ? (
                          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {i.assigned_verifier_name}
                          </span>
                        ) : (
                          <span className="badge badge-draft" style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                            Belum Ditugaskan
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
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
                            style={{ fontWeight: 600, fontSize: '0.75rem' }}
                          >
                            {counts.valid} / {counts.total} Valid
                          </span>

                          <button
                            type="button"
                            className="button secondary"
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 7px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            onClick={() => setSelectedItem(i)}
                            title="Rincian Berkas yang Sudah Dikirim & Status Validasi"
                            aria-label={`Rincian berkas ${i.applicant_name}`}
                          >
                            <Icon name="eye" size={11} /> Rincian Berkas
                          </button>
                        </div>
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Link
                          to={`/verifikasi/${i.id}`}
                          className="button secondary"
                          style={{
                            fontSize: '0.82rem',
                            padding: '6px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            fontWeight: 600,
                          }}
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
                    <th style={{ width: '25%' }}>Berkas Persyaratan</th>
                    <th style={{ width: '18%' }}>Status Validasi</th>
                    <th style={{ width: '22%' }}>File Terunggah</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Ukuran</th>
                    <th style={{ width: '23%' }}>Catatan Verifikator</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItem.documents && selectedItem.documents.length > 0 ? (
                    selectedItem.documents.map((doc, idx) => (
                      <tr key={doc.requirement_id || idx}>
                        <td>
                          <strong style={{ display: 'block', fontSize: '0.875rem' }}>{doc.requirement_name}</strong>
                          {doc.is_required && (
                            <span
                              className="badge"
                              style={{
                                marginTop: 4,
                                fontSize: '0.68rem',
                                border: '1px solid var(--line)',
                                background: 'var(--bg)',
                              }}
                            >
                              Wajib
                            </span>
                          )}
                        </td>
                        <td>{renderDocStatusBadge(doc.status)}</td>
                        <td>
                          {doc.is_uploaded && doc.original_filename ? (
                            <code
                              style={{
                                fontSize: '0.8rem',
                                maxWidth: 180,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                                background: 'var(--bg)',
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--line)',
                              }}
                              title={doc.original_filename}
                            >
                              {doc.original_filename}
                            </code>
                          ) : (
                            <span className="hint" style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>
                              — Belum dikirim —
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '0.825rem', whiteSpace: 'nowrap' }}>
                          {formatBytes(doc.file_size)}
                        </td>
                        <td>
                          {doc.verification_note ? (
                            <div
                              style={{
                                fontSize: '0.8rem',
                                padding: '4px 8px',
                                borderRadius: 'var(--radius-sm)',
                                background:
                                  doc.status === 'REVISION_REQUIRED'
                                    ? 'var(--warning-light)'
                                    : doc.status === 'INVALID'
                                    ? 'var(--danger-light)'
                                    : 'var(--bg)',
                                border: `1px solid ${
                                  doc.status === 'REVISION_REQUIRED'
                                    ? 'var(--warning)'
                                    : doc.status === 'INVALID'
                                    ? 'var(--danger)'
                                    : 'var(--line)'
                                }`,
                                lineHeight: 1.3,
                              }}
                            >
                              {doc.verification_note}
                            </div>
                          ) : doc.is_uploaded ? (
                            <span className="hint" style={{ fontSize: '0.8rem' }}>
                              Sudah diunggah
                            </span>
                          ) : (
                            <span className="hint" style={{ fontSize: '0.8rem' }}>
                              Menunggu unggahan
                            </span>
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

