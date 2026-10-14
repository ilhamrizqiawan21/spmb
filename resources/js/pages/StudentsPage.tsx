import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Field, StatusBadge } from '../components/Field'
import { ExportFormatSelect, type ExportFormat } from '../components/ExportFormat'
import { ErrorNote } from '../components/Notice'
import { useAuth } from '../features/auth/AuthContext'
import { api, downloadFile, fieldErrors } from '../lib/api'
import { exportUrl } from '../lib/exportUrl'
import type { EnrollmentCandidate, StudentPage } from '../types/api'

/** Applicants that finished re-registration; staff type the NIS to enroll them. */
function Candidates() {
  const qc = useQueryClient()
  const [form, setForm] = useState<{ id: string; name: string; nis: string; notes: string } | null>(null)
  const candidates = useQuery({ queryKey: ['enrollment-eligible'], queryFn: () => api<EnrollmentCandidate[]>('/enrollment/eligible') })
  const enroll = useMutation({
    mutationFn: (f: NonNullable<typeof form>) =>
      api(`/enrollment/applications/${f.id}/enroll`, { method: 'POST', body: { student_number: f.nis, notes: f.notes || null } }),
    onSuccess: async () => {
      setForm(null)
      await qc.invalidateQueries({ queryKey: ['enrollment-eligible'] })
      await qc.invalidateQueries({ queryKey: ['students'] })
    },
  })
  const errors = fieldErrors(enroll.error)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (form) enroll.mutate(form)
  }

  return (
    <section className="card">
      <h2>Siap Dijadikan Siswa</h2>
      {candidates.isLoading && <p>Memuat…</p>}
      {candidates.data?.length === 0 && <p>Tidak ada pendaftar yang menunggu enrollment.</p>}
      {!!candidates.data?.length && (
        <table>
          <thead><tr><th>No. Pendaftaran</th><th>Nama</th><th>NISN</th><th>Gelombang</th><th></th></tr></thead>
          <tbody>
            {candidates.data.map((c) => (
              <tr key={c.application_id}>
                <td>{c.registration_number}</td>
                <td>{c.applicant_name}</td>
                <td>{c.nisn ?? '—'}</td>
                <td>{c.admission_period_name}</td>
                <td>
                  <button onClick={() => { enroll.reset(); setForm({ id: c.application_id, name: c.applicant_name, nis: '', notes: '' }) }}>
                    Jadikan siswa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {form && (
        <form onSubmit={submit} aria-label="Form enrollment">
          <h3>Enrollment: {form.name}</h3>
          <Field label="NIS" required maxLength={50} value={form.nis} error={errors.student_number}
            onChange={(e) => setForm({ ...form, nis: e.target.value })} />
          <label className="field">
            <span>Catatan (opsional)</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <button disabled={enroll.isPending}>Simpan</button>{' '}
          <button type="button" className="secondary" onClick={() => setForm(null)}>Batal</button>
        </form>
      )}
      <ErrorNote error={candidates.error ?? (errors.student_number ? null : enroll.error)} />
    </section>
  )
}

function StudentList({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [editing, setEditing] = useState<{ id: string; nis: string; reason: string } | null>(null)
  const query = new URLSearchParams({ page: String(page), per_page: '50', ...(search ? { search } : {}) })
  const students = useQuery({ queryKey: ['students', search, page], queryFn: () => api<StudentPage>(`/enrollment/students?${query}`) })
  const exportFile = useMutation({
    mutationFn: () => downloadFile(exportUrl(`/enrollment/students/export${search ? `?search=${encodeURIComponent(search)}` : ''}`, format), `data-siswa.${format}`),
  })
  const update = useMutation({
    mutationFn: (v: NonNullable<typeof editing>) => api(`/enrollment/students/${v.id}`, { method: 'PATCH', body: { student_number: v.nis, reason: v.reason } }),
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['students'] })
    },
  })
  const meta = students.data?.meta
  const lastPage = meta ? Math.max(1, Math.ceil(meta.total / meta.per_page)) : 1

  return (
    <section className="card">
      <h2>Daftar Siswa {meta && <small>({meta.total})</small>}</h2>
      <div className="row">
        <Field label="Cari nama / NIS" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        <ExportFormatSelect value={format} onChange={setFormat} />
        <button className="secondary field" onClick={() => exportFile.mutate()} disabled={exportFile.isPending}>Ekspor</button>
      </div>
      {students.isLoading && <p>Memuat…</p>}
      {students.data?.data.length === 0 && <p>Belum ada siswa.</p>}
      {!!students.data?.data.length && (
        <table>
          <thead><tr><th>NIS</th><th>Nama</th><th>NISN</th><th>Gelombang</th><th>Status</th>{canManage && <th></th>}</tr></thead>
          <tbody>
            {students.data.data.map((s) => (
              <tr key={s.id}>
                <td>{s.student_number}</td>
                <td>{s.full_name}<br /><small>{s.registration_number}</small></td>
                <td>{s.nisn ?? '—'}</td>
                <td>{s.admission_period_name}</td>
                <td><StatusBadge status={s.status} /></td>
                {canManage && (
                  <td><button className="link" onClick={() => setEditing({ id: s.id, nis: s.student_number, reason: '' })}>Koreksi NIS</button></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lastPage > 1 && (
        <p>
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>{' '}
          Halaman {page} dari {lastPage}{' '}
          <button className="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>Berikutnya</button>
        </p>
      )}
      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(editing) }} aria-label="Koreksi NIS">
          <Field label="NIS baru" required value={editing.nis} onChange={(e) => setEditing({ ...editing, nis: e.target.value })} />
          <label className="field">
            <span>Alasan koreksi</span>
            <textarea required value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} />
          </label>
          <button disabled={update.isPending}>Simpan koreksi</button>{' '}
          <button type="button" className="secondary" onClick={() => setEditing(null)}>Batal</button>
        </form>
      )}
      <ErrorNote error={students.error ?? update.error ?? exportFile.error} />
    </section>
  )
}

export function StudentsPage() {
  const { can } = useAuth()
  const canManage = can('enrollment.manage', 'application.override')
  return (
    <>
      <h1>Siswa Baru</h1>
      {canManage && <Candidates />}
      <StudentList canManage={canManage} />
    </>
  )
}
