import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../features/auth/AuthContext'
import { api } from '../lib/api'
import type { AdmissionPeriod, Application, ApplicationScore, Decision, WaitingListEntry } from '../types/api'

interface DecisionModalProps {
  app: Application
  score?: ApplicationScore
  onClose: () => void
  onDone: () => void
}

function DecisionModal({ app, score, onClose, onDone }: DecisionModalProps) {
  const [decision, setDecision] = useState<'ACCEPTED' | 'WAITLISTED' | 'REJECTED'>(
    app.status === 'ACCEPTED' ? 'ACCEPTED' : app.status === 'WAITLISTED' ? 'WAITLISTED' : app.status === 'REJECTED' ? 'REJECTED' : 'ACCEPTED'
  )
  const [reason, setReason] = useState('')

  const existing = useQuery({
    queryKey: ['decision', app.id],
    queryFn: () => api<Decision>(`/selection/applications/${app.id}/decision`).catch(() => null),
  })

  const decide = useMutation({
    mutationFn: (data: { decision: string; reason: string | null }) =>
      api('/selection/applications/' + app.id + '/decision', {
        method: 'POST',
        body: { decision: data.decision, reason: data.reason },
      }),
    onSuccess: () => {
      onDone()
      onClose()
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    decide.mutate({ decision, reason: reason.trim() || null })
  }

  const isOverride = !!existing.data

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-window"
        style={{ maxWidth: 560, padding: 24 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="between" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 id="decision-modal-title" style={{ fontSize: '1.25rem', margin: 0 }}>
              Tetapkan Keputusan Seleksi
            </h2>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {app.applicant_name} • {app.registration_number ?? 'DRAF'}
            </p>
          </div>
          <button
            type="button"
            className="button secondary"
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
            onClick={onClose}
          >
            ✕ Tutup
          </button>
        </div>

        {/* Info Ringkas Pendaftar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 16,
            fontSize: '0.85rem',
            border: '1px solid var(--line)',
          }}
        >
          <div>
            <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>GELOMBANG</span>
            <strong>{app.period_name}</strong>
          </div>
          <div>
            <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>NILAI AKHIR</span>
            <strong style={{ fontSize: '1.1rem', color: 'var(--brand)' }}>{score?.final_score ?? '—'}</strong>
          </div>
          <div>
            <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>PERINGKAT</span>
            <strong>#{score?.rank ?? '—'}</strong>
          </div>
          <div>
            <span className="hint" style={{ display: 'block', fontSize: '0.7rem' }}>STATUS SAAT INI</span>
            <StatusBadge status={app.status} />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Pilihan Status Keputusan */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
              Pilih Keputusan:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: `2px solid ${decision === 'ACCEPTED' ? 'var(--brand)' : 'var(--line)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: decision === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="decision"
                  value="ACCEPTED"
                  checked={decision === 'ACCEPTED'}
                  onChange={() => setDecision('ACCEPTED')}
                />
                <div>
                  <strong style={{ display: 'block', color: 'var(--brand)' }}>✓ Diterima (ACCEPTED)</strong>
                  <span className="hint" style={{ fontSize: '0.8rem' }}>
                    Calon siswa dinyatakan lulus dan berhak melanjutkan ke daftar ulang.
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: `2px solid ${decision === 'WAITLISTED' ? 'var(--warning, #d97706)' : 'var(--line)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: decision === 'WAITLISTED' ? 'rgba(217, 119, 6, 0.08)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="decision"
                  value="WAITLISTED"
                  checked={decision === 'WAITLISTED'}
                  onChange={() => setDecision('WAITLISTED')}
                />
                <div>
                  <strong style={{ display: 'block', color: 'var(--warning, #d97706)' }}>⏳ Daftar Tunggu (WAITLISTED)</strong>
                  <span className="hint" style={{ fontSize: '0.8rem' }}>
                    Cadangan penerimaan yang dapat dipromosikan jika kuota utama tersedia.
                  </span>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: `2px solid ${decision === 'REJECTED' ? 'var(--danger)' : 'var(--line)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: decision === 'REJECTED' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="decision"
                  value="REJECTED"
                  checked={decision === 'REJECTED'}
                  onChange={() => setDecision('REJECTED')}
                />
                <div>
                  <strong style={{ display: 'block', color: 'var(--danger)' }}>✕ Ditolak (REJECTED)</strong>
                  <span className="hint" style={{ fontSize: '0.8rem' }}>
                    Calon siswa dinyatakan tidak lolos seleksi penerimaan.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Alasan Penetapan */}
          <label className="field" style={{ marginBottom: 16 }}>
            <span style={{ fontWeight: 600 }}>
              Alasan Keputusan {isOverride && <span style={{ color: 'var(--danger)' }}>* (Wajib untuk perubahan)</span>}
            </span>
            <textarea
              rows={3}
              placeholder={isOverride ? 'Wajib isi alasan perubahan keputusan...' : 'Alasan penetapan (opsional)...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={isOverride}
              aria-label={`Alasan ${app.registration_number}`}
            />
            {isOverride && (
              <small className="hint">
                Perhatian: Mengubah keputusan sebelumnya memerlukan catatan alasan untuk catatan audit.
              </small>
            )}
          </label>

          <ErrorNote error={decide.error} />

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="button secondary" onClick={onClose} disabled={decide.isPending}>
              Batal
            </button>
            <button type="submit" disabled={decide.isPending}>
              {decide.isPending ? 'Menyimpan…' : 'Simpan Keputusan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface PromoteModalProps {
  entry: WaitingListEntry
  onClose: () => void
  onDone: () => void
}

function PromoteModal({ entry, onClose, onDone }: PromoteModalProps) {
  const [reason, setReason] = useState('')

  const promote = useMutation({
    mutationFn: (r: string) =>
      api(`/selection/waiting-list/${entry.id}/promote`, { method: 'POST', body: { reason: r } }),
    onSuccess: () => {
      onDone()
      onClose()
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    promote.mutate(reason.trim())
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal-window"
        style={{ maxWidth: 500, padding: 24 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promote-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="between" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 id="promote-modal-title" style={{ fontSize: '1.25rem', margin: 0 }}>
              Promosikan dari Daftar Tunggu
            </h2>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              Antrean Cadangan #{entry.position}
            </p>
          </div>
          <button
            type="button"
            className="button secondary"
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
            onClick={onClose}
          >
            ✕ Tutup
          </button>
        </div>

        <div
          style={{
            padding: '12px 14px',
            background: 'var(--bg)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--line)',
            marginBottom: 16,
            fontSize: '0.85rem',
          }}
        >
          <div>
            <strong>{entry.applicant_name}</strong> ({entry.registration_number ?? 'DRAF'})
          </div>
          <div className="hint" style={{ marginTop: 4 }}>
            Nilai Akhir: <strong>{entry.score}</strong>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Calon siswa ini akan resmi dinaikkan statusnya menjadi <strong>DITERIMA (ACCEPTED)</strong> dan berhak untuk
            melakukan daftar ulang.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="field" style={{ marginBottom: 16 }}>
            <span style={{ fontWeight: 600 }}>
              Alasan Promosi <span style={{ color: 'var(--danger)' }}>*</span>
            </span>
            <textarea
              rows={3}
              placeholder="Contoh: Menggantikan calon siswa yang mengundurkan diri / penambahan kuota kelas..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              aria-label="Alasan promosi"
            />
          </label>

          <ErrorNote error={promote.error} />

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="button secondary" onClick={onClose} disabled={promote.isPending}>
              Batal
            </button>
            <button type="submit" disabled={!reason.trim() || promote.isPending}>
              {promote.isPending ? 'Memproses…' : '🚀 Konfirmasi Promosi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SelectionPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const periods = useQuery({
    queryKey: ['periods-all'],
    queryFn: () => api<AdmissionPeriod[]>('/admission/periods', { auth: false }),
  })
  const [periodId, setPeriodId] = useState('')
  const pid = periods.data ? periodId || periods.data[0]?.id || '' : ''

  const ranking = useQuery({
    queryKey: ['ranking', pid],
    enabled: !!pid,
    queryFn: () => api<ApplicationScore[]>(`/selection/periods/${pid}/ranking`),
  })
  const waiting = useQuery({
    queryKey: ['waiting', pid],
    enabled: !!pid,
    queryFn: () => api<WaitingListEntry[]>(`/selection/periods/${pid}/waiting-list`),
  })
  const apps = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<Application[]>('/admission/applications'),
  })

  const [selectedAppForDecision, setSelectedAppForDecision] = useState<{
    app: Application
    score?: ApplicationScore
  } | null>(null)
  const [selectedEntryForPromote, setSelectedEntryForPromote] = useState<WaitingListEntry | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedAppForDecision(null)
        setSelectedEntryForPromote(null)
      }
    }
    if (selectedAppForDecision || selectedEntryForPromote) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedAppForDecision, selectedEntryForPromote])

  const refresh = async () => {
    await Promise.all(['ranking', 'waiting', 'applications', 'decision'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
  }

  const rank = useMutation({
    mutationFn: () => api(`/selection/periods/${pid}/ranking`, { method: 'POST' }),
    onSuccess: refresh,
  })

  const publish = useMutation({
    mutationFn: () => api<{ published_count: number }>(`/selection/periods/${pid}/publish-announcement`, { method: 'POST', body: {} }),
    onSuccess: refresh,
  })

  const byId = new Map(apps.data?.map((a) => [a.id, a]))
  const selectedPeriod = periods.data?.find((p) => p.id === pid)

  // Statistik Ringkasan Periode
  const periodApps = apps.data?.filter((a) => a.admission_period_id === pid) ?? []
  const countAccepted = periodApps.filter((a) => a.status === 'ACCEPTED').length
  const countWaitlisted = waiting.data?.length ?? 0
  const countRejected = periodApps.filter((a) => a.status === 'REJECTED').length
  const countTotalRanked = ranking.data?.length ?? 0

  return (
    <>
      <PageHeader
        title="Seleksi & Keputusan"
        description="Kelola perankingan otomatis calon siswa, penetapan keputusan hasil penerimaan, serta manajemen daftar tunggu cadangan dan pengumuman hasil seleksi."
      />

      {/* 1. Panel Kontrol Gelombang & Aksi Cepat */}
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="between" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label className="field" style={{ margin: 0, minWidth: 260 }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Gelombang Pendaftaran:</span>
              <select value={pid} onChange={(e) => setPeriodId(e.target.value)} aria-label="Periode">
                {periods.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.quota ? `(Kuota: ${p.quota})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {selectedPeriod && (
              <div className="hint" style={{ fontSize: '0.85rem', marginTop: 14 }}>
                Kuota: <strong>{selectedPeriod.quota ?? 'Tidak Dibatasi'}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => rank.mutate()}
              disabled={!pid || rank.isPending}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Hitung skor terbobot dan perankingan seluruh peserta"
            >
              {rank.isPending ? 'Menghitung…' : 'Hitung peringkat'}
            </button>

            {can('announcement.publish', 'application.override') && (
              <button
                className="button secondary"
                onClick={() =>
                  window.confirm('Umumkan hasil seleksi untuk seluruh calon siswa pada gelombang ini ke publik?') &&
                  publish.mutate()
                }
                disabled={!pid || publish.isPending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Publikasikan keputusan penerimaan resmi"
              >
                {publish.isPending ? 'Menerbitkan…' : 'Umumkan hasil'}
              </button>
            )}
          </div>
        </div>

        {publish.data && (
          <div
            className="badge badge-verified"
            style={{ marginTop: 12, display: 'inline-block', padding: '6px 12px', fontSize: '0.85rem' }}
            role="status"
          >
            ✓ Sebanyak {publish.data.published_count} hasil seleksi berhasil diumumkan secara resmi ke publik.
          </div>
        )}

        <ErrorNote error={rank.error ?? publish.error} />
      </section>

      {/* 2. Kartu Metrik Ringkasan Hasil Seleksi */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="tile">
          <span className="tile-label">TOTAL DINILAI</span>
          <strong className="tile-value" style={{ fontSize: '1.4rem' }}>{countTotalRanked}</strong>
          <span className="hint" style={{ fontSize: '0.75rem' }}>Peserta teranking</span>
        </div>
        <div className="tile">
          <span className="tile-label">DITERIMA</span>
          <strong className="tile-value" style={{ fontSize: '1.4rem', color: 'var(--brand)' }}>{countAccepted}</strong>
          <span className="hint" style={{ fontSize: '0.75rem' }}>Lolos seleksi</span>
        </div>
        <div className="tile">
          <span className="tile-label">DAFTAR TUNGGU</span>
          <strong className="tile-value" style={{ fontSize: '1.4rem', color: 'var(--warning, #d97706)' }}>{countWaitlisted}</strong>
          <span className="hint" style={{ fontSize: '0.75rem' }}>Cadangan kuota</span>
        </div>
        <div className="tile">
          <span className="tile-label">DITOLAK</span>
          <strong className="tile-value" style={{ fontSize: '1.4rem', color: 'var(--danger)' }}>{countRejected}</strong>
          <span className="hint" style={{ fontSize: '0.75rem' }}>Tidak lolos</span>
        </div>
      </section>

      {/* 3. Tabel Peringkat Hasil Seleksi */}
      <section className="card" style={{ marginBottom: 24 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Peringkat</h2>
            <small className="hint">
              Urutan kelulusan dihitung berdasarkan Nilai Akhir (tertinggi) dan Waktu Submit Pendaftaran (terawal).
            </small>
          </div>
          {ranking.data && ranking.data.length > 0 && (
            <span className="badge" style={{ fontSize: '0.8rem' }}>
              {ranking.data.length} Peserta Teranking
            </span>
          )}
        </div>

        {ranking.isPending ? (
          <p className="loading-indicator">Memuat data peringkat…</p>
        ) : ranking.data && ranking.data.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>#</th>
                  <th>Pendaftar</th>
                  <th>Tgl Daftar / Submit</th>
                  <th style={{ textAlign: 'right' }}>Nilai Akhir</th>
                  <th>Status Sistem</th>
                  <th>Keputusan Seleksi</th>
                  <th style={{ textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {ranking.data.map((s) => {
                  const app = byId.get(s.application_id)
                  const submitted = s.submitted_at ?? app?.submitted_at
                  const rankNum = s.rank

                  return (
                    <tr key={s.id}>
                      <td style={{ textAlign: 'center' }}>
                        {rankNum === 1 ? (
                          <span className="badge badge-verified" style={{ fontWeight: 700 }} title="Peringkat 1">
                            🥇 1
                          </span>
                        ) : rankNum === 2 ? (
                          <span className="badge" style={{ fontWeight: 700, background: '#94a3b8', color: '#fff' }} title="Peringkat 2">
                            🥈 2
                          </span>
                        ) : rankNum === 3 ? (
                          <span className="badge" style={{ fontWeight: 700, background: '#b45309', color: '#fff' }} title="Peringkat 3">
                            🥉 3
                          </span>
                        ) : (
                          <strong style={{ color: 'var(--muted)' }}>#{rankNum ?? '—'}</strong>
                        )}
                      </td>
                      <td>
                        <strong>{s.applicant_name}</strong>
                        <br />
                        <small className="hint">{s.registration_number ?? 'DRAF'}</small>
                      </td>
                      <td>
                        {submitted ? (
                          <div title={`Diajukan: ${new Date(submitted).toLocaleString('id-ID')}`}>
                            <span style={{ fontWeight: 500 }}>
                              {new Date(submitted).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            </span>
                            <br />
                            <small className="hint" style={{ fontSize: '0.75rem' }}>
                              {new Date(submitted).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </small>
                          </div>
                        ) : (
                          <span className="hint">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: 'var(--brand)' }}>
                        {s.final_score}
                      </td>
                      <td>{app && <StatusBadge status={app.status} />}</td>
                      <td>
                        {app?.status === 'ACCEPTED' ? (
                          <span className="badge badge-verified" style={{ fontWeight: 600 }}>✓ Diterima</span>
                        ) : app?.status === 'WAITLISTED' ? (
                          <span className="badge badge-draft" style={{ fontWeight: 600 }}>⏳ Daftar Tunggu</span>
                        ) : app?.status === 'REJECTED' ? (
                          <span className="badge badge-rejected" style={{ fontWeight: 600 }}>✕ Ditolak</span>
                        ) : (
                          <span className="badge" style={{ opacity: 0.6 }}>Belum Diputuskan</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {app && (
                          <button
                            type="button"
                            className="button secondary"
                            style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                            onClick={() => setSelectedAppForDecision({ app, score: s })}
                            title="Atur status penerimaan calon siswa"
                          >
                            Atur Keputusan →
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada data perankingan"
            description="Isi nilai komponen penilaian pendaftar di menu Penilaian, kemudian klik tombol '⚡ Hitung peringkat' di atas."
          />
        )}
      </section>

      {/* 4. Panel Daftar Tunggu (Cadangan) */}
      <section className="card">
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Daftar Tunggu (Cadangan)</h2>
            <small className="hint">
              Calon siswa cadangan berdasarkan urutan peringkat yang siap dipromosikan ke status Diterima jika kuota tersedia.
            </small>
          </div>
          {waiting.data && waiting.data.length > 0 && (
            <span className="badge badge-draft" style={{ fontSize: '0.8rem' }}>
              {waiting.data.length} Calon Cadangan
            </span>
          )}
        </div>

        {waiting.isPending ? (
          <p className="loading-indicator">Memuat daftar tunggu…</p>
        ) : waiting.data && waiting.data.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80, textAlign: 'center' }}>Antrean</th>
                  <th>Calon Siswa</th>
                  <th style={{ textAlign: 'right' }}>Nilai Akhir</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center' }}>Aksi Promosi</th>
                </tr>
              </thead>
              <tbody>
                {waiting.data.map((w) => (
                  <tr key={w.id}>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-draft" style={{ fontWeight: 700 }}>
                        #{w.position}
                      </span>
                    </td>
                    <td>
                      <strong>{w.applicant_name}</strong>
                      <br />
                      <small className="hint">{w.registration_number ?? 'DRAF'}</small>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{w.score}</td>
                    <td>
                      <span className="badge badge-draft">Menunggu Promosi</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="button"
                        style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                        onClick={() => setSelectedEntryForPromote(w)}
                        title="Promosikan calon siswa ini menjadi DITERIMA"
                      >
                        🚀 Promosikan
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Daftar tunggu kosong"
            description="Saat ini tidak ada calon siswa yang berada di antrean daftar tunggu cadangan untuk gelombang ini."
          />
        )}
      </section>

      {/* Modal Dialog Penetapan Keputusan */}
      {selectedAppForDecision && (
        <DecisionModal
          app={selectedAppForDecision.app}
          score={selectedAppForDecision.score}
          onClose={() => setSelectedAppForDecision(null)}
          onDone={refresh}
        />
      )}

      {/* Modal Dialog Promosi Daftar Tunggu */}
      {selectedEntryForPromote && (
        <PromoteModal
          entry={selectedEntryForPromote}
          onClose={() => setSelectedEntryForPromote(null)}
          onDone={refresh}
        />
      )}
    </>
  )
}
