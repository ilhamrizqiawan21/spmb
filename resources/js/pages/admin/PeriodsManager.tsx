import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { ErrorNote } from '../../components/Notice'
import { api, fieldErrors } from '../../lib/api'
import { fromLocalInput, toLocalInput } from '../../lib/form'

interface AcademicYear {
  id: string
  name: string
  is_active: boolean
}

interface AdmissionPeriodItem {
  id: string
  academic_year_id: string
  name: string
  code: string
  registration_start: string
  registration_end: string
  announcement_at: string | null
  quota: number | null
  is_active: boolean
  settings?: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface PeriodFormValues {
  academic_year_id: string
  name: string
  code: string
  registration_start: string
  registration_end: string
  announcement_at: string
  quota: string
  is_active: boolean
}

function formatDateTimeId(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPeriodTimeStatus(startStr: string, endStr: string, isActive: boolean) {
  if (!isActive) {
    return { label: 'Nonaktif', color: 'var(--muted)', bg: 'var(--bg)', border: 'var(--line)' }
  }
  const now = new Date().getTime()
  const start = new Date(startStr).getTime()
  const end = new Date(endStr).getTime()

  if (now < start) {
    return { label: 'Belum Dibuka', color: 'var(--info)', bg: 'var(--info-light)', border: 'transparent' }
  }
  if (now > end) {
    return { label: 'Telah Ditutup', color: 'var(--muted)', bg: 'var(--bg)', border: 'var(--line)' }
  }
  return { label: 'Sedang Dibuka', color: 'var(--brand-dark)', bg: 'var(--brand-light)', border: 'transparent' }
}

export function PeriodsManager() {
  const qc = useQueryClient()
  const [selectedYearId, setSelectedYearId] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [editing, setEditing] = useState<AdmissionPeriodItem | 'new' | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [clientError, setClientError] = useState<string | null>(null)

  const years = useQuery({
    queryKey: ['admin', '/admission/academic-years'],
    queryFn: () => api<AcademicYear[]>('/admission/academic-years'),
  })

  const periods = useQuery({
    queryKey: ['admin', '/admission/periods'],
    queryFn: () => api<AdmissionPeriodItem[]>('/admission/periods', { auth: false }),
  })

  const yearsMap = new Map((years.data ?? []).map((y) => [y.id, y.name]))
  const activeYear = years.data?.find((y) => y.is_active)

  const [form, setForm] = useState<PeriodFormValues>({
    academic_year_id: '',
    name: '',
    code: '',
    registration_start: '',
    registration_end: '',
    announcement_at: '',
    quota: '',
    is_active: true,
  })

  function openCreate() {
    setErrors({})
    setClientError(null)
    setForm({
      academic_year_id: selectedYearId || activeYear?.id || years.data?.[0]?.id || '',
      name: '',
      code: '',
      registration_start: '',
      registration_end: '',
      announcement_at: '',
      quota: '',
      is_active: true,
    })
    setEditing('new')
  }

  function openEdit(period: AdmissionPeriodItem) {
    setErrors({})
    setClientError(null)
    setForm({
      academic_year_id: period.academic_year_id,
      name: period.name,
      code: period.code,
      registration_start: toLocalInput(period.registration_start),
      registration_end: toLocalInput(period.registration_end),
      announcement_at: toLocalInput(period.announcement_at),
      quota: period.quota != null ? String(period.quota) : '',
      is_active: period.is_active,
    })
    setEditing(period)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const creating = editing === 'new'
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim(),
        registration_start: fromLocalInput(form.registration_start),
        registration_end: fromLocalInput(form.registration_end),
        announcement_at: form.announcement_at ? fromLocalInput(form.announcement_at) : null,
        quota: form.quota ? Number(form.quota) : null,
        is_active: form.is_active,
      }
      if (creating) {
        payload.academic_year_id = form.academic_year_id
        return api<AdmissionPeriodItem>('/admission/periods', { method: 'POST', body: payload })
      } else {
        const id = (editing as AdmissionPeriodItem).id
        return api<AdmissionPeriodItem>(`/admission/periods/${id}`, { method: 'PATCH', body: payload })
      }
    },
    onSuccess: async () => {
      setEditing(null)
      setErrors({})
      setClientError(null)
      await qc.invalidateQueries()
    },
    onError: (e) => setErrors(fieldErrors(e)),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => api(`/admission/periods/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries()
    },
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    setClientError(null)

    // Validasi Tanggal di sisi klien untuk UX yang lebih cepat & jelas
    if (form.registration_start && form.registration_end) {
      const start = new Date(form.registration_start).getTime()
      const end = new Date(form.registration_end).getTime()
      if (start >= end) {
        setClientError('Waktu pembukaan pendaftaran harus sebelum waktu penutupan pendaftaran.')
        return
      }
      if (form.announcement_at) {
        const ann = new Date(form.announcement_at).getTime()
        if (ann < end) {
          setClientError('Waktu pengumuman tidak boleh lebih awal dari waktu penutupan pendaftaran.')
          return
        }
      }
    }

    saveMutation.mutate()
  }

  // Filter Periode
  const filteredPeriods = (periods.data ?? []).filter((p) => {
    if (selectedYearId && p.academic_year_id !== selectedYearId) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchName = p.name.toLowerCase().includes(q)
      const matchCode = p.code.toLowerCase().includes(q)
      if (!matchName && !matchCode) return false
    }
    return true
  })

  return (
    <section className="card" style={{ marginTop: 10 }}>
      {/* Header Bagian Periode Pendaftaran */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar" size={20} />
            Periode Pendaftaran (Gelombang Seleksi)
          </h2>
          <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
            Atur gelombang pendaftaran calon siswa, rentang jadwal buka/tutup, batas kuota penerimaan, serta tanggal pengumuman hasil seleksi.
          </p>
        </div>
        {editing === null && (
          <button type="button" className="button" onClick={openCreate}>
            + Tambah Periode Pendaftaran
          </button>
        )}
      </div>

      {/* Formulir Tambah / Ubah Periode Pendaftaran */}
      {editing !== null && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{
            marginBottom: 20,
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            padding: 20,
            borderRadius: 'var(--radius-md)',
          }}
          aria-label={editing === 'new' ? 'Form Tambah Periode Pendaftaran' : 'Form Ubah Periode Pendaftaran'}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--brand)' }}>
              {editing === 'new' ? 'Tambah Periode Pendaftaran Baru' : `Ubah Periode: ${(editing as AdmissionPeriodItem).name}`}
            </h3>
            <button type="button" className="link" style={{ fontSize: '0.85rem' }} onClick={() => setEditing(null)}>
              Tutup Formulir ✕
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Bagian 1: Identitas Gelombang */}
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>
                1. Identitas Gelombang
              </span>
              <div className="row" style={{ marginTop: 8 }}>
                {editing === 'new' ? (
                  <label className="field" style={{ flex: 1, minWidth: 200 }}>
                    <span>Tahun Ajaran *</span>
                    <select
                      required
                      value={form.academic_year_id}
                      onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                    >
                      <option value="">Pilih Tahun Ajaran…</option>
                      {years.data?.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name} {y.is_active ? '(Aktif)' : ''}
                        </option>
                      ))}
                    </select>
                    {errors.academic_year_id && <small className="error">{errors.academic_year_id}</small>}
                  </label>
                ) : (
                  <div className="field" style={{ flex: 1, minWidth: 200 }}>
                    <span>Tahun Ajaran</span>
                    <div style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: '0.9rem' }}>
                      {yearsMap.get(form.academic_year_id) ?? form.academic_year_id}
                    </div>
                  </div>
                )}

                <div style={{ flex: 2, minWidth: 240 }}>
                  <Field
                    label="Nama Gelombang / Periode"
                    required
                    maxLength={150}
                    value={form.name}
                    placeholder="Contoh: Gelombang 1 - Reguler & Prestasi"
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    error={errors.name}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 160 }}>
                  <Field
                    label="Kode Gelombang"
                    required
                    maxLength={100}
                    value={form.code}
                    placeholder="Contoh: G1-REG"
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    error={errors.code}
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Pengaturan Waktu & Jadwal */}
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 14 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>
                2. Pengaturan Jadwal Pendaftaran & Pengumuman
              </span>
              <div className="row" style={{ marginTop: 8 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Field
                    label="Pendaftaran Dibuka"
                    type="datetime-local"
                    required
                    value={form.registration_start}
                    onChange={(e) => setForm({ ...form, registration_start: e.target.value })}
                    error={errors.registration_start}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Field
                    label="Pendaftaran Ditutup"
                    type="datetime-local"
                    required
                    value={form.registration_end}
                    onChange={(e) => setForm({ ...form, registration_end: e.target.value })}
                    error={errors.registration_end}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Field
                    label="Tanggal Pengumuman Kelulusan"
                    type="datetime-local"
                    value={form.announcement_at}
                    onChange={(e) => setForm({ ...form, announcement_at: e.target.value })}
                    error={errors.announcement_at}
                    hint="Opsional. Waktu tidak boleh lebih awal dari penutupan."
                  />
                </div>
              </div>
            </div>

            {/* Bagian 3: Kuota Penerimaan & Pengaktifan */}
            <div style={{ borderTop: '1px dashed var(--line)', paddingTop: 14 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px' }}>
                3. Kuota Penerimaan & Status
              </span>
              <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Field
                    label="Kuota Maksimal Siswa"
                    type="number"
                    min={1}
                    value={form.quota}
                    placeholder="Kosongkan jika kuota tidak dibatasi"
                    onChange={(e) => setForm({ ...form, quota: e.target.value })}
                    error={errors.quota}
                    hint="Jumlah maksimal calon siswa yang diterima."
                  />
                </div>

                <div style={{ flex: 1, minWidth: 200, marginTop: 10 }}>
                  <label className="check" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    <span style={{ fontWeight: 600 }}>Aktifkan Gelombang Ini</span>
                  </label>
                  <p className="hint" style={{ margin: '4px 0 0 24px', fontSize: '0.8rem' }}>
                    Jika tidak dicentang, gelombang tidak akan muncul bagi calon pendaftar.
                  </p>
                </div>
              </div>
            </div>

            {/* Client / Server Error */}
            {clientError && (
              <p role="alert" className="notice danger" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
                {clientError}
              </p>
            )}
            <ErrorNote error={saveMutation.error} />

            {/* Tombol Aksi Form */}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="submit" className="button" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Menyimpan…' : 'Simpan Periode Pendaftaran'}
              </button>
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>
                Batal
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Toolbar Filter & Pencarian */}
      <div className="row" style={{ alignItems: 'flex-end', gap: 14, marginBottom: 16 }}>
        <label className="field" style={{ flex: 1, minWidth: 220 }}>
          <span style={{ fontWeight: 600 }}>Filter Tahun Ajaran</span>
          <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}>
            <option value="">Semua Tahun Ajaran ({periods.data?.length ?? 0})</option>
            {years.data?.map((y) => {
              const count = (periods.data ?? []).filter((p) => p.academic_year_id === y.id).length
              return (
                <option key={y.id} value={y.id}>
                  {y.name} {y.is_active ? '(Aktif)' : ''} — {count} gelombang
                </option>
              )
            })}
          </select>
        </label>

        <div style={{ flex: 2, minWidth: 260 }}>
          <Field
            label="Cari Periode / Gelombang"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nama periode atau kode gelombang…"
          />
        </div>

        {selectedYearId && (
          <button
            type="button"
            className="button secondary"
            style={{ marginBottom: 2 }}
            onClick={() => setSelectedYearId('')}
          >
            Tampilkan Semua
          </button>
        )}
      </div>

      {periods.isLoading && <p className="loading-indicator">Memuat daftar periode pendaftaran…</p>}

      {periods.data && filteredPeriods.length === 0 && (
        <p className="hint">
          {search || selectedYearId
            ? 'Tidak ditemukan periode pendaftaran yang cocok dengan filter yang dipilih.'
            : 'Belum ada periode pendaftaran. Silakan tambahkan periode pendaftaran baru.'}
        </p>
      )}

      {/* Tabel Daftar Periode Pendaftaran */}
      {filteredPeriods.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Nama Gelombang & Kode</th>
                <th style={{ width: '15%' }}>Tahun Ajaran</th>
                <th style={{ width: '22%' }}>Jadwal Pendaftaran</th>
                <th style={{ width: '15%' }}>Pengumuman</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Kuota</th>
                <th style={{ width: '13%', textAlign: 'center' }}>Status</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredPeriods.map((p) => {
                const status = getPeriodTimeStatus(p.registration_start, p.registration_end, p.is_active)
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <strong style={{ fontSize: '0.92rem' }}>{p.name}</strong>
                        <div>
                          <code
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: 'var(--brand)',
                              background: 'var(--bg)',
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {p.code}
                          </code>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.875rem' }}>
                        {yearsMap.get(p.academic_year_id) ?? p.academic_year_id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                        <div>
                          <strong style={{ color: 'var(--brand)' }}>Buka:</strong> {formatDateTimeId(p.registration_start)}
                        </div>
                        <div style={{ color: 'var(--muted)' }}>
                          <strong>Tutup:</strong> {formatDateTimeId(p.registration_end)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.825rem' }}>
                        {formatDateTimeId(p.announcement_at)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {p.quota != null ? `${p.quota} Siswa` : 'Tak Terbatas'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: status.color,
                            backgroundColor: status.bg,
                            border: `1px solid ${status.border}`,
                          }}
                        >
                          {status.label}
                        </span>
                        {!p.is_active && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>Dinonaktifkan</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => openEdit(p)}
                        >
                          Ubah
                        </button>
                        <button
                          type="button"
                          className="link"
                          style={{ fontSize: '0.8rem', color: 'var(--danger)' }}
                          onClick={() => {
                            if (window.confirm(`Hapus periode pendaftaran "${p.name}"? Data gelombang yang sudah memiliki pendaftar tidak dapat dihapus.`)) {
                              removeMutation.mutate(p.id)
                            }
                          }}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ErrorNote error={periods.error ?? removeMutation.error} />
    </section>
  )
}

