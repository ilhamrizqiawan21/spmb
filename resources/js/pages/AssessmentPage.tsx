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

/**
 * Baris penilaian untuk SATU komponen ujian yang sedang dipilih.
 */
function SingleComponentScoreRow({
  app,
  component,
  schedule,
  onScoreSaved,
  onScheduleStudent,
}: {
  app: Application
  component: SelectionComponent
  schedule?: AssessmentSchedule
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

  const [val, setVal] = useState<string>('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const save = useMutation({
    mutationFn: (scoreVal: string) =>
      api('/selection/assessments/input', {
        method: 'POST',
        body: { application_id: app.id, component_id: component.id, score: scoreVal },
      }),
    onSuccess: async () => {
      onScoreSaved(app.id, { [component.id]: val })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
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

  const given = score.data?.assessments.find((a) => a.component_id === component.id)?.score
  const isAssessed = given !== undefined && given !== null && given !== ''

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

      {/* 3. Jadwal & Kehadiran pada Ujian Ini */}
      <td style={{ fontSize: '0.825rem' }}>
        {schedule ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <div>
              <span>{fmtDate(schedule.scheduled_at)}</span>
              {schedule.room && <span className="hint" style={{ display: 'block', fontSize: '0.75rem' }}>Ruang: {schedule.room}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <StatusBadge status={schedule.status} />
              {schedule.status === 'SCHEDULED' && (
                <button
                  type="button"
                  className="link"
                  style={{ fontSize: '0.7rem', color: 'var(--warning)', padding: 0 }}
                  onClick={() => patchSchedule.mutate({ id: schedule.id, status: 'NO_SHOW' })}
                  title="Tandai tidak hadir"
                >
                  Absen
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="button secondary"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            onClick={() => onScheduleStudent(app)}
          >
            + Jadwalkan
          </button>
        )}
      </td>

      {/* 4. Input Nilai Ujian Ini */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            min={0}
            max={component.max_score}
            step="0.01"
            style={{
              width: 90,
              fontSize: '0.875rem',
              padding: '5px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--line)',
            }}
            aria-label={`${component.name} ${app.registration_number}`}
            placeholder={given ?? `Maks ${component.max_score}`}
            value={val}
            onChange={(e) => setVal(e.target.value)}
          />
          <button
            type="button"
            className="button secondary"
            style={{ fontSize: '0.78rem', padding: '5px 10px' }}
            disabled={!val || save.isPending}
            onClick={() => save.mutate(val)}
            title="Simpan nilai ujian ini"
          >
            <Icon name="check" size={13} /> {save.isPending ? '…' : 'Simpan'}
          </button>
        </div>
      </td>

      {/* 5. Status Penilaian Saat Ini */}
      <td>
        {saveSuccess ? (
          <span className="badge badge-verified" style={{ fontWeight: 600 }}>
            <Icon name="check" size={12} /> Tersimpan!
          </span>
        ) : isAssessed ? (
          <span className="badge badge-verified" style={{ fontWeight: 600 }}>
            {given} / {component.max_score} poin
          </span>
        ) : (
          <span className="badge" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
            Belum Dinilai
          </span>
        )}
        <ErrorNote error={save.error} />
      </td>
    </tr>
  )
}

/**
 * Baris tabel rekapitulasi nilai seluruh komponen ujian.
 */
function AllComponentsScoreRow({
  app,
  components,
  onScoreSaved,
}: {
  app: Application
  components: SelectionComponent[]
  onScoreSaved: (appId: string, scores: Record<string, string>) => void
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

  const given = (cid: string) => score.data?.assessments.find((a) => a.component_id === cid)?.score

  return (
    <tr>
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

      <td>
        <StatusBadge status={app.status} />
      </td>

      {components.map((c) => (
        <td key={c.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              min={0}
              max={c.max_score}
              step="0.01"
              style={{
                width: 80,
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

  // State pencarian & filter
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNASSESSED' | 'ASSESSED'>('ALL')

  // State lokal cache skor yang terisi (untuk dimasukkan saat download template jika ada)
  const [loadedScores, setLoadedScores] = useState<Record<string, Record<string, string>>>({})

  const periods = useQuery({
    queryKey: ['periods-all'],
    queryFn: () => api<{ id: string; name: string }[]>('/admission/periods', { auth: false }),
  })

  const periodIdParam = searchParams.get('period_id') || ''
  const selectedPeriodId = periodIdParam || periods.data?.[0]?.id || ''

  // Komponen ujian yang sedang dipilih pengguna (bisa null = belum pilih, 'ALL' = rekapitulasi, atau id komponen)
  const selectedComponentId = searchParams.get('component_id')

  function setPeriodId(id: string) {
    const next = new URLSearchParams(searchParams)
    next.set('period_id', id)
    setSearchParams(next)
  }

  function setComponentId(cid: string | null) {
    const next = new URLSearchParams(searchParams)
    if (cid) {
      next.set('component_id', cid)
    } else {
      next.delete('component_id')
    }
    setSearchParams(next)
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

  const compList = components.data ?? []
  const activeComponent = compList.find((c) => c.id === selectedComponentId)

  const list =
    apps.data?.filter(
      (a) => a.admission_period_id === selectedPeriodId && ASSESSABLE.includes(a.status)
    ) ?? []

  const filteredList = list.filter((a) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = a.applicant_name.toLowerCase().includes(q)
      const matchReg = a.registration_number && a.registration_number.toLowerCase().includes(q)
      if (!matchName && !matchReg) return false
    }
    if (statusFilter === 'UNASSESSED') {
      return a.status !== 'ASSESSED'
    }
    if (statusFilter === 'ASSESSED') {
      return a.status === 'ASSESSED'
    }
    return true
  })

  // Peta jadwal per aplikasi
  const schedulesByApp = new Map<string, AssessmentSchedule[]>()
  schedules.data?.forEach((s) => {
    const existing = schedulesByApp.get(s.application_id) || []
    existing.push(s)
    schedulesByApp.set(s.application_id, existing)
  })

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
    const targetComponents = activeComponent ? [activeComponent] : compList

    if (targetComponents.length === 0) {
      alert(
        'Belum ada komponen tes yang dibuat pada gelombang ini. Silakan buat komponen tes terlebih dahulu di menu Jadwal Asesmen.'
      )
      return
    }

    const csvContent = generateAssessmentTemplate(list, targetComponents, loadedScores)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const suffix = activeComponent
      ? activeComponent.code.toLowerCase()
      : 'semua_ujian'
    const safePeriod = selectedPeriodName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    a.href = url
    a.download = `format_nilai_${suffix}_${safePeriod}.csv`
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
    const targetComponents = activeComponent ? [activeComponent] : compList
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        const result = parseAssessmentCsv(content, list, targetComponents)
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
        title="Penilaian Hasil Seleksi"
        description="Pilih ujian seleksi terlebih dahulu untuk menampilkan daftar siswa dan menginputkan hasil penilaiannya."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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

      {/* Filter Gelombang Pendaftaran */}
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
            Total Siswa Terdaftar: <strong>{list.length} Orang</strong>
          </span>
          <span>
            Jumlah Ujian: <strong>{compList.length} Jenis Tes</strong>
          </span>
        </div>
      </div>

      {/* =========================================================================
          KONDISI 1: BELUM MEMILIH UJIAN (Tampilkan Pemilih Ujian / Komponen Tes)
          ========================================================================= */}
      {!selectedComponentId ? (
        <section className="card" style={{ margin: 0 }}>
          <div style={{ marginBottom: 20 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'var(--brand-light)',
                color: 'var(--brand)',
                fontSize: '0.78rem',
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              <Icon name="check-circle" size={13} /> Langkah 1: Pilih Ujian
            </span>
            <h2 style={{ fontSize: '1.25rem', margin: '4px 0 6px 0' }}>
              Pilih Ujian yang Ingin Dinilai
            </h2>
            <p className="hint" style={{ margin: 0, fontSize: '0.875rem' }}>
              Silakan pilih salah satu ujian seleksi di bawah ini. Setelah ujian dipilih, Anda dapat
              menginput nilai siswa, mengunduh format Excel, atau mengimpor nilai peserta khusus untuk ujian tersebut.
            </p>
          </div>

          {compList.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 16,
              }}
            >
              {compList.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: 18,
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--fg)' }}>{c.name}</strong>
                      <span className="badge badge-verified" style={{ fontWeight: 600 }}>
                        Bobot {c.weight}%
                      </span>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div>
                        <span>Kode Kolom: </span>
                        <code style={{ background: 'var(--surface)', padding: '2px 5px', borderRadius: 4 }}>
                          {c.code}
                        </code>
                      </div>
                      <div>
                        <span>Skor Maksimal: </span>
                        <strong style={{ color: 'var(--fg)' }}>{c.max_score} poin</strong>
                      </div>
                      {c.description && (
                        <p style={{ margin: '6px 0 0 0', lineHeight: 1.4, color: 'var(--fg)', fontSize: '0.8rem' }}>
                          {c.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="button"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      fontSize: '0.875rem',
                      padding: '8px 14px',
                    }}
                    onClick={() => setComponentId(c.id)}
                  >
                    <Icon name="award" size={15} /> Pilih & Nilai Siswa →
                  </button>
                </div>
              ))}

              {/* Kartu Khusus: Rekapitulasi Semua Nilai Ujian */}
              <div
                style={{
                  padding: 18,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  border: '1px dashed var(--brand)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--brand)' }}>
                      Rekapitulasi Semua Ujian
                    </strong>
                    <span className="badge badge-verified" style={{ fontWeight: 600 }}>
                      Matriks Lengkap
                    </span>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                    Tampilkan seluruh kolom ujian sekaligus dalam satu tabel beserta skor akhir terhitung untuk
                    seluruh calon siswa.
                  </p>
                </div>

                <button
                  type="button"
                  className="button secondary"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontSize: '0.875rem',
                    padding: '8px 14px',
                  }}
                  onClick={() => setComponentId('ALL')}
                >
                  <Icon name="bar-chart" size={15} /> Buka Rekapitulasi Semua →
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Belum ada komponen tes yang dibuat"
              description="Sekolah belum mengonfigurasi jenis ujian (seperti Tes Tulis, Tes Baca Qur'an, Wawancara). Silakan atur komponen tes terlebih dahulu di menu Jadwal Asesmen."
            />
          )}
        </section>
      ) : (
        /* =========================================================================
           KONDISI 2: UJIAN SUDAH DIPILIH (Tampilkan Daftar Siswa untuk Dinilai)
           ========================================================================= */
        <section className="card" style={{ margin: 0 }}>
          {/* Header Bar Ujian yang Dipilih & Tombol Ganti Ujian */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button secondary"
                style={{ fontSize: '0.825rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => setComponentId(null)}
                title="Kembali untuk memilih ujian lain"
              >
                ← Ganti Ujian
              </button>

              <div>
                <span className="hint" style={{ fontSize: '0.75rem', display: 'block' }}>
                  Ujian yang Sedang Dinilai:
                </span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--brand)' }}>
                  {selectedComponentId === 'ALL'
                    ? 'Rekapitulasi Semua Ujian'
                    : activeComponent?.name ?? 'Ujian Seleksi'}
                </strong>
                {activeComponent && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: 8 }}>
                    (Bobot: {activeComponent.weight}% • Maks: {activeComponent.max_score} poin)
                  </span>
                )}
              </div>
            </div>

            {/* Selector Cepat Dropdown Pindah Ujian */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="quick-switch-test" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                Pindah Ujian:
              </label>
              <select
                id="quick-switch-test"
                value={selectedComponentId}
                onChange={(e) => setComponentId(e.target.value)}
                style={{ fontSize: '0.825rem', padding: '4px 8px' }}
              >
                {compList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.weight}%)
                  </option>
                ))}
                <option value="ALL">Rekapitulasi Semua Ujian</option>
              </select>
            </div>
          </div>

          {/* Toolbar Tindakan Khusus Ujian Terpilih: Unduh Excel, Impor Excel, Cari Siswa */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* Tombol Impor & Unduh Excel Khusus Ujian Ini */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
                onClick={handleDownloadTemplate}
                title={
                  activeComponent
                    ? `Unduh format Excel khusus untuk menilai ujian ${activeComponent.name}`
                    : 'Unduh format Excel untuk semua ujian'
                }
              >
                <Icon name="database" size={14} /> Unduh Format Excel
              </button>

              <button
                type="button"
                className="button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
                onClick={() => {
                  setParsedImport(null)
                  setImportFeedback(null)
                  setShowImportModal(true)
                }}
                title={
                  activeComponent
                    ? `Impor nilai siswa khusus ujian ${activeComponent.name} dari Excel`
                    : 'Impor nilai siswa dari Excel'
                }
              >
                <Icon name="rocket" size={14} /> Impor Nilai dari Excel
              </button>
            </div>

            {/* Pencarian & Filter Status Siswa */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'UNASSESSED' | 'ASSESSED')}
                style={{ fontSize: '0.825rem', padding: '5px 8px' }}
                aria-label="Filter status siswa"
              >
                <option value="ALL">Semua Calon Siswa</option>
                <option value="UNASSESSED">Belum Dinilai Lengkap</option>
                <option value="ASSESSED">Sudah Lengkap Dinilai</option>
              </select>

              <input
                type="search"
                placeholder="Cari siswa / no. reg…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '0.85rem', padding: '5px 10px', minWidth: 200 }}
                aria-label="Cari siswa"
              />
            </div>
          </div>

          {/* Tabel Siswa Berdasarkan Mode Tampilan */}
          {apps.isPending ? (
            <p className="loading-indicator">Memuat data pendaftar & nilai…</p>
          ) : filteredList.length > 0 ? (
            <div className="table-wrapper" style={{ marginBottom: 0 }}>
              {selectedComponentId === 'ALL' ? (
                /* Mode 2A: Rekapitulasi Semua Ujian Sekaligus */
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Calon Siswa & No. Pendaftaran</th>
                      <th style={{ width: '12%' }}>Status</th>
                      {compList.map((c) => (
                        <th key={c.id} style={{ minWidth: 130 }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{c.name}</span>
                            <small className="hint" style={{ fontSize: '0.7rem' }}>
                              Bobot: {c.weight}% • Maks: {c.max_score}
                            </small>
                          </div>
                        </th>
                      ))}
                      <th style={{ textAlign: 'center', width: '12%' }}>Nilai Akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((a) => (
                      <AllComponentsScoreRow
                        key={a.id}
                        app={a}
                        components={compList}
                        onScoreSaved={handleScoreSaved}
                      />
                    ))}
                  </tbody>
                </table>
              ) : activeComponent ? (
                /* Mode 2B: Fokus Menilai UJIAN TERPILIH */
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Calon Siswa & No. Pendaftaran</th>
                      <th style={{ width: '15%' }}>Status Berkas</th>
                      <th style={{ width: '22%' }}>Jadwal / Ruang Ujian Ini</th>
                      <th style={{ width: '20%' }}>Input Nilai ({activeComponent.name})</th>
                      <th style={{ width: '15%' }}>Status Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((a) => {
                      const studentSchedules = schedulesByApp.get(a.id) ?? []
                      const compSchedule = studentSchedules.find(
                        (s) => s.component_id === activeComponent.id
                      )
                      return (
                        <SingleComponentScoreRow
                          key={a.id + activeComponent.id}
                          app={a}
                          component={activeComponent}
                          schedule={compSchedule}
                          onScoreSaved={handleScoreSaved}
                          onScheduleStudent={(student) => {
                            setSchedulingStudent(student)
                            setScheduleErrors({})
                          }}
                        />
                      )
                    })}
                  </tbody>
                </table>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Tidak ada calon siswa ditemukan"
              description={
                searchQuery
                  ? `Tidak ada siswa yang cocok dengan pencarian "${searchQuery}".`
                  : 'Tidak ada calon siswa pada gelombang ini yang siap dinilai.'
              }
            />
          )}
        </section>
      )}

      {/* Modal Dialog Penjadwalan Siswa ke Ujian */}
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
                  Atur Jadwal Ujian Siswa
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
                  <span>Komponen Ujian yang Diikuti *</span>
                  <select
                    name="component_id"
                    required
                    defaultValue={activeComponent?.id ?? ''}
                  >
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
                    <input name="location" placeholder="e.g. Kampus Utama" />
                  </label>
                  <label className="field">
                    <span>Ruang</span>
                    <input name="room" placeholder="e.g. Lab Komputer / Masjid" />
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
                  Impor Nilai {activeComponent ? `Ujian ${activeComponent.name}` : 'Peserta'} dari Excel / CSV
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

            {/* Petunjuk Pengisian Template */}
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
                <li>
                  Isi angka nilai pada kolom{' '}
                  <strong>{activeComponent ? activeComponent.code : 'komponen ujian'}</strong> (contoh: 85 atau 92.5).
                </li>
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
