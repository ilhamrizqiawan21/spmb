import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ErrorNote } from '../../components/Notice'
import { api } from '../../lib/api'
import type { MplsAttendance, MplsAttendanceStatus, MplsEvent, MplsRoster } from '../../types/api'
import { ATTENDANCE_LABELS, fmtDateTime } from './format'

/** Handheld QR scanners type the token and press Enter, so a focused text input is enough. */
function ScanForm({ eventId, onDone }: { eventId: string; onDone: () => Promise<void> }) {
  const [token, setToken] = useState('')
  const scan = useMutation({
    mutationFn: (qr: string) => api<{ attendance: MplsAttendance; already_recorded: boolean }>('/mpls/attendance/scan', { method: 'POST', body: { event_id: eventId, qr_token: qr } }),
    onSuccess: async () => {
      setToken('')
      await onDone()
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (token.trim()) scan.mutate(token.trim())
  }
  return (
    <form onSubmit={submit} className="row" aria-label="Scan QR">
      <label className="field">
        <span>Scan / tempel kode QR</span>
        <input autoFocus value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
      </label>
      <button className="field" disabled={scan.isPending}>Catat hadir</button>
      {scan.data && (
        <p role="status">
          {scan.data.attendance.full_name}: {scan.data.already_recorded ? `sudah tercatat (${ATTENDANCE_LABELS[scan.data.attendance.status]})` : 'hadir'}
        </p>
      )}
      <ErrorNote error={scan.error} />
    </form>
  )
}

export function AttendanceTab({ yearId }: { yearId: string }) {
  const qc = useQueryClient()
  const [eventId, setEventId] = useState('')
  const events = useQuery({ queryKey: ['mpls-events', yearId], queryFn: () => api<MplsEvent[]>(`/mpls/events?academic_year_id=${yearId}`) })
  const roster = useQuery({
    queryKey: ['mpls-roster', eventId],
    enabled: !!eventId,
    queryFn: () => api<MplsRoster>(`/mpls/events/${eventId}/attendance`),
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['mpls-roster', eventId] })
  const record = useMutation({
    mutationFn: (v: { participant_id: string; status: MplsAttendanceStatus }) =>
      api('/mpls/attendance', { method: 'POST', body: { event_id: eventId, ...v } }),
    onSuccess: refresh,
  })
  const rows = roster.data?.rows ?? []
  const recorded = rows.filter((r) => r.attendance).length

  return (
    <section className="card">
      <h2>Presensi</h2>
      <label className="field">
        <span>Kegiatan</span>
        <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Pilih kegiatan…</option>
          {events.data?.map((ev) => <option key={ev.id} value={ev.id}>{fmtDateTime(ev.start_at)} — {ev.title}</option>)}
        </select>
      </label>
      {eventId && <ScanForm eventId={eventId} onDone={refresh} />}
      {roster.isLoading && <p>Memuat…</p>}
      {roster.data && (
        <>
          <p>{recorded} dari {rows.length} peserta sudah tercatat.</p>
          {rows.length === 0 ? <p>Tidak ada peserta untuk kegiatan ini.</p> : (
            <table>
              <thead><tr><th>NIS</th><th>Nama</th><th>Kelompok</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.participant_id}>
                    <td>{r.student_number}</td>
                    <td>{r.full_name}</td>
                    <td>{r.group_name}</td>
                    <td>
                      <select aria-label={`Presensi ${r.full_name}`} value={r.attendance?.status ?? ''} disabled={record.isPending}
                        onChange={(e) => record.mutate({ participant_id: r.participant_id, status: e.target.value as MplsAttendanceStatus })}>
                        <option value="" disabled>Belum dicatat</option>
                        {Object.entries(ATTENDANCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
      <ErrorNote error={events.error ?? roster.error ?? record.error} />
    </section>
  )
}
