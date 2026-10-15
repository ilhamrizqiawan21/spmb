import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Field } from '../../components/Field'
import { ErrorNote } from '../../components/Notice'
import { api, fieldErrors } from '../../lib/api'
import { fromLocalInput } from '../../lib/form'
import type { MplsEvent, MplsGroup } from '../../types/api'
import { fmtDateTime } from './format'

export function EventsTab({ yearId }: { yearId: string }) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const events = useQuery({ queryKey: ['mpls-events', yearId], queryFn: () => api<MplsEvent[]>(`/mpls/events?academic_year_id=${yearId}`) })
  const groups = useQuery({ queryKey: ['mpls-groups', yearId], queryFn: () => api<MplsGroup[]>(`/mpls/groups?academic_year_id=${yearId}`) })
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/mpls/events', { method: 'POST', body }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['mpls-events'] }),
    onError: (e) => setErrors(fieldErrors(e)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/mpls/events/${id}`, { method: 'DELETE' }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['mpls-events'] }),
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    const form = e.currentTarget
    const f = new FormData(form)
    create.mutate(
      {
        academic_year_id: yearId, group_id: f.get('group_id') || null, title: f.get('title'),
        start_at: fromLocalInput(String(f.get('start_at'))), end_at: fromLocalInput(String(f.get('end_at'))),
        location: f.get('location') || null, is_mandatory: f.get('is_mandatory') === 'on',
      },
      { onSuccess: () => form.reset() },
    )
  }

  return (
    <section className="card">
      <h2>Kegiatan</h2>
      {events.data?.length === 0 && <p>Belum ada kegiatan.</p>}
      {!!events.data?.length && (
        <table>
          <thead><tr><th>Waktu</th><th>Kegiatan</th><th>Untuk</th><th>Tempat</th><th></th></tr></thead>
          <tbody>
            {events.data.map((ev) => (
              <tr key={ev.id}>
                <td>{fmtDateTime(ev.start_at)}<br /><small>s.d. {fmtDateTime(ev.end_at)}</small></td>
                <td>{ev.title}{!ev.is_mandatory && <small> (opsional)</small>}</td>
                <td>{ev.group_name ?? 'Semua kelompok'}</td>
                <td>{ev.location ?? '—'}</td>
                <td><button className="link" onClick={() => remove.mutate(ev.id)}>Hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={onSubmit} className="row" aria-label="Kegiatan baru">
        <Field label="Judul kegiatan" name="title" required maxLength={200} error={errors.title} />
        <label className="field">
          <span>Untuk</span>
          <select name="group_id" defaultValue="">
            <option value="">Semua kelompok</option>
            {groups.data?.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
          </select>
        </label>
        <Field label="Mulai" name="start_at" type="datetime-local" required error={errors.start_at} />
        <Field label="Selesai" name="end_at" type="datetime-local" required error={errors.end_at} />
        <Field label="Tempat" name="location" maxLength={255} />
        <label className="field"><span>Wajib</span><input type="checkbox" name="is_mandatory" defaultChecked /></label>
        <button className="field" disabled={create.isPending}>Tambah kegiatan</button>
      </form>
      <ErrorNote error={events.error ?? remove.error ?? create.error} />
    </section>
  )
}
