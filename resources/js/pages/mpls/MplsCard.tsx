import { useQuery } from '@tanstack/react-query'
import { ErrorNote } from '../../components/Notice'
import { api } from '../../lib/api'
import type { Application, MplsPortal } from '../../types/api'
import { ATTENDANCE_LABELS, fmtDateTime } from './format'
import { QrImage } from './QrImage'

const IN_MPLS = ['MPLS_ACTIVE', 'MPLS_COMPLETED', 'COMPLETED']

/** MPLS information in the parent portal: group, mentor, QR for attendance, schedule. */
export function MplsCard({ application }: { application: Application }) {
  const info = useQuery({
    queryKey: ['app-mpls', application.id],
    enabled: IN_MPLS.includes(application.status),
    queryFn: () => api<{ data: MplsPortal | null }>(`/mpls/applications/${application.id}`),
  })
  const d = info.data?.data
  if (info.error) return <ErrorNote error={info.error} />
  if (!d) return null
  const p = d.participant

  return (
    <section className="card">
      <h2>MPLS</h2>
      {p.status === 'COMPLETED' ? <p>MPLS telah selesai. Selamat bergabung!</p> : (
        <>
          <p>Tunjukkan kode QR ini kepada petugas saat presensi kegiatan MPLS.</p>
          {p.qr_token && <QrImage value={p.qr_token} label="Kode QR presensi MPLS" />}
        </>
      )}
      <dl className="details">
        <dt>Kelompok</dt><dd>{p.group_code} — {p.group_name}</dd>
        <dt>Pendamping</dt><dd>{p.mentor_name ?? '—'}</dd>
        <dt>Kehadiran</dt><dd>{p.attendance.present} hadir, {p.attendance.sick} sakit, {p.attendance.permitted} izin, {p.attendance.absent} alpa</dd>
      </dl>
      <h3>Jadwal</h3>
      {d.events.length === 0 ? <p>Jadwal kegiatan belum diumumkan.</p> : (
        <ul className="list">
          {d.events.map((e) => (
            <li key={e.id}>
              <span>{fmtDateTime(e.start_at)}</span>
              <strong>{e.title}</strong>
              {e.location && <small>{e.location}</small>}
              {e.attendance_status && <small>({ATTENDANCE_LABELS[e.attendance_status]})</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
