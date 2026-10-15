import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import {
  generateAssessmentTemplate,
  parseAssessmentCsv,
  type ParseResult,
} from '../lib/assessmentCsv'
import type { Application, ApplicationScore, SelectionComponent } from '../types/api'

const ASSESSABLE = ['VERIFIED', 'ASSESSMENT_SCHEDULED', 'ASSESSED']

function ScoreRow({
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

      {/* Input Nilai per Komponen Seleksi Sekolah */}
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

      {/* Nilai Akhir Terhitung */}
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

  const list =
    apps.data?.filter(
      (a) => a.admission_period_id === selectedPeriodId && ASSESSABLE.includes(a.status)
    ) ?? []

  const assessedCount = list.filter((a) => a.status === 'ASSESSED').length
  const pendingAssessmentCount = list.length - assessedCount
  const compList = components.data ?? []

  function handleScoreSaved(appId: string, newScores: Record<string, string>) {
    setLoadedScores((prev) => ({
      ...prev,
      [appId]: { ...(prev[appId] || {}), ...newScores },
    }))
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
                notes: 'Impor massal dari file spreadsheet',
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

      await qc.invalidateQueries({ queryKey: ['applications'] })
      await qc.invalidateQueries({ queryKey: ['score'] })

      setImportFeedback({
        type: 'success',
        message: `Berhasil mengimpor ${successCount} nilai seleksi untuk ${parsedImport.rows.length} calon siswa.${
          failCount > 0 ? ` (${failCount} nilai gagal diproses)` : ''
        }`,
      })
      setParsedImport(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      setImportFeedback({
        type: 'error',
        message: 'Terjadi kendala saat memproses impor nilai.',
      })
    } finally {
      setIsImporting(false)
      setImportProgress(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Penilaian & Skor Seleksi"
        description="Penginputan nilai tes akademik, baca Al-Qur'an, dan wawancara calon siswa. Nilai dapat diisi langsung atau diimpor massal dari file Excel."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Tombol Unduh Format Excel */}
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
              <Icon name="calendar" size={14} /> Atur Jadwal Asesmen →
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

      {/* Filter Gelombang & KPI Status Penilaian */}
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
            Total Peserta: <strong>{list.length} Siswa</strong>
          </span>
          <span>
            Selesai Dinilai: <strong style={{ color: 'var(--brand)' }}>{assessedCount}</strong>
          </span>
          <span>
            Belum Lengkap: <strong style={{ color: 'var(--warning)' }}>{pendingAssessmentCount}</strong>
          </span>
        </div>
      </div>

      {/* Tabel Penilaian Peserta */}
      <section className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Daftar Nilai Seleksi Calon Siswa</h2>
            <small className="hint">
              Input nilai angka untuk masing-masing komponen tes sekolah. Status calon siswa otomatis berpindah ke <strong>ASSESSED</strong> setelah seluruh komponen terisi.
            </small>
          </div>
          <span className="badge badge-verified" style={{ fontWeight: 600 }}>
            {compList.length} Komponen Tes Aktif
          </span>
        </div>

        {compList.length === 0 ? (
          <EmptyState
            title="Belum ada komponen tes seleksi"
            description="Sekolah belum mengatur komponen tes (seperti Tes Tulis, Tes Baca Al-Qur'an, dll) untuk gelombang ini. Klik 'Atur Jadwal Asesmen' di atas untuk membuat komponen tes terlebih dahulu."
          />
        ) : apps.isPending ? (
          <p className="loading-indicator">Memuat data pendaftar & nilai…</p>
        ) : list.length > 0 ? (
          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Calon Siswa & No. Pendaftaran</th>
                  <th style={{ width: '15%' }}>Status</th>
                  {compList.map((c) => (
                    <th key={c.id} style={{ minWidth: 150 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{c.name}</span>
                        <small className="hint" style={{ fontSize: '0.7rem', fontWeight: 500 }}>
                          Bobot: {c.weight}% • Maks: {c.max_score}
                        </small>
                      </div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', width: '12%' }}>Nilai Akhir</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <ScoreRow
                    key={a.id}
                    app={a}
                    components={compList}
                    onScoreSaved={handleScoreSaved}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Belum ada calon siswa siap dinilai"
            description="Tidak ada calon siswa pada gelombang ini yang berstatus lolos verifikasi berkas (VERIFIED)."
          />
        )}
      </section>

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
                style={{ width: '100%', padding: '6px', fontSize: '0.875rem' }}
              />
            </div>

            {/* Hasil Parsing & Pratinjau */}
            {parsedImport && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background:
                      parsedImport.rows.length > 0 ? 'var(--brand-light)' : 'var(--danger-light)',
                    border: `1px solid ${
                      parsedImport.rows.length > 0 ? 'var(--brand)' : 'var(--danger)'
                    }`,
                    fontSize: '0.875rem',
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ display: 'block' }}>Hasil Pemeriksaan File:</strong>
                  <span>
                    Ditemukan <strong>{parsedImport.rows.length} siswa</strong> dengan total{' '}
                    <strong>{parsedImport.totalScoresToInput} nilai</strong> yang siap diimpor.
                  </span>
                </div>

                {parsedImport.errors.length > 0 && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBottom: 8 }}>
                    {parsedImport.errors.map((err, i) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}

                {parsedImport.warnings.length > 0 && (
                  <div
                    style={{
                      maxHeight: 120,
                      overflowY: 'auto',
                      fontSize: '0.78rem',
                      color: 'var(--warning)',
                      padding: '8px 10px',
                      background: 'var(--bg)',
                      borderRadius: 4,
                      border: '1px solid var(--line)',
                    }}
                  >
                    <strong>Peringatan ({parsedImport.warnings.length} baris):</strong>
                    {parsedImport.warnings.map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Progress Bar saat Impor Berjalan */}
            {importProgress && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 4 }}>
                  <span>Memproses nilai peserta…</span>
                  <span>
                    {importProgress.current} / {importProgress.total}
                  </span>
                </div>
                <div style={{ width: '100%', height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (importProgress.current / (importProgress.total || 1)) * 100)}%`,
                      background: 'var(--brand)',
                      transition: 'width 0.15s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tombol Aksi Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
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
                onClick={() => void handleExecuteImport()}
                disabled={
                  isImporting || !parsedImport || parsedImport.rows.length === 0
                }
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Icon name="rocket" size={14} />
                {isImporting ? 'Mengimpor…' : `Simpan & Terapkan Nilai (${parsedImport?.rows.length ?? 0} Siswa)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
