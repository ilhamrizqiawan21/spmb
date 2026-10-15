import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, type ChangeEvent, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { api, fieldErrors } from '../lib/api'
import { fromLocalInput } from '../lib/form'
import {
  generateAssessmentTemplate,
  parseAssessmentCsv,
  type ParseResult,
} from '../lib/assessmentCsv'
import type { Application, ApplicationScore, AssessmentSchedule, SelectionComponent } from '../types/api'

const ASSESSABLE = ['VERIFIED', 'ASSESSMENT_SCHEDULED', 'ASSESSED']

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })

function ScoreRow({
  app,
  components,
  schedules,
  onScoreSaved,
  onScheduleStudent,
}: {
  app: Application
  components: SelectionComponent[]
  schedules: AssessmentSchedule[]
  onScoreSaved: (appId: string, scores: Record<string, string>) => void
  onScheduleStudent: (app: Application) => void
}) {
  const qc = useQueryClient()
  const key = ['score', app.id]
  const score = useQuery({
    queryKey: key,
    queryFn: () =>
      api<ApplicationScore>(`/selection/applications/${app.id}/scores`).catch(() => null),
  })

  const [values, setValues] = useState<Record<string, string>>({})

  const save = useMutation({
    mutationFn: (v: { componentId: string; score: string }) =>
      api('/selection/assessments/input', {
        method: 'POST',
        body: { application_id: app.id, component_id: v.componentId, score: v.score },
      }),
    onSuccess: async (_, variables) => {
      onScoreSaved(app.id, { [variables.componentId]: variables.score })
      await Promise.all([
        qc.invalidateQueries({ queryKey: key }),
        qc.invalidateQueries({ queryKey: ['applications'] }),
      ])
    },
  })

  const patchSchedule = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/selection/schedules/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedules'] }),
  })

  const given = (cid: string) => score.data?.assessments.find((a) => a.component_id === cid)?.score

  return (
    <tr>
      {/* 1. Calon Siswa & No Registrasi */}
      <td style={{ whiteSpace: 'nowrap' }}>
        <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--fg)' }}>
          {app.applicant_name}
        </strong>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: 'var(--brand)',
            fontWeight: 600,
          }}
        >
          {app.registration_number ?? 'DRAF'}
        </span>
      </td>

      {/* 2. Status Berkas */}
      <td>
        <StatusBadge status={app.status} />
      </td>

      {/* 3. Jadwal Tes Siswa & Kehadiran */}
      <td style={{ fontSize: '0.825rem' }}>
        {schedules.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {schedules.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--bg)',
                  fontSize: '0.75rem',
                }}
              >
                <span>
                  <strong>{s.component_name}</strong>: {fmtDate(s.scheduled_at)}{' '}
                  {s.room && <span className="hint">({s.room})</span>}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <StatusBadge status={s.status} />
                  {s.status === 'SCHEDULED' && (
                    <button
                      type="button"
                      className="link"
                      style={{ fontSize: '0.7rem', color: 'var(--warning)', padding: 0 }}
                      onClick={() => patchSchedule.mutate({ id: s.id, status: 'NO_SHOW' })}
                      title="Tandai tidak hadir"
                    >
                      Absen
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="link"
              style={{ fontSize: '0.725rem', padding: 0, textAlign: 'left', marginTop: 2 }}
              onClick={() => onScheduleStudent(app)}
            >
              + Tambah / Atur Jadwal
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="button secondary"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            onClick={() => onScheduleStudent(app)}
          >
            + Jadwalkan Tes
          </button>
        )}
      </td>

      {/* 4. Input Nilai per Komponen Seleksi Sekolah */}
      {components.map((c) => (
        <td key={c.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              min={0}
              max={c.max_score}
              step="0.01"
              style={{
                width: 85,
                fontSize: '0.85rem',
                padding: '4px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line)',
              }}
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
              title="Simpan nilai komponen ini"
            >
              Simpan
            </button>
          </div>
        </td>
      ))}

      {/* 5. Nilai Akhir Terhitung */}
      <td style={{ textAlign: 'center' }}>
        <strong
          style={{
            fontSize: '1rem',
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
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // State untuk modal impor excel
  const [showImportModal, setShowImportModal] = useState(false)
  const [parsedImport, setParsedImport] = useState<ParseResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(
    null
  )
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  // State untuk modal penjadwalan siswa
  const [schedulingStudent, setSchedulingStudent] = useState<Application | null>(null)
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({})

  // State pencarian siswa
  const [searchQuery, setSearchQuery] = useState('')

  // State lokal cache skor yang terisi (untuk dimasukkan saat download template jika ada)
  const [loadedScores, setLoadedScores] = useState<Record<string, Record<string, string>>>({})

  const periods = useQuery({
    queryKey: ['periods-all'],
    queryFn: () => api<{ id: string; name: string }[]>('/admission/periods', { auth: false }),
  })

  const periodIdParam = searchParams.get('period_id') || ''
  const selectedPeriodId = periodIdParam || periods.data?.[0]?.id || ''

  function setPeriodId(id: string) {
    setSearchParams({ period_id: id })
  }

  const selectedPeriodName =
    periods.data?.find((p) => p.id === selectedPeriodId)?.name || 'Gelombang'

  // Komponen tes pada gelombang ini
  const components = useQuery({
    queryKey: ['components', selectedPeriodId],
    enabled: !!selectedPeriodId,
    queryFn: () =>
      api<SelectionComponent[]>(
        `/selection/components?admission_period_id=${selectedPeriodId}`,
        { auth: false }
      ),
  })

  // Seluruh pendaftar gelombang ini yang siap dinilai
  const apps = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<Application[]>('/admission/applications'),
  })

  // Seluruh jadwal asesmen siswa
  const schedules = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api<AssessmentSchedule[]>('/selection/schedules'),
  })

  const list =
    apps.data?.filter(
      (a) => a.admission_period_id === selectedPeriodId && ASSESSABLE.includes(a.status)
    ) ?? []

  const filteredList = list.filter((a) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      a.applicant_name.toLowerCase().includes(q) ||
      (a.registration_number && a.registration_number.toLowerCase().includes(q))
    )
  })

  // Peta jadwal per aplikasi
  const schedulesByApp = new Map<string, AssessmentSchedule[]>()
  schedules.data?.forEach((s) => {
    const existing = schedulesByApp.get(s.application_id) || []
    existing.push(s)
    schedulesByApp.set(s.application_id, existing)
  })

  const scheduledCount = list.filter((a) => (schedulesByApp.get(a.id)?.length ?? 0) > 0).length
  const assessedCount = list.filter((a) => a.status === 'ASSESSED').length
  const pendingAssessmentCount = list.length - assessedCount
  const compList = components.data ?? []

  function handleScoreSaved(appId: string, newScores: Record<string, string>) {
    setLoadedScores((prev) => ({
      ...prev,
      [appId]: { ...(prev[appId] || {}), ...newScores },
    }))
  }

  // Mutasi membuat jadwal ujian siswa
  const createSchedule = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api('/selection/schedules', { method: 'POST', body }),
    onSuccess: async () => {
      setSchedulingStudent(null)
      setScheduleErrors({})
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['schedules'] }),
        qc.invalidateQueries({ queryKey: ['applications'] }),
      ])
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

  // 1. Fungsi Unduh Format Impor Excel / CSV
  function handleDownloadTemplate() {
    if (compList.length === 0) {
      alert(
        'Belum ada komponen tes yang dibuat pada gelombang ini. Silakan buat komponen tes terlebih dahulu di menu Jadwal Asesmen.'
      )
      return
    }

    const csvContent = generateAssessmentTemplate(list, compList, loadedScores)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeName = selectedPeriodName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    a.href = url
    a.download = `format_impor_nilai_${safeName}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 2. Fungsi Membaca File yang Diunggah
  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFeedback(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        const result = parseAssessmentCsv(content, list, compList)
        setParsedImport(result)
      }
    }
    reader.readAsText(file)
  }

  // 3. Fungsi Menjalankan Impor Nilai ke Backend
  async function handleExecuteImport() {
    if (!parsedImport || parsedImport.rows.length === 0) return

    setIsImporting(true)
    setImportFeedback(null)
    const total = parsedImport.totalScoresToInput
    let current = 0
    let successCount = 0
    let failCount = 0

    setImportProgress({ current: 0, total })

    try {
      for (const row of parsedImport.rows) {
        for (const [componentId, scoreVal] of Object.entries(row.scores)) {
          try {
            await api('/selection/assessments/input', {
              method: 'POST',
              body: {
                application_id: row.applicationId,
                component_id: componentId,
                score: scoreVal,
              },
            })
            successCount++
          } catch {
            failCount++
          }
          current++
          setImportProgress({ current, total })
        }
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['applications'] }),
        qc.invalidateQueries({ queryKey: ['scores'] }),
      ])

      setImportFeedback({
        type: 'success',
        message: `Impor nilai selesai: Berhasil menyimpan ${successCount} nilai${
          failCount > 0 ? `, gagal ${failCount}` : ''
        }.`,
      })
      setShowImportModal(false)
      setParsedImport(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      setImportFeedback({
        type: 'error',
        message: 'Terjadi kesalahan saat memproses impor nilai. Periksa koneksi Anda.',
      })
    } finally {
      setIsImporting(false)
      setImportProgress(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Penilaian & Peserta Seleksi"
        description="Fokus pada pengelolaan calon siswa yang mengikuti tes, penugasan sesi jadwal ujian, unduh format Excel, impor nilai massal, dan penilaian."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Tombol Unduh Format Impor Excel */}
            <button
              type="button"
              className="button secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
              onClick={handleDownloadTemplate}
              title="Unduh file format template spreadsheet Excel (.csv) yang sudah berisi daftar nomor pendaftaran calon siswa"
            >
              <Icon name="database" size={14} /> Unduh Format Impor Excel
            </button>

            {/* Tombol Buka Modal Impor Nilai */}
            <button
              type="button"
              className="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
              onClick={() => {
                setParsedImport(null)
                setImportFeedback(null)
                setShowImportModal(true)
              }}
              title="Unggah file spreadsheet Excel / CSV yang telah diisi nilai siswa"
            >
              <Icon name="rocket" size={14} /> Impor Nilai dari Excel
            </button>

            {/* Tombol ke Jadwal Asesmen */}
            <Link
              to={`/jadwal-asesmen?period_id=${selectedPeriodId}`}
              className="button secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            >
              <Icon name="calendar" size={14} /> Master Komponen Tes →
            </Link>
          </div>
        }
      />

      {/* Banner Feedback Impor */}
      {importFeedback && (
        <div
          className="card"
          style={{
            margin: 0,
            padding: '12px 16px',
            borderColor: importFeedback.type === 'success' ? 'var(--brand)' : 'var(--danger)',
            background: importFeedback.type === 'success' ? 'var(--brand-light)' : 'var(--danger-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          role="status"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon
              name={importFeedback.type === 'success' ? 'check-circle' : 'x-circle'}
              size={18}
            />
            <strong>{importFeedback.message}</strong>
          </div>
          <button
            type="button"
            className="link"
            style={{ fontSize: '0.85rem' }}
            onClick={() => setImportFeedback(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {/* Filter Gelombang & KPI Status Siswa Mengikuti Tes */}
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

        <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', flexWrap: 'wrap' }}>
          <span>
            Siswa Mengikuti Tes: <strong>{list.length} Orang</strong>
          </span>
          <span>
            Terjadwal: <strong style={{ color: 'var(--brand)' }}>{scheduledCount}</strong>
          </span>
          <span>
            Selesai Dinilai: <strong style={{ color: 'var(--brand)' }}>{assessedCount}</strong>
          </span>
          <span>
            Belum Lengkap: <strong style={{ color: 'var(--warning)' }}>{pendingAssessmentCount}</strong>
          </span>
        </div>
      </div>

      {/* Tabel Siswa yang Mengikuti Tes & Input Penilaian */}
      <section className="card" style={{ margin: 0 }}>
        <div
          className="card-header between"
          style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}
        >
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Daftar Siswa Peserta Tes & Input Nilai</h2>
            <small className="hint">
              Kelola status kehadiran / jadwal ujian siswa dan input nilai tiap komponen seleksi.
            </small>
          </div>

          {/* Form Pencarian Cepat */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="search"
              placeholder="Cari siswa / no. reg…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '5px 10px', minWidth: 200 }}
              aria-label="Cari siswa"
            />
            <span className="badge badge-verified" style={{ fontWeight: 600 }}>
              {compList.length} Komponen Tes
            </span>
          </div>
        </div>

        {compList.length === 0 ? (
          <EmptyState
            title="Belum ada komponen tes seleksi"
            description="Sekolah belum mengatur komponen tes (seperti Tes Tulis, Tes Baca Al-Qur'an, dll) untuk gelombang ini. Buka menu 'Master Komponen Tes' untuk membuat komponen tes terlebih dahulu."
          />
        ) : apps.isPending ? (
          <p className="loading-indicator">Memuat data pendaftar & nilai…</p>
        ) : filteredList.length > 0 ? (
          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Calon Siswa & No. Reg</th>
                  <th style={{ width: '12%' }}>Status Berkas</th>
                  <th style={{ width: '22%' }}>Jadwal / Kehadiran Tes</th>
                  {compList.map((c) => (
                    <th key={c.id} style={{ minWidth: 140 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{c.name}</span>
                        <small className="hint" style={{ fontSize: '0.7rem', fontWeight: 500 }}>
                          Bobot: {c.weight}% • Maks: {c.max_score}
                        </small>
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', width: '10%' }}>Nilai Akhir</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((a) => (
                  <ScoreRow
                    key={a.id}
                    app={a}
                    components={compList}
                    schedules={schedulesByApp.get(a.id) ?? []}
                    onScoreSaved={handleScoreSaved}
                    onScheduleStudent={(student) => {
                      setSchedulingStudent(student)
                      setScheduleErrors({})
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Tidak ada calon siswa ditemukan"
            description={
              searchQuery
                ? `Tidak ada siswa yang cocok dengan pencarian "${searchQuery}".`
                : 'Tidak ada calon siswa pada gelombang ini yang siap mengikuti tes seleksi.'
            }
          />
        )}
      </section>

      {/* Modal Dialog Penjadwalan Siswa ke Tes */}
      {schedulingStudent && (
        <div
          className="modal-overlay"
          onClick={() => setSchedulingStudent(null)}
          role="presentation"
        >
          <div
            className="modal-window"
            style={{ maxWidth: 520, padding: 24 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-sched-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 id="modal-sched-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                  Atur Jadwal Tes Siswa
                </h3>
                <small className="hint">
                  {schedulingStudent.applicant_name} ({schedulingStudent.registration_number})
                </small>
              </div>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                onClick={() => setSchedulingStudent(null)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <form onSubmit={onSubmitSchedule}>
              <input type="hidden" name="application_id" value={schedulingStudent.id} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label className="field">
                  <span>Komponen Tes yang Diikuti *</span>
                  <select name="component_id" required defaultValue="">
                    <option value="" disabled>Pilih komponen tes…</option>
                    {compList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.weight}%)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Waktu Pelaksanaan *</span>
                  <input type="datetime-local" name="scheduled_at" required />
                  {scheduleErrors.scheduled_at && <small className="error">{scheduleErrors.scheduled_at}</small>}
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="field">
                    <span>Lokasi</span>
                    <input name="location" placeholder="e.g. Gedung Utama" />
                  </label>
                  <label className="field">
                    <span>Ruang</span>
                    <input name="room" placeholder="e.g. Lab Komputer 1 / Masjid" />
                  </label>
                </div>

                <label className="field">
                  <span>Catatan Khusus</span>
                  <input name="notes" placeholder="e.g. Membawa mushaf Al-Qur'an dan pensil" />
                </label>

                <ErrorNote error={createSchedule.error} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setSchedulingStudent(null)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="button"
                    disabled={createSchedule.isPending}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="check" size={14} />
                    {createSchedule.isPending ? 'Menyimpan…' : 'Simpan Jadwal Siswa'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog Impor Nilai dari File Excel/CSV */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => !isImporting && setShowImportModal(false)} role="presentation">
          <div
            className="modal-window"
            style={{ maxWidth: 650, padding: 24 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-import-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 id="modal-import-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                  Impor Nilai Peserta dari Excel / CSV
                </h3>
                <small className="hint">
                  {selectedPeriodName} • {list.length} Siswa Terdaftar
                </small>
              </div>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* Langkah 1: Petunjuk & Tombol Template */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                fontSize: '0.85rem',
                marginBottom: 16,
              }}
            >
              <strong style={{ display: 'block', marginBottom: 4 }}>Petunjuk Pengisian:</strong>
              <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5, color: 'var(--muted)' }}>
                <li>
                  Gunakan format resmi dengan mengklik tombol{' '}
                  <button
                    type="button"
                    className="link"
                    style={{ fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
                    onClick={handleDownloadTemplate}
                  >
                    Unduh Format Excel
                  </button>.
                </li>
                <li>Isi angka nilai pada kolom komponen tes yang sesuai (contoh: 85 atau 92.5).</li>
                <li>Simpan file dalam format CSV (*Comma delimited*), lalu pilih file di bawah ini.</li>
              </ol>
            </div>

            {/* Input Pemilihan File */}
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="import-file-input"
                style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 6 }}
              >
                Pilih File Spreadsheet (.csv):
              </label>
              <input
                id="import-file-input"
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={handleFileSelected}
                disabled={isImporting}
                style={{ fontSize: '0.875rem', width: '100%' }}
              />
            </div>

            {/* Pratinjau Hasil Pembacaan Berkas */}
            {parsedImport && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  marginBottom: 16,
                }}
              >
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem' }}>
                  Pratinjau Data yang Terbaca:
                </h4>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', marginBottom: 10 }}>
                  <span>
                    Baris Siswa Teridentifikasi: <strong>{parsedImport.rows.length}</strong>
                  </span>
                  <span>
                    Total Nilai Akan Dimasukkan:{' '}
                    <strong style={{ color: 'var(--brand)' }}>
                      {parsedImport.totalScoresToInput}
                    </strong>
                  </span>
                </div>

                {/* Peringatan jika ada baris tidak cocok */}
                {parsedImport.warnings.length > 0 && (
                  <div
                    style={{
                      maxHeight: 120,
                      overflowY: 'auto',
                      padding: 8,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--warning-light)',
                      border: '1px solid var(--warning)',
                      fontSize: '0.78rem',
                      color: 'var(--fg)',
                    }}
                  >
                    <strong>Peringatan ({parsedImport.warnings.length}):</strong>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                      {parsedImport.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Indikator Kemajuan Impor */}
            {isImporting && importProgress && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.825rem',
                    marginBottom: 4,
                  }}
                >
                  <span>Menyimpan nilai ke server…</span>
                  <span>
                    {importProgress.current} dari {importProgress.total} nilai
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    background: 'var(--line)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(importProgress.current / importProgress.total) * 100}%`,
                      height: '100%',
                      background: 'var(--brand)',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tombol Aksi Impor */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setShowImportModal(false)}
                disabled={isImporting}
              >
                Batal
              </button>
              <button
                type="button"
                className="button"
                disabled={!parsedImport || parsedImport.totalScoresToInput === 0 || isImporting}
                onClick={handleExecuteImport}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Icon name="check" size={14} />
                {isImporting ? 'Memproses Impor…' : 'Eksekusi Impor Nilai'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
