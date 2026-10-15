import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Icon } from '../components/Icon'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { api, fieldErrors } from '../lib/api'
import type { SelectionComponent } from '../types/api'

export function SchedulePage() {
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [componentErrors, setComponentErrors] = useState<Record<string, string>>({})
  const [showAddComponent, setShowAddComponent] = useState(false)
  const [editingComponent, setEditingComponent] = useState<SelectionComponent | null>(null)

  // Query periode gelombang pendaftaran
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

  const refreshComponents = async () => {
    await qc.invalidateQueries({ queryKey: ['components', selectedPeriodId] })
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
      await refreshComponents()
    },
    onError: (e) => setComponentErrors(fieldErrors(e)),
  })

  const deleteComponent = useMutation({
    mutationFn: (id: string) => api(`/selection/components/${id}`, { method: 'DELETE' }),
    onSuccess: refreshComponents,
  })

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

  const compList = components.data ?? []
  const totalWeight = compList.reduce((acc, c) => acc + parseFloat(c.weight || '0'), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Jadwal Asesmen & Komponen Tes"
        description="Fokus pada konfigurasi komponen tes sekolah dan pengaturan jadwal sesi pelaksanaan tes seleksi."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link
              to={`/penilaian?period_id=${selectedPeriodId}`}
              className="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem' }}
            >
              <Icon name="award" size={15} /> Buka Menu Penilaian Peserta →
            </Link>
          </div>
        }
      />

      {/* Banner Pemisahan Tanggung Jawab Halaman */}
      <div
        className="card"
        style={{
          margin: 0,
          padding: '14px 18px',
          background: 'var(--surface)',
          borderLeft: '4px solid var(--brand)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'var(--bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand)',
            }}
          >
            <Icon name="calendar" size={18} />
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '0.92rem' }}>
              Fokus Halaman: Komponen & Penjadwalan Pelaksanaan Tes
            </strong>
            <span className="hint" style={{ fontSize: '0.825rem' }}>
              Halaman ini khusus untuk mengatur jenis tes sekolah dan jadwal pelaksanaan ujian. Pengelolaan
              calon siswa yang mengikuti tes dan input penilaian dilakukan di menu{' '}
              <Link to={`/penilaian?period_id=${selectedPeriodId}`} style={{ fontWeight: 600 }}>
                Penilaian
              </Link>.
            </span>
          </div>
        </div>
        <Link
          to={`/penilaian?period_id=${selectedPeriodId}`}
          className="button secondary"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          Lihat Siswa & Input Nilai →
        </Link>
      </div>

      {/* Baris Pemilihan Gelombang & Ringkasan Bobot */}
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
            Total Bobot: <strong style={{ color: totalWeight === 100 ? 'var(--brand)' : 'var(--warning)' }}>{totalWeight}%</strong>{' '}
            {totalWeight === 100 ? (
              <span style={{ color: 'var(--brand)', fontSize: '0.8rem' }}>(Ideal 100%)</span>
            ) : (
              <span style={{ color: 'var(--warning)', fontSize: '0.8rem' }}>
                (Harus 100%, selisih: {100 - totalWeight}%)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Bagian 1: Manajemen Komponen Tes Sekolah (Fleksibel & Kosongan/Dapat Diperbarui) */}
      <section className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>1. Komponen Tes Seleksi Sekolah</h2>
            <small className="hint">
              Komponen tes dapat dibuat dari awal (kosongan) atau disesuaikan kebutuhan sekolah (misal: Tes Tulis,
              Tes Baca Al-Qur&apos;an, Wawancara, Praktik Ibadah). Tidak mutlak dan dapat diperbarui sewaktu-waktu.
            </small>
          </div>
          <button
            type="button"
            className="button"
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
                  <th style={{ width: '15%' }}>Kode Kolom Excel</th>
                  <th style={{ width: '15%' }}>Bobot Nilai (%)</th>
                  <th style={{ width: '15%' }}>Skor Maksimal</th>
                  <th style={{ width: '20%' }}>Keterangan / Jadwal</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {compList.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{ fontSize: '0.9rem', display: 'block' }}>{c.name}</strong>
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

      {/* Bagian 2: Penjadwalan Pelaksanaan Tes (Agenda Sesi Tes Sekolah) */}
      <section className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>2. Penjadwalan Pelaksanaan Tes Sekolah</h2>
            <small className="hint">
              Rincian agenda dan jadwal pelaksanaan ujian untuk tiap komponen tes pada gelombang {selectedPeriodName}.
            </small>
          </div>
        </div>

        {compList.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {compList.map((c) => (
              <div
                key={c.id}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '1rem', display: 'block' }}>{c.name}</strong>
                    <code style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Kode: {c.code}</code>
                  </div>
                  <span className="badge badge-verified" style={{ fontWeight: 600 }}>
                    Bobot {c.weight}%
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--fg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <span className="hint" style={{ fontSize: '0.75rem', display: 'block' }}>Nilai Maksimal:</span>
                    <strong>{c.max_score} poin</strong>
                  </div>
                  <div>
                    <span className="hint" style={{ fontSize: '0.75rem', display: 'block' }}>Petunjuk / Jadwal Pelaksanaan:</span>
                    <p style={{ margin: 0, lineHeight: 1.4, color: c.description ? 'var(--fg)' : 'var(--muted)' }}>
                      {c.description || 'Belum diatur keterangan waktu/ruang pelaksanaan.'}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                    onClick={() => {
                      setEditingComponent(c)
                      setShowAddComponent(true)
                    }}
                  >
                    Atur Jadwal & Keterangan
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Belum ada jadwal pelaksanaan"
            description="Tambahkan komponen tes terlebih dahulu untuk mengatur jadwal dan sesi pelaksanaan ujian."
          />
        )}
      </section>

      {/* Modal Dialog Tambah / Edit Komponen Tes & Jadwal */}
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
                {editingComponent ? 'Ubah Komponen & Jadwal Tes' : 'Tambah Komponen Tes Baru'}
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
                  <span>Jadwal Pelaksanaan / Keterangan Ruang & Waktu</span>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editingComponent?.description ?? ''}
                    placeholder="e.g. Pelaksanaan: Sabtu, 15 Nov 2026 Pkl 08:00 - 10:00 WIB di Lab Komputer. Bawa kartu peserta dan alat tulis."
                    style={{ fontFamily: 'inherit', fontSize: '0.875rem' }}
                  />
                  <small className="hint">
                    Keterangan ini menjadi panduan bagi penguji dan calon siswa mengenai waktu, ruang, dan materi tes.
                  </small>
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
                    {saveComponent.isPending ? 'Menyimpan…' : 'Simpan Komponen'}
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
