import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ExportFormatSelect, type ExportFormat } from '../../components/ExportFormat'
import { Field, StatusBadge } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { ErrorNote } from '../../components/Notice'
import { api, downloadFile, fieldErrors } from '../../lib/api'
import { exportUrl } from '../../lib/exportUrl'
import type { MplsGroup, MplsParticipantPage, Student } from '../../types/api'

interface Props {
  yearId: string
}

/**
 * Siswa baru yang belum ditempatkan ke kelompok MPLS
 */
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

  if (!students.data || students.data.length === 0) {
    return null
  }

  return (
    <div
      className="card"
      style={{
        marginTop: 16,
        padding: 16,
        borderLeft: '4px solid var(--warning)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="alert-triangle" size={18} />
            Calon Siswa Belum Berkelompok ({students.data.length})
          </h3>
          <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
            Calon siswa baru berikut telah resmi diterima dan terdaftar, namun belum ditempatkan ke dalam kelompok MPLS.
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => {
            if (window.confirm(`Bagi ${students.data.length} siswa ke kelompok yang tersedia secara merata?`)) {
              auto.mutate()
            }
          }}
          disabled={auto.isPending || groups.length === 0}
        >
          {auto.isPending ? 'Membagi…' : 'Bagi otomatis (merata)'}
        </button>
      </div>

      <div className="table-wrapper" style={{ maxHeight: 240, overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: '20%' }}>NIS</th>
              <th style={{ width: '45%' }}>Nama Calon Siswa</th>
              <th style={{ width: '35%' }}>Penempatan Kelompok</th>
            </tr>
          </thead>
          <tbody>
            {students.data.map((s) => (
              <tr key={s.id}>
                <td>
                  <code>{s.student_number}</code>
                </td>
                <td>
                  <strong>{s.full_name}</strong>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      aria-label={`Kelompok ${s.full_name}`}
                      value={choice[s.id] ?? ''}
                      onChange={(e) => setChoice({ ...choice, [s.id]: e.target.value })}
                      style={{ fontSize: '0.85rem' }}
                    >
                      <option value="">Pilih kelompok…</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.code} — {g.name} {g.mentor_name ? `(${g.mentor_name})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="button secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      disabled={!choice[s.id] || assign.isPending}
                      onClick={() => assign.mutate({ student_id: s.id, group_id: choice[s.id] })}
                    >
                      Tempatkan
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {auto.data && (
        <p role="status" className="notice success" style={{ marginTop: 10, fontSize: '0.85rem' }}>
          {auto.data.assigned} calon siswa berhasil ditempatkan
          {auto.data.unplaced > 0 && `, ${auto.data.unplaced} tidak muat karena kapasitas penuh`}.
        </p>
      )}
      <ErrorNote error={students.error ?? assign.error ?? auto.error} />
    </div>
  )
}

/**
 * Daftar Calon Siswa Baru MPLS (Peserta) lengkap dengan Kode dan Pendamping
 */
function StudentsListSection({
  yearId,
  groups,
  selectedGroupId,
  onSelectGroup,
}: Props & {
  groups: MplsGroup[]
  selectedGroupId: string
  onSelectGroup: (id: string) => void
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [format, setFormat] = useState<ExportFormat>('xlsx')

  const params = new URLSearchParams({
    academic_year_id: yearId,
    per_page: '200',
    ...(selectedGroupId ? { group_id: selectedGroupId } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  })

  const list = useQuery({
    queryKey: ['mpls-participants', yearId, selectedGroupId, search],
    queryFn: () => api<MplsParticipantPage>(`/mpls/participants?${params}`),
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['mpls-participants'] })
    qc.invalidateQueries({ queryKey: ['mpls-groups'] })
  }

  const complete = useMutation({
    mutationFn: (id: string) => api(`/mpls/participants/${id}/complete`, { method: 'POST', body: {} }),
    onSuccess: refresh,
  })

  const exportFile = useMutation({
    mutationFn: () =>
      downloadFile(
        exportUrl(
          `/mpls/participants/export?academic_year_id=${yearId}${selectedGroupId ? `&group_id=${selectedGroupId}` : ''}`,
          format,
        ),
        `daftar-calon-siswa-mpls.${format}`,
      ),
  })

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
            Daftar Calon Siswa Baru MPLS
            {list.data && (
              <span className="badge" style={{ marginLeft: 8, fontSize: '0.8rem', verticalAlign: 'middle' }}>
                {list.data.meta.total} Siswa
              </span>
            )}
          </h2>
          <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
            {selectedGroup
              ? `Menampilkan calon siswa baru di kelompok ${selectedGroup.code} — ${selectedGroup.name} (Pendamping: ${selectedGroup.mentor_name || '—'})`
              : 'Daftar seluruh calon siswa baru peserta MPLS beserta kode kelompok dan pendamping masing-masing.'}
          </p>
        </div>

        {/* Ekspor Presensi Manual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExportFormatSelect value={format} onChange={setFormat} />
          <button
            type="button"
            className="button secondary"
            onClick={() => exportFile.mutate()}
            disabled={exportFile.isPending}
            title="Unduh daftar calon siswa untuk keperluan presensi panitia secara manual"
          >
            {exportFile.isPending ? 'Mengekspor…' : 'Ekspor Daftar (Manual)'}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="row" style={{ alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
        <label className="field" style={{ flex: 1, minWidth: 200 }}>
          <span>Filter Kelompok</span>
          <select value={selectedGroupId} onChange={(e) => onSelectGroup(e.target.value)}>
            <option value="">Semua Kelompok ({groups.reduce((acc, g) => acc + g.participant_count, 0)})</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.name} ({g.participant_count} siswa)
              </option>
            ))}
          </select>
        </label>

        <div style={{ flex: 2, minWidth: 240 }}>
          <Field
            label="Cari nama calon siswa atau NIS"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik nama calon siswa baru atau nomor induk siswa…"
          />
        </div>

        {selectedGroupId && (
          <button
            type="button"
            className="button secondary"
            style={{ marginBottom: 2 }}
            onClick={() => onSelectGroup('')}
          >
            Tampilkan Semua
          </button>
        )}
      </div>

      {list.isLoading && <p className="loading-indicator">Memuat daftar calon siswa baru…</p>}
      {list.data && list.data.data.length === 0 && (
        <p className="hint">
          {search || selectedGroupId
            ? 'Tidak ditemukan calon siswa baru dengan filter yang dipilih.'
            : 'Belum ada calon siswa baru yang terdaftar pada kelompok MPLS.'}
        </p>
      )}

      {!!list.data?.data.length && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>NIS</th>
                <th style={{ width: '28%' }}>Nama Calon Siswa Baru</th>
                <th style={{ width: '12%' }}>Kode</th>
                <th style={{ width: '20%' }}>Kelompok</th>
                <th style={{ width: '15%' }}>Pendamping</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <code>{p.student_number}</code>
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.92rem' }}>{p.full_name}</strong>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'var(--brand-light)',
                        color: 'var(--brand-dark)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      {p.group_code}
                    </span>
                  </td>
                  <td>{p.group_name}</td>
                  <td>
                    <span style={{ color: p.mentor_name ? 'inherit' : 'var(--muted)', fontStyle: p.mentor_name ? 'normal' : 'italic' }}>
                      {p.mentor_name || 'Belum ada'}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {p.status === 'ACTIVE' && (
                      <button
                        type="button"
                        className="link"
                        style={{ fontSize: '0.8rem' }}
                        onClick={() => {
                          if (window.confirm(`Tandai kegiatan MPLS untuk ${p.full_name} telah selesai?`)) {
                            complete.mutate(p.id)
                          }
                        }}
                      >
                        Selesaikan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ErrorNote error={list.error ?? complete.error ?? exportFile.error} />
    </section>
  )
}

/**
 * Halaman Utama Kelompok MPLS & Calon Siswa Baru
 */
export function GroupsTab({ yearId }: Props) {
  const qc = useQueryClient()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [isAddingGroup, setIsAddingGroup] = useState(false)

  const groups = useQuery({
    queryKey: ['mpls-groups', yearId],
    queryFn: () => api<MplsGroup[]>(`/mpls/groups?academic_year_id=${yearId}`),
  })

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api('/mpls/groups', { method: 'POST', body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mpls-groups'] })
      setIsAddingGroup(false)
    },
    onError: (e) => setErrors(fieldErrors(e)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api(`/mpls/groups/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['mpls-groups'] })
      if (selectedGroupId) setSelectedGroupId('')
    },
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    const form = e.currentTarget
    const f = new FormData(form)
    const capacity = String(f.get('capacity') ?? '')
    create.mutate(
      {
        academic_year_id: yearId,
        name: f.get('name'),
        code: f.get('code'),
        capacity: capacity ? Number(capacity) : null,
        mentor_name: f.get('mentor_name') || null,
      },
      { onSuccess: () => form.reset() },
    )
  }

  const groupItems = groups.data ?? []

  return (
    <>
      {/* 1. List Daftar Kelompok Siswa (Bagian Atas) */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Daftar Kelompok Siswa</h2>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
              Daftar kelompok MPLS, kode kelompok, pendamping, dan kapasitas peserta.
            </p>
          </div>
          <button
            type="button"
            className={isAddingGroup ? 'button secondary' : 'button'}
            onClick={() => setIsAddingGroup(!isAddingGroup)}
          >
            {isAddingGroup ? 'Tutup Formulir' : '+ Tambah Kelompok'}
          </button>
        </div>

        {groups.isLoading && <p className="loading-indicator">Memuat kelompok…</p>}
        {groups.data && groupItems.length === 0 && (
          <p className="hint">Belum ada kelompok MPLS untuk tahun ajaran ini. Silakan tambahkan kelompok baru.</p>
        )}

        {groupItems.length > 0 && (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Kode</th>
                  <th style={{ width: '30%' }}>Nama Kelompok</th>
                  <th style={{ width: '25%' }}>Pendamping</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Peserta / Kapasitas</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {groupItems.map((g) => {
                  const isSelected = selectedGroupId === g.id
                  return (
                    <tr
                      key={g.id}
                      style={{
                        background: isSelected ? 'var(--brand-light)' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedGroupId(isSelected ? '' : g.id)}
                      title="Klik untuk menyaring daftar siswa di bawah"
                    >
                      <td>
                        <strong style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: 'var(--brand)' }}>
                          {g.code}
                        </strong>
                      </td>
                      <td>
                        <strong>{g.name}</strong>
                      </td>
                      <td>
                        <span style={{ color: g.mentor_name ? 'inherit' : 'var(--muted)', fontStyle: g.mentor_name ? 'normal' : 'italic' }}>
                          {g.mentor_name ?? 'Belum ditentukan'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {g.participant_count} / {g.capacity ?? '∞'}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className={isSelected ? 'button secondary' : 'link'}
                          style={{ fontSize: '0.8rem', marginRight: 8 }}
                          onClick={() => setSelectedGroupId(isSelected ? '' : g.id)}
                        >
                          {isSelected ? 'Reset Filter' : 'Lihat Siswa'}
                        </button>
                        {g.participant_count === 0 && (
                          <button
                            type="button"
                            className="link"
                            style={{ fontSize: '0.8rem', color: 'var(--danger)' }}
                            onClick={() => {
                              if (window.confirm(`Hapus kelompok ${g.name}?`)) {
                                remove.mutate(g.id)
                              }
                            }}
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Form Tambah Kelompok Baru */}
        {isAddingGroup && (
          <form
            onSubmit={onSubmit}
            className="card"
            style={{
              marginTop: 16,
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              padding: 16,
            }}
            aria-label="Kelompok baru"
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Formulir Kelompok Baru</h3>
            <div className="row">
              <Field label="Kode Kelompok" name="code" required maxLength={50} placeholder="Contoh: A, K01" error={errors.code} />
              <Field label="Nama Kelompok" name="name" required maxLength={150} placeholder="Contoh: Kelompok Umar bin Khattab" error={errors.name} />
              <Field label="Kapasitas Maksimal" name="capacity" type="number" min={1} placeholder="Kosongkan jika tak terbatas" error={errors.capacity} />
              <Field label="Nama Pendamping" name="mentor_name" maxLength={200} placeholder="Nama guru / panitia pendamping" />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" className="button" disabled={create.isPending}>
                {create.isPending ? 'Menyimpan…' : 'Simpan Kelompok'}
              </button>
              <button type="button" className="button secondary" onClick={() => setIsAddingGroup(false)}>
                Batal
              </button>
            </div>
          </form>
        )}

        <ErrorNote error={groups.error ?? remove.error ?? create.error} />
      </section>

      {/* Bagian Calon Siswa Baru Belum Masuk Kelompok */}
      <UnassignedStudents yearId={yearId} groups={groupItems} />

      {/* 2. List Daftar Calon Siswa Baru Lengkap dengan Kode & Pendamping (Bagian Bawah) */}
      <StudentsListSection
        yearId={yearId}
        groups={groupItems}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
      />
    </>
  )
}

