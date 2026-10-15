import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ExportFormatSelect, type ExportFormat } from '../components/ExportFormat'
import { Field, StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../features/auth/AuthContext'
import { api, downloadFile, fieldErrors } from '../lib/api'
import { exportUrl } from '../lib/exportUrl'
import type { EnrollmentCandidate, StudentPage } from '../types/api'

/**
 * Bagian 1: Calon Siswa Baru yang Siap Dikonfirmasi & Diberikan NIS
 * Hanya muncul bagi calon siswa yang telah lolos seleksi dan melunasi pembayaran daftar ulang.
 */
function Candidates() {
  const qc = useQueryClient()
  const [form, setForm] = useState<{ id: string; name: string; nis: string; notes: string } | null>(null)
  const candidates = useQuery({
    queryKey: ['enrollment-eligible'],
    queryFn: () => api<EnrollmentCandidate[]>('/enrollment/eligible'),
  })
  const enroll = useMutation({
    mutationFn: (f: NonNullable<typeof form>) =>
      api(`/enrollment/applications/${f.id}/enroll`, {
        method: 'POST',
        body: { student_number: f.nis, notes: f.notes || null },
      }),
    onSuccess: async () => {
      setForm(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['enrollment-eligible'] }),
        qc.invalidateQueries({ queryKey: ['students'] }),
      ])
    },
  })
  const errors = fieldErrors(enroll.error)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (form) enroll.mutate(form)
  }

  const candidateList = candidates.data ?? []

  return (
    <section className="card" style={{ margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check-circle" size={18} />
            Calon Siswa Siap Dijadikan Siswa
          </h2>
          <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
            Daftar calon siswa yang telah <strong>lolos seleksi</strong> dan menyelesaikan seluruh <strong>pembayaran daftar ulang</strong>.
          </p>
        </div>
        {candidateList.length > 0 && (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 12,
              background: 'var(--brand-light)',
              color: 'var(--brand-dark)',
              fontWeight: 700,
              fontSize: '0.8rem',
            }}
          >
            {candidateList.length} Menunggu Konfirmasi NIS
          </span>
        )}
      </div>

      {candidates.isLoading && <p className="loading-indicator">Memuat calon siswa baru…</p>}
      {candidates.data && candidateList.length === 0 && (
        <div style={{ padding: '16px 20px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          <p className="hint" style={{ margin: 0 }}>
            Tidak ada calon siswa yang sedang menunggu penetapan NIS. Seluruh calon siswa yang telah menyelesaikan daftar ulang telah berstatus resmi.
          </p>
        </div>
      )}

      {candidateList.length > 0 && (
        <div className="table-wrapper" style={{ marginBottom: 14 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '18%' }}>No. Pendaftaran</th>
                <th style={{ width: '32%' }}>Nama Calon Siswa</th>
                <th style={{ width: '16%' }}>NISN</th>
                <th style={{ width: '20%' }}>Gelombang</th>
                <th style={{ width: '14%', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {candidateList.map((c) => (
                <tr key={c.application_id}>
                  <td>
                    <code style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>
                      {c.registration_number}
                    </code>
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.92rem', display: 'block' }}>{c.applicant_name}</strong>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--success-light)', color: 'var(--success)' }}>
                        Lolos Seleksi
                      </span>
                      <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--brand-light)', color: 'var(--brand-dark)' }}>
                        Biaya Lunas
                      </span>
                    </div>
                  </td>
                  <td>{c.nisn ?? '—'}</td>
                  <td>{c.admission_period_name}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="button"
                      style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={() => {
                        enroll.reset()
                        setForm({ id: c.application_id, name: c.applicant_name, nis: '', notes: '' })
                      }}
                      title="Konfirmasi pendaftar menjadi siswa baru resmi dan masukkan NIS"
                    >
                      <Icon name="check" size={13} /> Jadikan siswa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Konfirmasi & Input NIS Siswa Baru */}
      {form && (
        <form
          onSubmit={submit}
          aria-label="Form enrollment"
          className="card"
          style={{
            padding: 20,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg)',
            border: '2px solid var(--brand)',
            marginTop: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            <div>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', color: 'var(--brand)' }}>
                Enrollment: {form.name}
              </h3>
              <p className="hint" style={{ margin: 0, fontSize: '0.825rem' }}>
                Calon siswa telah menyelesaikan proses seleksi dan pelunasan pembayaran. Masukkan Nomor Induk Siswa (NIS) untuk meresmikan status sebagai Siswa Baru.
              </p>
            </div>
            <button type="button" className="link" onClick={() => setForm(null)} style={{ fontSize: '0.85rem' }}>
              ✕ Batal
            </button>
          </div>

          <div style={{ maxWidth: 450 }}>
            <Field
              label="NIS"
              required
              maxLength={50}
              value={form.nis}
              error={errors.student_number}
              placeholder="Contoh: 2026.001"
              onChange={(e) => setForm({ ...form, nis: e.target.value })}
              autoFocus
            />
          </div>

          <label className="field" style={{ marginTop: 12, maxWidth: 550 }}>
            <span>Catatan Enrollment (opsional)</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Catatan tambahan pendaftaran siswa baru…"
            />
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              type="submit"
              className="button"
              disabled={enroll.isPending || !form.nis.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="check" size={14} /> {enroll.isPending ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setForm(null)}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <ErrorNote error={candidates.error ?? (errors.student_number ? null : enroll.error)} />
    </section>
  )
}

/**
 * Bagian 2: Daftar Siswa Baru yang Telah Resmi Memiliki NIS
 */
function StudentList({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [editing, setEditing] = useState<{ id: string; nis: string; reason: string } | null>(null)

  const query = new URLSearchParams({
    page: String(page),
    per_page: '50',
    ...(search ? { search } : {}),
  })

  const students = useQuery({
    queryKey: ['students', search, page],
    queryFn: () => api<StudentPage>(`/enrollment/students?${query}`),
  })

  const exportFile = useMutation({
    mutationFn: () =>
      downloadFile(
        exportUrl(
          `/enrollment/students/export${search ? `?search=${encodeURIComponent(search)}` : ''}`,
          format
        ),
        `data-siswa-baru.${format}`
      ),
  })

  const update = useMutation({
    mutationFn: (v: NonNullable<typeof editing>) =>
      api(`/enrollment/students/${v.id}`, {
        method: 'PATCH',
        body: { student_number: v.nis, reason: v.reason },
      }),
    onSuccess: async () => {
      setEditing(null)
      await qc.invalidateQueries({ queryKey: ['students'] })
    },
  })

  const meta = students.data?.meta
  const lastPage = meta ? Math.max(1, Math.ceil(meta.total / meta.per_page)) : 1
  const studentItems = students.data?.data ?? []

  return (
    <section className="card" style={{ margin: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="award" size={18} />
            Daftar Siswa Baru Resmi
            {meta && (
              <span className="badge" style={{ marginLeft: 6, fontSize: '0.8rem', verticalAlign: 'middle' }}>
                {meta.total} Siswa
              </span>
            )}
          </h2>
          <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
            Daftar siswa baru resmi yang telah diterbitkan Nomor Induk Siswa (NIS) dan terdaftar aktif di sistem sekolah.
          </p>
        </div>

        {/* Ekspor Data */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExportFormatSelect value={format} onChange={setFormat} />
          <button
            type="button"
            className="button secondary"
            onClick={() => exportFile.mutate()}
            disabled={exportFile.isPending}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="database" size={14} /> {exportFile.isPending ? 'Mengekspor…' : 'Ekspor'}
          </button>
        </div>
      </div>

      {/* Filter Pencarian */}
      <div className="row" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <Field
            label="Cari Siswa Baru"
            value={search}
            placeholder="Cari berdasarkan nama lengkap atau Nomor Induk Siswa (NIS)…"
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {search && (
          <button
            type="button"
            className="button secondary"
            style={{ marginBottom: 2 }}
            onClick={() => {
              setSearch('')
              setPage(1)
            }}
          >
            Reset
          </button>
        )}
      </div>

      {students.isLoading && <p className="loading-indicator">Memuat daftar siswa baru…</p>}
      {students.data && studentItems.length === 0 && (
        <p className="hint">
          {search
            ? 'Tidak ditemukan siswa baru dengan kata kunci pencarian tersebut.'
            : 'Belum ada siswa baru yang resmi terdaftar.'}
        </p>
      )}

      {studentItems.length > 0 && (
        <div className="table-wrapper" style={{ marginBottom: 14 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '16%' }}>NIS</th>
                <th style={{ width: '32%' }}>Nama Siswa Baru</th>
                <th style={{ width: '16%' }}>NISN</th>
                <th style={{ width: '18%' }}>Gelombang</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                {canManage && <th style={{ width: '8%', textAlign: 'right' }}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {studentItems.map((s) => (
                <tr key={s.id}>
                  <td>
                    <code style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--brand)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 4 }}>
                      {s.student_number}
                    </code>
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.92rem', display: 'block' }}>{s.full_name}</strong>
                    <small style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>
                      No. Reg: {s.registration_number}
                    </small>
                  </td>
                  <td>{s.nisn ?? '—'}</td>
                  <td>{s.admission_period_name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <StatusBadge status={s.status} />
                  </td>
                  {canManage && (
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ fontSize: '0.78rem', padding: '3px 8px' }}
                        onClick={() => setEditing({ id: s.id, nis: s.student_number, reason: '' })}
                        title="Koreksi Nomor Induk Siswa"
                      >
                        Koreksi NIS
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lastPage > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '8px 0' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            Halaman {page} dari {lastPage} ({meta?.total} total siswa)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="button secondary"
              style={{ fontSize: '0.85rem' }}
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className="button secondary"
              style={{ fontSize: '0.85rem' }}
              disabled={page >= lastPage}
              onClick={() => setPage(page + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}

      {/* Form Koreksi NIS */}
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            update.mutate(editing)
          }}
          aria-label="Koreksi NIS"
          className="card"
          style={{
            padding: 18,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            marginTop: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--brand)' }}>Formulir Koreksi Nomor Induk Siswa (NIS)</h3>
            <button type="button" className="link" onClick={() => setEditing(null)} style={{ fontSize: '0.85rem' }}>
              ✕ Batal
            </button>
          </div>

          <div style={{ maxWidth: 400 }}>
            <Field
              label="NIS baru"
              required
              value={editing.nis}
              onChange={(e) => setEditing({ ...editing, nis: e.target.value })}
              autoFocus
            />
          </div>

          <label className="field" style={{ marginTop: 10, maxWidth: 550 }}>
            <span>Alasan koreksi *</span>
            <textarea
              required
              rows={2}
              value={editing.reason}
              onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
              placeholder="Alasan perubahan NIS (wajib dicatat pada jejak audit)…"
            />
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              type="submit"
              className="button"
              disabled={update.isPending || !editing.reason.trim()}
            >
              {update.isPending ? 'Menyimpan…' : 'Simpan koreksi'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setEditing(null)}
            >
              Batal
            </button>
          </div>
        </form>
      )}

      <ErrorNote error={students.error ?? update.error ?? exportFile.error} />
    </section>
  )
}

/**
 * Halaman Utama: Siswa Baru (Enrollment)
 */
export function StudentsPage() {
  const { can } = useAuth()
  const canManage = can('enrollment.manage', 'application.override')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Siswa Baru"
        description="Pusat penetapan Nomor Induk Siswa (NIS) dan peresmian calon siswa yang telah lolos seleksi dan menyelesaikan pelunasan daftar ulang."
      />

      {/* Banner Penjelasan Alur Penerimaan Siswa Baru */}
      <div
        className="card"
        style={{
          margin: 0,
          padding: '16px 20px',
          background: 'var(--surface)',
          borderLeft: '4px solid var(--brand)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand)',
            flexShrink: 0,
          }}
        >
          <Icon name="award" size={22} />
        </div>
        <div>
          <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: 2 }}>
            Alur Konfirmasi & Penetapan Siswa Baru
          </strong>
          <span className="hint" style={{ fontSize: '0.85rem', lineHeight: 1.4 }}>
            Calon siswa masuk ke daftar ini secara otomatis setelah <strong>Lolos Seleksi</strong> (Diterima)
            dan menyelesaikan <strong>Pembayaran Daftar Ulang</strong> (Lunas/Dibebaskan). Tim Admission menetapkan NIS untuk
            meresmikan status sebagai Siswa Baru.
          </span>
        </div>
      </div>

      {canManage && <Candidates />}
      <StudentList canManage={canManage} />
    </div>
  )
}
