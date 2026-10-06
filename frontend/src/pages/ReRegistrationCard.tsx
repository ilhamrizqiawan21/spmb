import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { api, openBlob } from '../lib/api'
import type { AnnouncementDetail, Application, AssessmentSchedule, ReRegistration, ReRegistrationItem } from '../types/api'

const DECIDED = ['ACCEPTED', 'WAITLISTED', 'REJECTED', 'RE_REGISTRATION', 'RE_REGISTRATION_VERIFIED', 'ENROLLED', 'MPLS_ACTIVE', 'MPLS_COMPLETED', 'COMPLETED']
const RE_REG = ['RE_REGISTRATION', 'RE_REGISTRATION_VERIFIED', 'ENROLLED', 'MPLS_ACTIVE', 'MPLS_COMPLETED', 'COMPLETED']

/** Selection result for the parent (after the school publishes it). */
export function ResultCard({ application }: { application: Application }) {
  const result = useQuery({
    queryKey: ['announcement', application.id],
    enabled: DECIDED.includes(application.status),
    queryFn: () => api<AnnouncementDetail>(`/selection/applications/${application.id}/announcement`),
  })
  const letter = useMutation({ mutationFn: () => openBlob(`/selection/applications/${application.id}/announcement/letter`) })
  if (!DECIDED.includes(application.status) || !result.data) return null

  const r = result.data
  return (
    <section className="card">
      <h2>Hasil Seleksi</h2>
      {r.is_published ? (
        <>
          <p className={`decision decision-${r.decision?.toLowerCase()}`}>{r.decision}</p>
          <ul>{r.next_steps?.map((s) => <li key={s}>{s}</li>)}</ul>
          <button className="secondary" onClick={() => letter.mutate()} disabled={letter.isPending}>Unduh surat hasil (PDF)</button>
          <ErrorNote error={letter.error} />
        </>
      ) : <p>{r.message}</p>}
    </section>
  )
}

function ItemRow({ item, editable, onChange }: { item: ReRegistrationItem; editable: boolean; onChange: (done: boolean) => void }) {
  const done = item.status !== 'PENDING'
  return (
    <li>
      <label>
        <input type="checkbox" checked={done} disabled={!editable} onChange={(e) => onChange(e.target.checked)} />{' '}
        {item.requirement_name}{item.is_required && ' *'}
      </label>
      {item.status === 'WAIVED' && <small>(dibebaskan)</small>}
    </li>
  )
}

export function ReRegistrationCard({ application }: { application: Application }) {
  const qc = useQueryClient()
  const key = ['re-registration', application.id]
  const started = RE_REG.includes(application.status)

  const detail = useQuery({
    queryKey: key,
    enabled: started,
    queryFn: () => api<ReRegistration>(`/enrollment/applications/${application.id}/re-registration`),
  })
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: key })
    await qc.invalidateQueries({ queryKey: ['application', application.id] })
  }
  const start = useMutation({ mutationFn: () => api(`/enrollment/applications/${application.id}/start-re-registration`, { method: 'POST' }), onSuccess: refresh })
  const toggle = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => api(`/enrollment/re-registration-items/${v.id}`, { method: 'PATCH', body: { status: v.done ? 'COMPLETED' : 'PENDING' } }),
    onSuccess: refresh,
  })
  const complete = useMutation({ mutationFn: (id: string) => api(`/enrollment/re-registrations/${id}/complete`, { method: 'POST' }), onSuccess: refresh })

  if (application.status === 'ACCEPTED') {
    return (
      <section className="card">
        <h2>Daftar Ulang</h2>
        <p>Selamat, calon siswa diterima. Mulai proses daftar ulang untuk melengkapi persyaratan.</p>
        <button onClick={() => start.mutate()} disabled={start.isPending}>Mulai daftar ulang</button>
        <ErrorNote error={start.error} />
      </section>
    )
  }
  if (!started || !detail.data) return null

  const rr = detail.data
  const open = application.status === 'RE_REGISTRATION' && rr.status !== 'COMPLETED'
  const pendingRequired = rr.items.filter((i) => i.is_required && i.status === 'PENDING').length

  return (
    <section className="card">
      <h2>Daftar Ulang <StatusBadge status={rr.status} /></h2>
      <ul className="list checklist">
        {rr.items.map((i) => <ItemRow key={i.id} item={i} editable={open} onChange={(done) => toggle.mutate({ id: i.id, done })} />)}
      </ul>
      {rr.items.length === 0 && <p>Tidak ada persyaratan daftar ulang untuk periode ini.</p>}
      {open && (
        <p>
          <button onClick={() => complete.mutate(rr.id)} disabled={pendingRequired > 0 || complete.isPending}>Selesaikan daftar ulang</button>
          {pendingRequired > 0 && <small> {pendingRequired} persyaratan wajib (*) belum dipenuhi.</small>}
        </p>
      )}
      <ErrorNote error={toggle.error ?? complete.error} />
      {rr.status === 'COMPLETED' && <p>Daftar ulang selesai. Menunggu proses enrollment oleh sekolah.</p>}
    </section>
  )
}

/** Assessment schedule shown to the parent (hidden when nothing is scheduled). */
export function ScheduleCard({ application }: { application: Application }) {
  const list = useQuery({
    queryKey: ['app-schedules', application.id],
    enabled: ['VERIFIED', 'ASSESSMENT_SCHEDULED', 'ASSESSED'].includes(application.status),
    queryFn: () => api<AssessmentSchedule[]>(`/selection/applications/${application.id}/schedules`),
  })
  if (!list.data || list.data.length === 0) return null
  return (
    <section className="card">
      <h2>Jadwal Asesmen</h2>
      <table>
        <thead><tr><th>Komponen</th><th>Waktu</th><th>Tempat</th><th>Status</th></tr></thead>
        <tbody>
          {list.data.map((s) => (
            <tr key={s.id}>
              <td>{s.component_name}</td>
              <td>{new Date(s.scheduled_at).toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' })}</td>
              <td>{[s.location, s.room].filter(Boolean).join(' / ') || '—'}{s.notes && <><br /><small>{s.notes}</small></>}</td>
              <td><StatusBadge status={s.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
