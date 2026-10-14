import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExportFormatSelect, type ExportFormat } from '../components/ExportFormat'
import { ErrorNote } from '../components/Notice'
import { useAuth } from '../features/auth/AuthContext'
import { api, downloadFile } from '../lib/api'
import { exportUrl } from '../lib/exportUrl'
import { rupiah } from '../lib/money'
import type { AdmissionPeriod, ReportSummary } from '../types/api'

interface TileProps {
  label: string
  value: number | string
  to?: string
}

function Tile({ label, value, to }: TileProps) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <strong className="tile-value">{value}</strong>
      {to && <Link to={to}>Buka</Link>}
    </div>
  )
}

/** Single-series horizontal bars; each value is written next to its bar, so no legend is needed. */
function Funnel({ steps }: { steps: ReportSummary['funnel'] }) {
  const max = Math.max(1, ...steps.map((s) => s.total))
  return (
    <ol className="funnel" aria-label="Funnel pendaftaran">
      {steps.map((s) => (
        <li key={s.key}>
          <span className="funnel-label">{s.label}</span>
          <span className="funnel-track">
            <span className="funnel-bar" style={{ width: `${(s.total / max) * 100}%` }} title={`${s.label}: ${s.total}`} />
          </span>
          <span className="funnel-value">{s.total}</span>
        </li>
      ))}
    </ol>
  )
}

function TopList({ title, rows }: { title: string; rows: ReportSummary['top_schools'] }) {
  return (
    <div>
      <h3>{title}</h3>
      {rows.length === 0 ? <p>Belum ada data.</p> : (
        <table>
          <tbody>{rows.map((r) => <tr key={r.value}><td>{r.value}</td><td className="num">{r.total}</td></tr>)}</tbody>
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

  return (
    <>
      <h1>Dashboard</h1>
      <section className="card row">
        <label className="field">
          <span>Gelombang</span>
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">Semua gelombang</option>
            {periods.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <ExportFormatSelect value={format} onChange={setFormat} />
        {EXPORTS.filter((e) => can(...e.perms)).map((e) => (
          <button key={e.path} className="secondary" onClick={() => download.mutate(e)} disabled={download.isPending}>
            Ekspor {e.label}
          </button>
        ))}
      </section>
      <ErrorNote error={summary.error ?? download.error} />
      {summary.isLoading && <p>Memuat…</p>}
      {s && (
        <>
          <section className="tiles" aria-label="Ringkasan">
            <Tile label="Total pendaftar" value={s.total} />
            <Tile label="Menunggu verifikasi" value={s.work_queue.awaiting_verification} to={can('document.verify', 'application.verify', 'application.override') ? '/verifikasi' : undefined} />
            <Tile label="Perlu revisi" value={s.work_queue.revision_required} />
            <Tile label="Menunggu keputusan" value={s.work_queue.awaiting_decision} to={can('assessment.approve', 'application.override') ? '/seleksi' : undefined} />
            <Tile label="Proses daftar ulang" value={s.work_queue.re_registration_in_progress} />
            <Tile label="Menunggu enrollment" value={s.work_queue.awaiting_enrollment} to={can('enrollment.manage', 'application.override') ? '/siswa' : undefined} />
            {s.finance && (
              <>
                <Tile label="Pembayaran menunggu verifikasi" value={s.finance.pending_payments} to="/keuangan" />
                <Tile label="Tagihan belum lunas" value={s.finance.outstanding_invoices} />
                <Tile label="Pembayaran terverifikasi" value={rupiah(s.finance.verified_amount)} />
              </>
            )}
          </section>

          <section className="card">
            <h2>Funnel Pendaftaran</h2>
            <Funnel steps={s.funnel} />
          </section>

          <section className="card">
            <h2>Kuota per Gelombang</h2>
            {s.periods.length === 0 ? <p>Belum ada gelombang.</p> : (
              <table>
                <thead><tr><th>Gelombang</th><th className="num">Kuota</th><th className="num">Pendaftar</th><th className="num">Diterima</th><th className="num">Sisa kuota</th><th className="num">Enrolled</th></tr></thead>
                <tbody>
                  {s.periods.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}<br /><small>{p.academic_year_name}</small></td>
                      <td className="num">{p.quota ?? '—'}</td>
                      <td className="num">{p.applications}</td>
                      <td className="num">{p.accepted}</td>
                      <td className="num">{p.remaining_quota ?? '—'}</td>
                      <td className="num">{p.enrolled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card grid-2">
            <TopList title="Asal sekolah terbanyak" rows={s.top_schools} />
            <TopList title="Kota/kabupaten terbanyak" rows={s.top_cities} />
          </section>
        </>
      )}
    </>
  )
}
