import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { StatusBadge } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { api, fieldErrors } from '../lib/api'
import { fromLocalInput, toLocalInput } from '../lib/form'
import type { Application, AssessmentSchedule, SelectionComponent } from '../types/api'

const fmt = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

function ScheduleRow({ s, onChange }: { s: AssessmentSchedule; onChange: () => void }) {
  const [when, setWhen] = useState(toLocalInput(s.scheduled_at))
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/selection/schedules/${s.id}`, { method: 'PATCH', body }),
    onSuccess: onChange,
  })
  const active = s.status === 'SCHEDULED'
  return (
    <tr>
      <td>{s.registration_number}<br /><small>{s.applicant_name}</small></td>
      <td>{s.component_name}</td>
      <td>
        {active ? (
          <div className="row">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label={`Waktu ${s.registration_number}`} />
            <button className="secondary" disabled={!when || fromLocalInput(when) === new Date(s.scheduled_at).toISOString() || patch.isPending}
              onClick={() => patch.mutate({ scheduled_at: fromLocalInput(when) })}>Jadwal ulang</button>
          </div>
        ) : fmt(s.scheduled_at)}
      </td>
      <td>{[s.location, s.room].filter(Boolean).join(' / ') || '—'}</td>
      <td><StatusBadge status={s.status} /></td>
      <td>
        {active && (
          <div className="row">
            <button className="danger" onClick={() => window.confirm('Batalkan jadwal ini?') && patch.mutate({ status: 'CANCELLED' })}>Batalkan</button>
            <button className="secondary" onClick={() => patch.mutate({ status: 'NO_SHOW' })}>Tidak hadir</button>
          </div>
        )}
        <ErrorNote error={patch.error} />
      </td>
    </tr>
  )
}

export function ScheduleSection({ periodId, applications, components }: { periodId: string; applications: Application[]; components: SelectionComponent[] }) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const ids = new Set(applications.map((a) => a.id))
  const schedules = useQuery({ queryKey: ['schedules'], queryFn: () => api<AssessmentSchedule[]>('/selection/schedules') })
  const rows = schedules.data?.filter((s) => ids.has(s.application_id)) ?? []

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['schedules'] })
    await qc.invalidateQueries({ queryKey: ['applications'] })
  }
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/selection/schedules', { method: 'POST', body }),
    onSuccess: refresh,
    onError: (e) => setErrors(fieldErrors(e)),
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    const f = new FormData(e.currentTarget)
    const text = (k: string) => String(f.get(k) ?? '') || null
    create.mutate({
      application_id: f.get('application_id'),
      component_id: f.get('component_id'),
      scheduled_at: fromLocalInput(String(f.get('scheduled_at'))),
      location: text('location'),
      room: text('room'),
      notes: text('notes'),
    })
  }

  return (
    <section className="card">
      <h2>Jadwal Asesmen</h2>
      <form onSubmit={onSubmit} className="grid-form" aria-label="Form jadwal asesmen" key={periodId}>
        <label className="field">
          <span>Pendaftar *</span>
          <select name="application_id" required defaultValue="">
            <option value="" disabled>Pilih…</option>
            {applications.map((a) => <option key={a.id} value={a.id}>{a.registration_number} — {a.applicant_name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Komponen *</span>
          <select name="component_id" required defaultValue="">
            <option value="" disabled>Pilih…</option>
            {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Waktu *</span><input type="datetime-local" name="scheduled_at" required />{errors.scheduled_at && <small className="error">{errors.scheduled_at}</small>}</label>
        <label className="field"><span>Lokasi</span><input name="location" /></label>
        <label className="field"><span>Ruang</span><input name="room" /></label>
        <label className="field"><span>Catatan</span><input name="notes" /></label>
        <div className="row"><button disabled={create.isPending || applications.length === 0}>Jadwalkan</button></div>
        {Object.keys(errors).length === 0 && <ErrorNote error={create.error} />}
      </form>

      <table>
        <thead><tr><th>Pendaftar</th><th>Komponen</th><th>Waktu</th><th>Lokasi</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map((s) => <ScheduleRow key={s.id + s.scheduled_at + s.status} s={s} onChange={refresh} />)}</tbody>
      </table>
      {rows.length === 0 && <p>Belum ada jadwal.</p>}
    </section>
  )
}
