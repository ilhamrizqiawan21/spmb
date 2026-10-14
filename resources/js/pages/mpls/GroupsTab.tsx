import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Field } from '../../components/Field'
import { ErrorNote } from '../../components/Notice'
import { api, fieldErrors } from '../../lib/api'
import type { MplsGroup, Student } from '../../types/api'

interface Props {
  yearId: string
}

function UnassignedStudents({ yearId, groups }: Props & { groups: MplsGroup[] }) {
  const qc = useQueryClient()
  const [choice, setChoice] = useState<Record<string, string>>({})
  const students = useQuery({
    queryKey: ['mpls-unassigned', yearId],
    queryFn: () => api<Student[]>(`/mpls/participants/unassigned?academic_year_id=${yearId}`),
  })
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['mpls-unassigned'] })
    await qc.invalidateQueries({ queryKey: ['mpls-groups'] })
    await qc.invalidateQueries({ queryKey: ['mpls-participants'] })
  }
  const assign = useMutation({
    mutationFn: (v: { student_id: string; group_id: string }) => api('/mpls/participants', { method: 'POST', body: v }),
    onSuccess: refresh,
  })
  const auto = useMutation({
    mutationFn: () => api<{ assigned: number; unplaced: number }>('/mpls/participants/auto-assign', { method: 'POST', body: { academic_year_id: yearId } }),
    onSuccess: refresh,
  })

  return (
    <section className="card">
      <h2>Siswa Belum Berkelompok {students.data && <small>({students.data.length})</small>}</h2>
      {students.isLoading && <p>Memuat…</p>}
      {students.data?.length === 0 && <p>Semua siswa enrolled sudah berkelompok.</p>}
      {!!students.data?.length && (
        <>
          <p>
            <button onClick={() => { if (window.confirm(`Bagi ${students.data.length} siswa ke kelompok secara merata?`)) auto.mutate() }}
              disabled={auto.isPending || groups.length === 0}>
              Bagi otomatis (merata)
            </button>
          </p>
          <table>
            <thead><tr><th>NIS</th><th>Nama</th><th>Kelompok</th></tr></thead>
            <tbody>
              {students.data.map((s) => (
                <tr key={s.id}>
                  <td>{s.student_number}</td>
                  <td>{s.full_name}</td>
                  <td className="row">
                    <select aria-label={`Kelompok ${s.full_name}`} value={choice[s.id] ?? ''} onChange={(e) => setChoice({ ...choice, [s.id]: e.target.value })}>
                      <option value="">Pilih…</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
                    </select>
                    <button disabled={!choice[s.id] || assign.isPending} onClick={() => assign.mutate({ student_id: s.id, group_id: choice[s.id] })}>Tempatkan</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {auto.data && <p role="status">{auto.data.assigned} siswa ditempatkan{auto.data.unplaced > 0 && `, ${auto.data.unplaced} tidak muat (kapasitas penuh)`}.</p>}
      <ErrorNote error={students.error ?? assign.error ?? auto.error} />
    </section>
  )
}

export function GroupsTab({ yearId }: Props) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const groups = useQuery({ queryKey: ['mpls-groups', yearId], queryFn: () => api<MplsGroup[]>(`/mpls/groups?academic_year_id=${yearId}`) })
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/mpls/groups', { method: 'POST', body }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['mpls-groups'] }),
    onError: (e) => setErrors(fieldErrors(e)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api(`/mpls/groups/${id}`, { method: 'DELETE' }),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ['mpls-groups'] }),
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    const form = e.currentTarget
    const f = new FormData(form)
    const capacity = String(f.get('capacity') ?? '')
    create.mutate(
      {
        academic_year_id: yearId, name: f.get('name'), code: f.get('code'),
        capacity: capacity ? Number(capacity) : null, mentor_name: f.get('mentor_name') || null,
      },
      { onSuccess: () => form.reset() },
    )
  }

  return (
    <>
      <section className="card">
        <h2>Kelompok</h2>
        {groups.data?.length === 0 && <p>Belum ada kelompok untuk tahun ajaran ini.</p>}
        {!!groups.data?.length && (
          <table>
            <thead><tr><th>Kode</th><th>Nama</th><th>Pendamping</th><th className="num">Peserta / Kapasitas</th><th></th></tr></thead>
            <tbody>
              {groups.data.map((g) => (
                <tr key={g.id}>
                  <td>{g.code}</td>
                  <td>{g.name}</td>
                  <td>{g.mentor_name ?? '—'}</td>
                  <td className="num">{g.participant_count} / {g.capacity ?? '∞'}</td>
                  <td>{g.participant_count === 0 && <button className="link" onClick={() => remove.mutate(g.id)}>Hapus</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form onSubmit={onSubmit} className="row" aria-label="Kelompok baru">
          <Field label="Kode" name="code" required maxLength={50} error={errors.code} />
          <Field label="Nama kelompok" name="name" required maxLength={150} error={errors.name} />
          <Field label="Kapasitas" name="capacity" type="number" min={1} error={errors.capacity} />
          <Field label="Pendamping" name="mentor_name" maxLength={200} />
          <button className="field" disabled={create.isPending}>Tambah kelompok</button>
        </form>
        <ErrorNote error={groups.error ?? remove.error ?? create.error} />
      </section>
      <UnassignedStudents yearId={yearId} groups={groups.data ?? []} />
    </>
  )
}
