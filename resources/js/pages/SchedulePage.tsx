import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { api, fieldErrors } from '../lib/api'
import { fromLocalInput, toLocalInput } from '../lib/form'
import type { Application, AssessmentSchedule, SelectionComponent } from '../types/api'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })

function ScheduleRow({
  s,
  onChange,
}: {
  s: AssessmentSchedule
  onChange: () => void
}) {
  const [when, setWhen] = useState(toLocalInput(s.scheduled_at))
  const [isEditing, setIsEditing] = useState(false)

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/selection/schedules/${s.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      setIsEditing(false)
      onChange()
    },
  })

  const active = s.status === 'SCHEDULED'

  return (
    <tr>
      <td>
        <strong style={{ display: 'block', fontSize: '0.9rem' }}>{s.applicant_name}</strong>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: 'var(--brand)',
            fontWeight: 600,
          }}
        >
          {s.registration_number}
        </span>
      </td>

      <td>
        <span className="badge badge-verified" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
          {s.component_name}
        </span>
      </td>

      <td style={{ whiteSpace: 'nowrap' }}>
        {active && isEditing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              aria-label={`Waktu ${s.registration_number}`}
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            />
            <button
              type="button"
              className="button secondary"
              style={{ fontSize: '0.78rem', padding: '4px 8px' }}
              disabled={
                !when ||
                fromLocalInput(when) === new Date(s.scheduled_at).toISOString() ||
                patch.isPending
              }
              onClick={() => patch.mutate({ scheduled_at: fromLocalInput(when) })}
            >
              Simpan
            </button>
            <button
              type="button"
              className="button secondary"
              style={{ fontSize: '0.78rem', padding: '4px 8px' }}
              onClick={() => setIsEditing(false)}
            >
              Batal
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{fmt(s.scheduled_at)} WIB</span>
            {active && (
              <button
                type="button"
                className="link"
                style={{ fontSize: '0.75rem', padding: 0 }}
                onClick={() => setIsEditing(true)}
                title="Ubah waktu pelaksanaan tes"
              >
                Ubah
              </button>
            )}
          </div>
        )}
      </td>

      <td>
        <span style={{ fontSize: '0.85rem' }}>
          {[s.location, s.room].filter(Boolean).join(' / ') || '—'}
        </span>
      </td>

      <td>
        <StatusBadge status={s.status} />
      </td>

      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Link
            to="/penilaian"
            className="button secondary"
            style={{
              fontSize: '0.78rem',
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 600,
            }}
            title="Buka halaman penilaian untuk input nilai peserta"
          >
            Input Nilai →
          </Link>

          {active && (
            <>
              <button
                type="button"
                className="button secondary"
                style={{ fontSize: '0.78rem', padding: '4px 8px', color: 'var(--warning)' }}
                onClick={() => patch.mutate({ status: 'NO_SHOW' })}
                disabled={patch.isPending}
                title="Tandai peserta tidak hadir"
              >
                Tidak Hadir
              </button>

              <button
                type="button"
                className="button secondary"
                style={{ fontSize: '0.78rem', padding: '4px 8px', color: 'var(--danger)' }}
                onClick={() =>
                  window.confirm('Batalkan jadwal asesmen untuk calon siswa ini?') &&
                  patch.mutate({ status: 'CANCELLED' })
                }
                disabled={patch.isPending}
                title="Batalkan jadwal ini"
              >
                Batalkan
              </button>
            </>
          )}
        </div>
        <ErrorNote error={patch.error} />
      </td>
    </tr>
  )
}

export function SchedulePage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({})
  const [componentErrors, setComponentErrors] = useState<Record<string, string>>({})
  const [showAddSchedule, setShowAddSchedule] = useState(false)
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [editingComponent, setEditingComponent] = useState<SelectionComponent | null>(null)

  // Query periode gelombang
  const periods = useQuery({
    queryKey: ['periods-all'],
    queryFn: () => api<{ id: string; name: string }[]>('/admission/periods', { auth: false }),
  })

  const periodIdParam = searchParams.get('period_id') || ''
  const selectedPeriodId = periodIdParam || periods.data?.[0]?.id || ''

  function setPeriodId(id: string) {
    setSearchParams({ period_id: id })
  }

  // Komponen seleksi pada gelombang terpilih (fleksibel sesuai kebutuhan sekolah)
  const components = useQuery({
    queryKey: ['components', selectedPeriodId],
    enabled: !!selectedPeriodId,
    queryFn: () =>
      api<SelectionComponent[]>(
        `/selection/components?admission_period_id=${selectedPeriodId}`,
        { auth: false }
      ),
  })

  // Seluruh pendaftar gelombang ini yang siap asesmen
  const apps = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<Application[]>('/admission/applications'),
  })

  const eligibleApps =
    apps.data?.filter(
      (a) =>
        a.admission_period_id === selectedPeriodId &&
        ['VERIFIED', 'ASSESSMENT_SCHEDULED', 'ASSESSED'].includes(a.status)
    ) ?? []

  const unassessedApps = eligibleApps.filter((a) => a.status !== 'ASSESSED')

  // Seluruh jadwal asesmen yang tersimpan
  const schedules = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api<AssessmentSchedule[]>('/selection/schedules'),
  })

  const eligibleIds = new Set(eligibleApps.map((a) => a.id))
  const currentSchedules = schedules.data?.filter((s) => eligibleIds.has(s.application_id)) ?? []

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['components', selectedPeriodId] }),
      qc.invalidateQueries({ queryKey: ['schedules'] }),
      qc.invalidateQueries({ queryKey: ['applications'] }),
    ])
  }

  // Mutasi komponen tes (tambah / ubah / hapus)
  const saveComponent = useMutation({
    mutationFn: async (payload: {
      id?: string
      name: string
      code: string
      weight: number
      max_score: number
      description?: string | null
    }) => {
      if (payload.id) {
        return api(`/selection/components/${payload.id}`, {
          method: 'PATCH',
          body: {
            name: payload.name,
            code: payload.code,
            weight: payload.weight,
            max_score: payload.max_score,
            description: payload.description,
          },
        })
      }
      return api('/selection/components', {
        method: 'POST',
        body: {
          admission_period_id: selectedPeriodId,
          name: payload.name,
          code: payload.code,
          weight: payload.weight,
          max_score: payload.max_score,
          description: payload.description,
        },
      })
    },
    onSuccess: async () => {
      setShowAddComponent(false)
      setEditingComponent(null)
      setComponentErrors({})
      await refreshAll()
    },
    onError: (e) => setComponentErrors(fieldErrors(e)),
  })

  const deleteComponent = useMutation({
    mutationFn: (id: string) => api(`/selection/components/${id}`, { method: 'DELETE' }),
    onSuccess: refreshAll,
  })

  // Mutasi jadwal asesmen
  const createSchedule = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/selection/schedules', { method: 'POST', body }),
    onSuccess: async () => {
      setShowAddSchedule(false)
      setScheduleErrors({})
      await refreshAll()
    },
    onError: (e) => setScheduleErrors(fieldErrors(e)),
  })

  function onSubmitSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setScheduleErrors({})
    const f = new FormData(e.currentTarget)
    const text = (k: string) => String(f.get(k) ?? '') || null
    createSchedule.mutate({
      application_id: f.get('application_id'),
      component_id: f.get('component_id'),
      scheduled_at: fromLocalInput(String(f.get('scheduled_at'))),
      location: text('location'),
      room: text('room'),
      notes: text('notes'),
    })
  }

  function onSubmitComponent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setComponentErrors({})
    const f = new FormData(e.currentTarget)
    saveComponent.mutate({
      id: editingComponent?.id,
      name: String(f.get('name') ?? '').trim(),
      code: String(f.get('code') ?? '').trim().toUpperCase(),
      weight: parseFloat(String(f.get('weight') ?? '0')),
      max_score: parseFloat(String(f.get('max_score') ?? '100')),
      description: String(f.get('description') ?? '').trim() || null,
    })
  }

  // Hitung total bobot komponen yang sudah diset
  const compList = components.data ?? []
  const totalWeight = compList.reduce((acc, c) => acc + parseFloat(c.weight || '0'), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Jadwal Asesmen & Ujian Seleksi"
        description="Pengaturan komponen tes sekolah (Tes Tulis, Baca Qur'an, Wawancara, dll) dan jadwal pelaksanaan ujian bagi calon siswa."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              to={`/penilaian?period_id=${selectedPeriodId}`}
              className="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem' }}
            >
              <Icon name="award" size={15} /> Lanjut ke Menu Penilaian →
            </Link>
          </div>
        }
      />

      {/* Baris Pemilihan Gelombang */}
      <div
        className="card"
        style={{
          margin: 0,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label htmlFor="select-period-sched" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            Gelombang:
          </label>
          <select
            id="select-period-sched"
            value={selectedPeriodId}
            onChange={(e) => setPeriodId(e.target.value)}
            style={{ fontSize: '0.875rem', minWidth: 200 }}
            aria-label="Periode"
          >
            {periods.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem' }}>
          <span>
            Komponen Tes Aktif: <strong>{compList.length}</strong>
          </span>
          <span>
            Total Bobot: <strong style={{ color: totalWeight === 100 ? 'var(--brand)' : 'var(--warning)' }}>{totalWeight}%</strong>
          </span>
          <span>
            Jadwal Terdaftar: <strong>{currentSchedules.length}</strong>
          </span>
        </div>
      </div>

      {/* Bagian 1: Manajemen Komponen Tes Sekolah (Fleksibel & Kosongan/Dapat Diperbarui) */}
      <section className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>1. Komponen Tes & Asesmen Sekolah</h2>
            <small className="hint">
              Tentukan jenis tes yang diadakan sekolah (misal: Tes Tulis, Tes Baca Al-Qur&apos;an, Wawancara, Uji Minat). Tidak mutlak dan dapat disesuaikan kebutuhan.
            </small>
          </div>
          <button
            type="button"
            className="button secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            onClick={() => {
              setEditingComponent(null)
              setShowAddComponent(true)
            }}
          >
            <Icon name="check" size={13} /> + Tambah Komponen Tes
          </button>
        </div>

        {compList.length > 0 ? (
          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Nama Komponen Tes</th>
                  <th style={{ width: '15%' }}>Kode Kolom</th>
                  <th style={{ width: '15%' }}>Bobot Nilai (%)</th>
                  <th style={{ width: '15%' }}>Skor Maksimal</th>
                  <th style={{ width: '20%' }}>Keterangan / Indikator</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {compList.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{ fontSize: '0.9rem' }}>{c.name}</strong>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
                        {c.code}
                      </code>
                    </td>
                    <td>
                      <span className="badge badge-verified" style={{ fontWeight: 600 }}>
                        {c.weight}%
                      </span>
                    </td>
                    <td>{c.max_score} poin</td>
                    <td>
                      <span className="hint" style={{ fontSize: '0.825rem' }}>
                        {c.description || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ fontSize: '0.75rem', padding: '3px 8px', marginRight: 4 }}
                        onClick={() => {
                          setEditingComponent(c)
                          setShowAddComponent(true)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ fontSize: '0.75rem', padding: '3px 8px', color: 'var(--danger)' }}
                        onClick={() => {
                          if (window.confirm(`Hapus komponen "${c.name}"?`)) {
                            deleteComponent.mutate(c.id)
                          }
                        }}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada komponen tes"
            description="Komponen tes seleksi pada gelombang ini masih kosong. Klik '+ Tambah Komponen Tes' di atas untuk membuat jenis tes sesuai kebutuhan sekolah (e.g. Tes Tulis, Tes Baca Qur'an, Wawancara)."
          />
        )}
      </section>

      {/* Bagian 2: Penjadwalan Pelaksanaan Tes & Sesi Asesmen */}
      <section className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>2. Jadwal Pelaksanaan Ujian / Asesmen</h2>
            <small className="hint">
              Atur waktu pelaksanaan, ruang, dan lokasi ujian untuk masing-masing calon siswa.
            </small>
          </div>
          <button
            type="button"
            className="button secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            onClick={() => setShowAddSchedule(!showAddSchedule)}
          >
            <Icon name={showAddSchedule ? 'x' : 'calendar'} size={14} />
            {showAddSchedule ? 'Tutup Formulir' : '+ Buat Jadwal Ujian'}
          </button>
        </div>

        {/* Form Penjadwalan Asesmen */}
        {showAddSchedule && (
          <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: '1rem', marginTop: 0, marginBottom: 12 }}>Formulir Penjadwalan Asesmen</h3>
            <form
              onSubmit={onSubmitSchedule}
              className="grid-form"
              aria-label="Form jadwal asesmen"
              key={selectedPeriodId}
              style={{ background: 'transparent', padding: 0, border: 'none', margin: 0 }}
            >
              <label className="field">
                <span>Pendaftar *</span>
                <select name="application_id" required defaultValue="">
                  <option value="" disabled>
                    Pilih calon siswa…
                  </option>
                  {unassessedApps.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.registration_number} — {a.applicant_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Komponen *</span>
                <select name="component_id" required defaultValue="">
                  <option value="" disabled>
                    Pilih komponen tes…
                  </option>
                  {compList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.weight}%)
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Waktu *</span>
                <input type="datetime-local" name="scheduled_at" required />
                {scheduleErrors.scheduled_at && <small className="error">{scheduleErrors.scheduled_at}</small>}
              </label>

              <label className="field">
                <span>Lokasi</span>
                <input name="location" placeholder="e.g. Kampus Utama / Gedung A" />
              </label>

              <label className="field">
                <span>Ruang</span>
                <input name="room" placeholder="e.g. Ruang Wawancara 02 / Masjid" />
              </label>

              <label className="field">
                <span>Catatan</span>
                <input name="notes" placeholder="e.g. Harap membawa Al-Qur'an dan alat tulis" />
              </label>

              <div className="row" style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="submit"
                  disabled={createSchedule.isPending || unassessedApps.length === 0 || compList.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Icon name="check" size={14} /> {createSchedule.isPending ? 'Menyimpan…' : 'Jadwalkan'}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowAddSchedule(false)}
                >
                  Batal
                </button>
              </div>

              {Object.keys(scheduleErrors).length === 0 && <ErrorNote error={createSchedule.error} />}
            </form>
          </div>
        )}

        {/* Tabel Daftar Jadwal */}
        {currentSchedules.length > 0 ? (
          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Calon Siswa & No. Reg</th>
                  <th style={{ width: '15%' }}>Komponen Tes</th>
                  <th style={{ width: '22%' }}>Waktu Pelaksanaan</th>
                  <th style={{ width: '15%' }}>Lokasi / Ruang</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {currentSchedules.map((s) => (
                  <ScheduleRow
                    key={s.id + s.scheduled_at + s.status}
                    s={s}
                    onChange={refreshAll}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada jadwal ujian terdaftar"
            description="Klik tombol '+ Buat Jadwal Ujian' di atas untuk menjadwalkan tes bagi calon siswa."
          />
        )}
      </section>

      {/* Modal Dialog Tambah / Edit Komponen Tes */}
      {showAddComponent && (
        <div className="modal-overlay" onClick={() => setShowAddComponent(false)} role="presentation">
          <div
            className="modal-window"
            style={{ maxWidth: 540, padding: 24 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-component-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <h3 id="modal-component-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                {editingComponent ? 'Ubah Komponen Tes' : 'Tambah Komponen Tes Baru'}
              </h3>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                onClick={() => setShowAddComponent(false)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <form onSubmit={onSubmitComponent}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="field">
                  <span>Nama Komponen Tes *</span>
                  <input
                    name="name"
                    required
                    defaultValue={editingComponent?.name ?? ''}
                    placeholder="e.g. Tes Tulis, Tes Baca Al-Qur'an, Wawancara"
                    autoFocus
                  />
                  {componentErrors.name && <small className="error">{componentErrors.name}</small>}
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="field">
                    <span>Kode Kolom Excel *</span>
                    <input
                      name="code"
                      required
                      defaultValue={editingComponent?.code ?? ''}
                      placeholder="e.g. BACA_QURAN"
                    />
                    {componentErrors.code && <small className="error">{componentErrors.code}</small>}
                  </label>

                  <label className="field">
                    <span>Bobot Nilai (%) *</span>
                    <input
                      name="weight"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      defaultValue={editingComponent?.weight ?? ''}
                      placeholder="e.g. 30"
                    />
                    {componentErrors.weight && <small className="error">{componentErrors.weight}</small>}
                  </label>
                </div>

                <label className="field">
                  <span>Nilai Maksimal *</span>
                  <input
                    name="max_score"
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    defaultValue={editingComponent?.max_score ?? '100'}
                  />
                  {componentErrors.max_score && <small className="error">{componentErrors.max_score}</small>}
                </label>

                <label className="field">
                  <span>Deskripsi / Petunjuk Pelaksanaan (Opsional)</span>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={editingComponent?.description ?? ''}
                    placeholder="e.g. Penilaian mencakup makhrajul huruf, tajwid, adab, dan kelancaran membaca."
                    style={{ fontFamily: 'inherit', fontSize: '0.875rem' }}
                  />
                </label>

                <ErrorNote error={saveComponent.error} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setShowAddComponent(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="button"
                    disabled={saveComponent.isPending}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="check" size={14} />
                    {saveComponent.isPending ? 'Menyimpan…' : 'Simpan Komponen Tes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
