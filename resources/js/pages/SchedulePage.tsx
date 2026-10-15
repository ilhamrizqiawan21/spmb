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
        <span className="badge" style={{ fontWeight: 600, fontSize: '0.78rem' }}>
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
                title="Ubah waktu pelaksanaan"
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
          {/* Link Sinkronisasi Langsung ke Input Nilai */}
          <Link
            to={`/penilaian`}
            className="button secondary"
            style={{
              fontSize: '0.78rem',
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 600,
            }}
            title="Buka halaman input nilai seleksi"
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
                title="Tandai calon siswa tidak hadir pada jadwal asesmen"
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
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAddForm, setShowAddForm] = useState(false)

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

  // Komponen seleksi pada gelombang terpilih
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
      qc.invalidateQueries({ queryKey: ['schedules'] }),
      qc.invalidateQueries({ queryKey: ['applications'] }),
    ])
  }

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/selection/schedules', { method: 'POST', body }),
    onSuccess: async () => {
      setShowAddForm(false)
      setErrors({})
      await refreshAll()
    },
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

  // Statistik cepat
  const totalScheduled = currentSchedules.filter((s) => s.status === 'SCHEDULED').length
  const totalNoShow = currentSchedules.filter((s) => s.status === 'NO_SHOW').length
  const totalCancelled = currentSchedules.filter((s) => s.status === 'CANCELLED').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Jadwal Asesmen Seleksi"
        description="Atur jadwal tes akademik, wawancara, dan uji kompetensi bagi calon siswa yang telah lolos verifikasi berkas."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              to="/penilaian"
              className="button secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem' }}
            >
              <Icon name="award" size={15} /> Ke Halaman Penilaian →
            </Link>
            <button
              type="button"
              className="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem' }}
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Icon name={showAddForm ? 'x' : 'calendar'} size={15} />
              {showAddForm ? 'Tutup Formulir' : '+ Buat Jadwal Baru'}
            </button>
          </div>
        }
      />

      {/* Baris Filter Gelombang & Sinkronisasi */}
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
          <label htmlFor="select-period" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            Gelombang:
          </label>
          <select
            id="select-period"
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
            Calon Siswa Siap Ujian: <strong>{eligibleApps.length}</strong>
          </span>
          <span>
            Jadwal Aktif: <strong style={{ color: 'var(--brand)' }}>{totalScheduled}</strong>
          </span>
          {totalNoShow > 0 && (
            <span style={{ color: 'var(--warning)' }}>
              Tidak Hadir: <strong>{totalNoShow}</strong>
            </span>
          )}
          {totalCancelled > 0 && (
            <span style={{ color: 'var(--muted)' }}>
              Dibatalkan: <strong>{totalCancelled}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Form Penjadwalan Asesmen (Dapat dibuka / ditutup) */}
      {showAddForm && (
        <section className="card" style={{ margin: 0, borderTop: '3px solid var(--brand)' }}>
          <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h2 className="card-title" style={{ fontSize: '1.1rem' }}>Formulir Penjadwalan Asesmen</h2>
              <small className="hint">
                Pilih calon siswa dan komponen seleksi yang akan diujikan beserta tanggal dan ruangannya.
              </small>
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="grid-form"
            aria-label="Form jadwal asesmen"
            key={selectedPeriodId}
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
                  Pilih komponen asesmen…
                </option>
                {components.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.weight}%)
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Waktu *</span>
              <input type="datetime-local" name="scheduled_at" required />
              {errors.scheduled_at && <small className="error">{errors.scheduled_at}</small>}
            </label>

            <label className="field">
              <span>Lokasi</span>
              <input name="location" placeholder="e.g. Kampus Utama / Gedung A" />
            </label>

            <label className="field">
              <span>Ruang</span>
              <input name="room" placeholder="e.g. Ruang Wawancara 02" />
            </label>

            <label className="field">
              <span>Catatan</span>
              <input name="notes" placeholder="e.g. Harap membawa kartu ujian fisik" />
            </label>

            <div className="row" style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={create.isPending || unassessedApps.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Icon name="check" size={14} /> {create.isPending ? 'Menyimpan…' : 'Jadwalkan'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowAddForm(false)}
              >
                Batal
              </button>
            </div>

            {Object.keys(errors).length === 0 && <ErrorNote error={create.error} />}
          </form>
        </section>
      )}

      {/* Tabel Daftar Jadwal Asesmen */}
      <section className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Daftar Jadwal Ujian & Asesmen</h2>
            <small className="hint">
              Menampilkan seluruh jadwal seleksi calon siswa yang telah terdaftar pada gelombang ini.
            </small>
          </div>
          <span className="badge badge-verified" style={{ fontWeight: 600 }}>
            {currentSchedules.length} Jadwal Terdaftar
          </span>
        </div>

        {schedules.isPending ? (
          <p className="loading-indicator">Memuat jadwal asesmen…</p>
        ) : currentSchedules.length > 0 ? (
          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Calon Siswa & No. Reg</th>
                  <th style={{ width: '15%' }}>Komponen</th>
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
            title="Belum ada jadwal asesmen"
            description="Belum ada calon siswa yang dijadwalkan untuk tes seleksi pada gelombang ini. Klik tombol '+ Buat Jadwal Baru' di atas untuk mulai membuat jadwal."
          />
        )}
      </section>
    </div>
  )
}
