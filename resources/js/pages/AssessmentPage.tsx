import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import type { Application, ApplicationScore, AssessmentSchedule, SelectionComponent } from '../types/api'

const ASSESSABLE = ['VERIFIED', 'ASSESSMENT_SCHEDULED', 'ASSESSED']

function ScoreRow({
  app,
  components,
  appSchedules,
}: {
  app: Application
  components: SelectionComponent[]
  appSchedules: AssessmentSchedule[]
}) {
  const qc = useQueryClient()
  const key = ['score', app.id]
  const score = useQuery({
    queryKey: key,
    queryFn: () => api<ApplicationScore>(`/selection/applications/${app.id}/scores`).catch(() => null),
  })

  const [values, setValues] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (v: { componentId: string; score: string }) =>
      api('/selection/assessments/input', {
        method: 'POST',
        body: { application_id: app.id, component_id: v.componentId, score: v.score },
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: key }),
        qc.invalidateQueries({ queryKey: ['applications'] }),
        qc.invalidateQueries({ queryKey: ['schedules'] }),
      ])
    },
  })

  const given = (cid: string) => score.data?.assessments.find((a) => a.component_id === cid)?.score

  // Jadwal asesmen aktif untuk siswa ini
  const activeSchedules = appSchedules.filter(
    (s) => s.application_id === app.id && s.status === 'SCHEDULED'
  )

  return (
    <tr>
      <td style={{ whiteSpace: 'nowrap' }}>
        <strong style={{ display: 'block', fontSize: '0.9rem' }}>{app.applicant_name}</strong>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: 'var(--brand)',
            fontWeight: 600,
          }}
        >
          {app.registration_number}
        </span>
      </td>

      <td>
        <StatusBadge status={app.status} />
      </td>

      {/* Kolom Sinkronisasi Jadwal Asesmen */}
      <td>
        {activeSchedules.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {activeSchedules.map((sch) => (
              <span
                key={sch.id}
                className="badge"
                style={{
                  fontSize: '0.72rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'var(--brand-light)',
                  color: 'var(--brand-dark)',
                  border: '1px solid var(--brand)',
                  width: 'fit-content',
                }}
                title={`${sch.location || ''} ${sch.room || ''}`}
              >
                <Icon name="calendar" size={11} />
                {sch.component_name} (
                {new Date(sch.scheduled_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                })}
                )
              </span>
            ))}
          </div>
        ) : (
          <Link
            to={`/jadwal-asesmen?period_id=${app.admission_period_id}`}
            style={{
              fontSize: '0.75rem',
              color: 'var(--muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
            }}
            title="Calon siswa belum memiliki jadwal asesmen aktif. Klik untuk membuat jadwal."
          >
            <Icon name="clock" size={11} /> Belum ada jadwal
          </Link>
        )}
      </td>

      {/* Input Nilai per Komponen Seleksi */}
      {components.map((c) => (
        <td key={c.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              min={0}
              max={c.max_score}
              step="0.01"
              style={{ width: 85, fontSize: '0.85rem', padding: '4px 6px' }}
              aria-label={`${c.name} ${app.registration_number}`}
              placeholder={given(c.id) ?? '—'}
              value={values[c.id] ?? ''}
              onChange={(e) => setValues({ ...values, [c.id]: e.target.value })}
            />
            <button
              type="button"
              className="button secondary"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              disabled={!values[c.id] || save.isPending}
              onClick={() => save.mutate({ componentId: c.id, score: values[c.id] })}
            >
              Simpan
            </button>
          </div>
        </td>
      ))}

      {/* Nilai Akhir Terhitung */}
      <td style={{ textAlign: 'center' }}>
        <strong
          style={{
            fontSize: '0.95rem',
            color: score.data?.final_score ? 'var(--brand)' : 'var(--muted)',
          }}
        >
          {score.data?.final_score ?? '—'}
        </strong>
        <ErrorNote error={save.error} />
      </td>
    </tr>
  )
}

export function AssessmentPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const periods = useQuery({
    queryKey: ['periods-all'],
    queryFn: () => api<{ id: string; name: string }[]>('/admission/periods', { auth: false }),
  })

  const periodIdParam = searchParams.get('period_id') || ''
  const selectedPeriodId = periodIdParam || periods.data?.[0]?.id || ''

  function setPeriodId(id: string) {
    setSearchParams({ period_id: id })
  }

  const components = useQuery({
    queryKey: ['components', selectedPeriodId],
    enabled: !!selectedPeriodId,
    queryFn: () =>
      api<SelectionComponent[]>(
        `/selection/components?admission_period_id=${selectedPeriodId}`,
        { auth: false }
      ),
  })

  const apps = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<Application[]>('/admission/applications'),
  })

  const schedules = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api<AssessmentSchedule[]>('/selection/schedules'),
  })

  const list =
    apps.data?.filter(
      (a) => a.admission_period_id === selectedPeriodId && ASSESSABLE.includes(a.status)
    ) ?? []

  const assessedCount = list.filter((a) => a.status === 'ASSESSED').length
  const pendingAssessmentCount = list.length - assessedCount

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Penilaian & Skor Seleksi"
        description="Penginputan nilai tes akademik, wawancara, dan kompetensi calon siswa yang telah diverifikasi."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Tombol Sinkronisasi ke Menu Jadwal */}
            <Link
              to={`/jadwal-asesmen?period_id=${selectedPeriodId}`}
              className="button secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem' }}
            >
              <Icon name="calendar" size={15} /> Atur Jadwal Asesmen →
            </Link>
          </div>
        }
      />

      {/* Filter Gelombang & Banner Sinkronisasi */}
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
          <label htmlFor="select-period-eval" style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            Gelombang:
          </label>
          <select
            id="select-period-eval"
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
            Total Calon Siswa: <strong>{list.length}</strong>
          </span>
          <span>
            Selesai Dinilai: <strong style={{ color: 'var(--brand)' }}>{assessedCount}</strong>
          </span>
          <span>
            Belum Lengkap: <strong style={{ color: 'var(--warning)' }}>{pendingAssessmentCount}</strong>
          </span>
        </div>
      </div>

      {/* Tabel Penilaian */}
      <section className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Formulir Nilai Komponen Seleksi</h2>
            <small className="hint">
              Nilai akhir dihitung otomatis berdasarkan pembobotan (Σ Nilai ÷ Nilai Maks × Bobot %). Status berpindah ke <strong>ASSESSED</strong> setelah seluruh komponen terisi.
            </small>
          </div>
        </div>

        {apps.isPending ? (
          <p className="loading-indicator">Memuat data penilaian…</p>
        ) : list.length > 0 ? (
          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Calon Siswa & No. Reg</th>
                  <th style={{ width: '13%' }}>Status</th>
                  <th style={{ width: '17%' }}>Jadwal Asesmen</th>
                  {components.data?.map((c) => (
                    <th key={c.id} style={{ minWidth: 140 }}>
                      {c.name} ({c.weight}%)
                      <div className="hint" style={{ fontSize: '0.68rem', fontWeight: 400 }}>
                        Maks: {c.max_score}
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', width: '12%' }}>Nilai Akhir</th>
                </tr>
              </thead>
              <tbody>
                {components.data &&
                  list.map((a) => (
                    <ScoreRow
                      key={a.id}
                      app={a}
                      components={components.data}
                      appSchedules={schedules.data ?? []}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada pendaftar terverifikasi"
            description="Tidak ada calon siswa yang siap dinilai pada gelombang ini. Calon siswa harus lolos tahap verifikasi berkas terlebih dahulu."
          />
        )}
      </section>
    </div>
  )
}
