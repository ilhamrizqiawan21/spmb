import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExportFormatSelect, type ExportFormat } from '../components/ExportFormat'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../features/auth/AuthContext'
import { api, downloadFile } from '../lib/api'
import { exportUrl } from '../lib/exportUrl'
import { rupiah } from '../lib/money'
import type { AdmissionPeriod, ReportSummary } from '../types/api'

interface TileProps {
  label: string
  value: number | string
  sublabel?: string
  to?: string
  color?: string
  bg?: string
  border?: string
}

function MetricTile({ label, value, sublabel, to, color, bg, border }: TileProps) {
  return (
    <div
      className="tile"
      style={{
        background: bg ?? 'var(--card)',
        borderColor: border ?? 'var(--line)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 18px',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span className="tile-label" style={{ fontWeight: 600 }}>{label}</span>
          {to && (
            <Link
              to={to}
              className="button secondary"
              style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', textDecoration: 'none' }}
            >
              Buka
            </Link>
          )}
        </div>
        <strong className="tile-value" style={{ color: color ?? 'inherit', display: 'block', margin: '6px 0 2px' }}>
          {value}
        </strong>
      </div>
      {sublabel && (
        <span className="hint" style={{ fontSize: '0.75rem', marginTop: 4 }}>
          {sublabel}
        </span>
      )}
    </div>
  )
}

/** Single-series horizontal bars with clean relative percentage calculation */
function Funnel({ steps }: { steps: ReportSummary['funnel'] }) {
  const max = Math.max(1, ...steps.map((s) => s.total))
  const first = steps[0]?.total || 1

  return (
    <ol className="funnel" aria-label="Funnel pendaftaran" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {steps.map((s) => {
        const pct = Math.round((s.total / first) * 100)
        return (
          <li key={s.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 12rem) 1fr 6rem', gap: 14, alignItems: 'center' }}>
            <span className="funnel-label" style={{ fontWeight: 600, color: 'var(--fg)', fontSize: '0.875rem' }}>
              {s.label}
            </span>
            <span
              className="funnel-track"
              style={{
                height: 22,
                background: 'var(--bg)',
                borderRadius: 6,
                overflow: 'hidden',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                className="funnel-bar"
                style={{
                  width: `${Math.max(2, (s.total / max) * 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--brand) 0%, var(--brand-hover) 100%)',
                  borderRadius: '0 4px 4px 0',
                  transition: 'width 0.4s ease',
                }}
                title={`${s.label}: ${s.total}`}
              />
            </span>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <span className="funnel-value" style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.total}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>({pct}%)</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function TopList({ title, rows }: { title: string; rows: ReportSummary['top_schools'] }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="hint">Belum ada data pendaftar.</p>
      ) : (
        <table style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '10%' }}>#</th>
              <th>Nama</th>
              <th className="num" style={{ width: '25%' }}>Pendaftar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.value}>
                <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                <td>
                  <strong>{r.value}</strong>
                </td>
                <td className="num">
                  <span className="badge" style={{ fontSize: '0.8rem' }}>
                    {r.total} siswa
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const EXPORTS = [
  { path: '/reports/applications/export', file: 'pendaftar', label: 'Pendaftar', perms: ['application.read', 'application.override'] },
  { path: '/reports/selection/export', file: 'hasil-seleksi', label: 'Hasil seleksi', perms: ['assessment.approve', 'announcement.publish', 'application.override'] },
  { path: '/reports/payments/export', file: 'pembayaran', label: 'Pembayaran', perms: ['payment.read', 'payment.verify', 'application.override'] },
  { path: '/enrollment/students/export', file: 'data-siswa', label: 'Siswa', perms: ['enrollment.manage', 'application.override', 'mpls.manage'] },
]

export function ReportsPage() {
  const { can } = useAuth()
  const [periodId, setPeriodId] = useState('')
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const filter = periodId ? `?admission_period_id=${periodId}` : ''
  const periods = useQuery({ queryKey: ['periods'], queryFn: () => api<AdmissionPeriod[]>('/admission/periods') })
  const summary = useQuery({ queryKey: ['report-summary', periodId], queryFn: () => api<ReportSummary>(`/reports/summary${filter}`) })
  const download = useMutation({ mutationFn: (e: (typeof EXPORTS)[number]) => downloadFile(exportUrl(`${e.path}${filter}`, format), `${e.file}.${format}`) })
  const s = summary.data

  const allowedExports = EXPORTS.filter((e) => can(...e.perms))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Dashboard Ringkasan"
        description="Pusat pemantauan pendaftaran, antrean operasional verifikasi & seleksi, serta rekapitulasi kuota dan keuangan SPMB."
      />

      {/* Card Toolbar: Filter Gelombang & Ekspor Laporan */}
      <section
        className="card"
        style={{
          margin: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flex: 1, minWidth: 240 }}>
          <label className="field" style={{ minWidth: 220 }}>
            <span style={{ fontWeight: 600 }}>Gelombang</span>
            <select
              aria-label="Gelombang"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              style={{ fontSize: '0.9rem' }}
            >
              <option value="">Semua gelombang</option>
              {periods.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {allowedExports.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 130 }}>
              <ExportFormatSelect value={format} onChange={setFormat} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {allowedExports.map((e) => (
                <button
                  key={e.path}
                  type="button"
                  className="button secondary"
                  style={{ fontSize: '0.85rem', padding: '7px 12px' }}
                  onClick={() => download.mutate(e)}
                  disabled={download.isPending}
                >
                  Ekspor {e.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <ErrorNote error={summary.error ?? download.error} />
      {summary.isLoading && <p className="loading-indicator">Memuat ringkasan dashboard…</p>}

      {s && (
        <>
          {/* 1. Metrik Utama & Finansial */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <MetricTile
              label="Total pendaftar"
              value={s.total}
              sublabel="Calon siswa yang telah mendaftar"
              color="var(--brand)"
              border="1px solid var(--brand-light)"
            />

            {s.finance && (
              <>
                <MetricTile
                  label="Pembayaran terverifikasi"
                  value={rupiah(s.finance.verified_amount)}
                  sublabel="Biaya formulir & daftar ulang tervalidasi"
                  color="var(--success)"
                  border="1px solid var(--success-light)"
                />
                <MetricTile
                  label="Tagihan belum lunas"
                  value={s.finance.outstanding_invoices}
                  sublabel="Tagihan yang masih menunggu pembayaran"
                  color={s.finance.outstanding_invoices > 0 ? 'var(--warning)' : undefined}
                />
              </>
            )}
          </div>

          {/* 2. Antrean Operasional & Verifikasi */}
          <section className="card" style={{ margin: 0 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Antrean Tugas Operasional</h2>
              <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
                Tindak lanjuti antrean berkas dan tahapan seleksi yang membutuhkan aksi panitia.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
              <MetricTile
                label="Menunggu verifikasi"
                value={s.work_queue.awaiting_verification}
                sublabel="Berkas siap diverifikasi"
                color={s.work_queue.awaiting_verification > 0 ? 'var(--info)' : undefined}
                to={can('document.verify', 'application.verify', 'application.override') ? '/verifikasi' : undefined}
              />
              <MetricTile
                label="Perlu revisi"
                value={s.work_queue.revision_required}
                sublabel="Menunggu perbaikan orang tua"
                color={s.work_queue.revision_required > 0 ? 'var(--warning)' : undefined}
              />
              <MetricTile
                label="Menunggu keputusan"
                value={s.work_queue.awaiting_decision}
                sublabel="Siap diputuskan kelulusan"
                to={can('assessment.approve', 'application.override') ? '/seleksi' : undefined}
              />
              {s.finance && (
                <MetricTile
                  label="Pembayaran menunggu verifikasi"
                  value={s.finance.pending_payments}
                  sublabel="Bukti transfer masuk"
                  color={s.finance.pending_payments > 0 ? 'var(--brand)' : undefined}
                  to="/keuangan"
                />
              )}
              <MetricTile
                label="Proses daftar ulang"
                value={s.work_queue.re_registration_in_progress}
                sublabel="Siswa lolos mengisi daftar ulang"
              />
              <MetricTile
                label="Menunggu enrollment"
                value={s.work_queue.awaiting_enrollment}
                sublabel="Lunas & siap penetapan NIS"
                color={s.work_queue.awaiting_enrollment > 0 ? 'var(--success)' : undefined}
                to={can('enrollment.manage', 'application.override') ? '/siswa' : undefined}
              />
            </div>
          </section>

          {/* 3. Funnel Pendaftaran */}
          <section className="card" style={{ margin: 0 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Funnel Pendaftaran</h2>
              <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
                Perjalanan calon siswa dari registrasi awal hingga resmi menjadi siswa baru.
              </p>
            </div>
            <Funnel steps={s.funnel} />
          </section>

          {/* 4. Kuota per Gelombang */}
          <section className="card" style={{ margin: 0 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Kuota per Gelombang</h2>
              <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
                Keterisian daya tampung gelombang seleksi aktif.
              </p>
            </div>
            {s.periods.length === 0 ? (
              <p className="hint">Belum ada data gelombang.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Gelombang</th>
                      <th className="num" style={{ width: '14%' }}>Kuota</th>
                      <th className="num" style={{ width: '14%' }}>Pendaftar</th>
                      <th className="num" style={{ width: '14%' }}>Diterima</th>
                      <th className="num" style={{ width: '15%' }}>Sisa Kuota</th>
                      <th className="num" style={{ width: '15%' }}>Enrolled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.periods.map((p) => {
                      const isFull = p.quota != null && (p.remaining_quota ?? 0) <= 0
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong style={{ fontSize: '0.92rem' }}>{p.name}</strong>
                            <br />
                            <small style={{ color: 'var(--muted)' }}>{p.academic_year_name}</small>
                          </td>
                          <td className="num">
                            {p.quota != null ? `${p.quota} siswa` : 'Tak Terbatas'}
                          </td>
                          <td className="num">
                            <strong>{p.applications}</strong>
                          </td>
                          <td className="num">{p.accepted}</td>
                          <td className="num">
                            <span
                              style={{
                                fontWeight: 700,
                                color: isFull ? 'var(--danger)' : 'var(--success)',
                              }}
                            >
                              {p.remaining_quota != null ? (isFull ? 'Penuh' : `${p.remaining_quota} slot`) : 'Tersedia'}
                            </span>
                          </td>
                          <td className="num">
                            <span className="badge" style={{ fontSize: '0.8rem' }}>
                              {p.enrolled} siswa
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 5. Demografi Asal Sekolah & Kota */}
          <section className="card grid-2" style={{ margin: 0 }}>
            <TopList title="Asal Sekolah Terbanyak" rows={s.top_schools} />
            <TopList title="Kota/Kabupaten Terbanyak" rows={s.top_cities} />
          </section>
        </>
      )}
    </div>
  )
}
