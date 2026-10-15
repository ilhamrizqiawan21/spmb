import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../features/auth/AuthContext'
import { api, fieldErrors, openBlob } from '../lib/api'
import { rupiah } from '../lib/money'
import type {
  Application,
  FinanceSummary,
  InvoicePage,
  Payment,
  PaymentPage,
} from '../types/api'

const STATUS_FILTERS = [
  { value: 'PENDING', label: 'Menunggu verifikasi' },
  { value: 'PAID', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: '', label: 'Semua' },
]

/**
 * Tab 1: Antrean Verifikasi Pembayaran Orang Tua / Calon Siswa
 */
function PaymentQueue({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDING')
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null)

  const payments = useQuery({
    queryKey: ['payments', status],
    queryFn: () => api<PaymentPage>(`/finance/payments${status ? `?status=${status}` : ''}`),
  })

  const proof = useMutation({
    mutationFn: (id: string) => openBlob(`/finance/payments/${id}/proof`),
  })

  const verify = useMutation({
    mutationFn: (v: { id: string; approved: boolean; note?: string }) =>
      api(`/finance/payments/${v.id}/verify`, {
        method: 'POST',
        body: { approved: v.approved, note: v.note || null },
      }),
    onSuccess: async () => {
      setRejecting(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['payments'] }),
        qc.invalidateQueries({ queryKey: ['finance-summary'] }),
        qc.invalidateQueries({ queryKey: ['finance-invoices-all'] }),
        qc.invalidateQueries({ queryKey: ['finance-invoices'] }),
      ])
    },
  })

  return (
    <section className="card" style={{ margin: 0 }}>
      <h1>Keuangan</h1>
      <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>Verifikasi Pembayaran</h2>
          <small className="hint">
            Periksa berkas bukti transfer bank dan lakukan validasi persetujuan pembayaran.
          </small>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label className="field" style={{ margin: 0 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tampilkan</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '4px 8px' }}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {payments.isPending ? (
        <p className="loading-indicator">Memuat antrean verifikasi pembayaran…</p>
      ) : payments.data && payments.data.data.length > 0 ? (
        <div className="table-wrapper" style={{ marginBottom: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>No. Tagihan</th>
                <th style={{ width: '25%' }}>Pendaftar</th>
                <th style={{ width: '15%' }}>Jumlah</th>
                <th style={{ width: '15%' }}>Referensi</th>
                <th style={{ width: '15%' }}>Status</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {payments.data.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <code style={{ fontSize: '0.8rem', background: 'var(--bg)', padding: '2px 5px', borderRadius: 4 }}>
                      {p.invoice_number ?? '—'}
                    </code>
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.9rem', display: 'block' }}>{p.applicant_name ?? '—'}</strong>
                    <small style={{ fontFamily: 'monospace', color: 'var(--brand)', fontWeight: 600 }}>
                      {p.registration_number ?? 'DRAF'}
                    </small>
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--fg)' }}>
                      {rupiah(p.amount)}
                    </strong>
                    <small className="hint" style={{ display: 'block', fontSize: '0.72rem' }}>
                      {p.method}
                    </small>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{p.reference_number || '—'}</span>
                    {p.paid_at && (
                      <small className="hint" style={{ display: 'block', fontSize: '0.72rem' }}>
                        {new Date(p.paid_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </small>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                    {p.verification_note && (
                      <small className="hint" style={{ display: 'block', fontSize: '0.75rem', marginTop: 3 }}>
                        {p.verification_note}
                      </small>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {p.has_proof && (
                        <button
                          type="button"
                          className="button secondary"
                          style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                          onClick={() => proof.mutate(p.id)}
                          title="Lihat berkas bukti transfer"
                        >
                          Bukti
                        </button>
                      )}
                      {canManage && p.status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            className="button"
                            style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                            onClick={() => verify.mutate({ id: p.id, approved: true })}
                            disabled={verify.isPending}
                            title="Setujui pembayaran ini"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            className="button secondary"
                            style={{ fontSize: '0.78rem', padding: '4px 8px', color: 'var(--danger)' }}
                            onClick={() => setRejecting({ id: p.id, note: '' })}
                            disabled={verify.isPending}
                            title="Tolak bukti pembayaran"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Tidak ada pembayaran dalam antrean"
          description={
            status
              ? `Tidak ada pembayaran dengan status "${status}".`
              : 'Belum ada bukti pembayaran yang diunggah oleh pendaftar.'
          }
        />
      )}

      {/* Modal Dialog Form Penolakan Pembayaran */}
      {rejecting && (
        <div className="modal-overlay" onClick={() => setRejecting(null)} role="presentation">
          <div
            className="modal-window"
            style={{ maxWidth: 480, padding: 22 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-reject-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <h3 id="modal-reject-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                Konfirmasi Penolakan Pembayaran
              </h3>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '3px 8px', fontSize: '0.8rem' }}
                onClick={() => setRejecting(null)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                verify.mutate({ id: rejecting.id, approved: false, note: rejecting.note })
              }}
            >
              <label className="field">
                <span>Alasan penolakan</span>
                <textarea
                  required
                  rows={3}
                  value={rejecting.note}
                  onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })}
                  placeholder="Contoh: Nominal transfer kurang, bukti buram/tidak terbaca, dll."
                  autoFocus
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setRejecting(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="button"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                  disabled={verify.isPending || !rejecting.note.trim()}
                >
                  Konfirmasi penolakan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ErrorNote error={payments.error ?? verify.error ?? proof.error} />
    </section>
  )
}

/**
 * Tab 2: Manajemen Tagihan & Pembuatan Massal (Bulk Invoicing)
 */
function InvoiceManagerUnified({
  selectedPeriodId,
  selectedPeriodName,
}: {
  selectedPeriodId: string
  selectedPeriodName: string
}) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [cancelling, setCancelling] = useState<{ id: string; reason: string } | null>(null)

  // State Modal Tagihan Perorangan
  const [showSingleModal, setShowSingleModal] = useState(false)
  const [singleAppId, setSingleAppId] = useState('')

  // State Modal Tagihan Massal
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null)
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({})

  // Query seluruh pendaftar (untuk tagihan perorangan)
  const applications = useQuery({
    queryKey: ['applications-staff'],
    queryFn: () => api<Application[]>('/admission/applications').catch(() => []),
  })

  // Query tagihan lintas pendaftar dengan filter gelombang
  const allInvoices = useQuery({
    queryKey: ['finance-invoices-all', selectedPeriodId, statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams()
      if (selectedPeriodId) params.set('period_id', selectedPeriodId)
      if (statusFilter) params.set('status', statusFilter)
      if (search.trim()) params.set('search', search.trim())
      return api<InvoicePage>(`/finance/invoices?${params.toString()}`).catch(() => ({
        data: [],
        meta: { page: 1, per_page: 50, total: 0 },
      }))
    },
  })

  const cancel = useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      api(`/finance/invoices/${v.id}/cancel`, { method: 'POST', body: { reason: v.reason } }),
    onSuccess: async () => {
      setCancelling(null)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['finance-invoices-all'] }),
        qc.invalidateQueries({ queryKey: ['finance-summary'] }),
      ])
    },
  })

  const createSingle = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/finance/applications/${singleAppId}/invoices`, { method: 'POST', body }),
    onSuccess: async () => {
      setShowSingleModal(false)
      setSingleAppId('')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['finance-invoices-all'] }),
        qc.invalidateQueries({ queryKey: ['finance-summary'] }),
      ])
    },
  })

  const createBulk = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ message: string; result: { total_targeted: number; created: number; skipped: number } }>(
        '/finance/invoices/bulk',
        { method: 'POST', body }
      ),
    onSuccess: async (res) => {
      setShowBulkModal(false)
      setBulkErrors({})
      setBulkFeedback(res.message)
      setTimeout(() => setBulkFeedback(null), 6000)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['finance-invoices-all'] }),
        qc.invalidateQueries({ queryKey: ['finance-summary'] }),
      ])
    },
    onError: (e) => setBulkErrors(fieldErrors(e)),
  })

  function onSubmitSingle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!singleAppId) return
    const f = new FormData(e.currentTarget)
    const due = String(f.get('due_date') || '')
    createSingle.mutate({
      type: String(f.get('type')),
      amount: String(f.get('amount')),
      due_date: due ? new Date(`${due}T23:59:59+07:00`).toISOString() : null,
      description: String(f.get('description') || '') || null,
    })
  }

  function onSubmitBulk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBulkErrors({})
    const f = new FormData(e.currentTarget)
    const due = String(f.get('due_date') || '')
    createBulk.mutate({
      admission_period_id: selectedPeriodId,
      application_status: String(f.get('application_status') || 'ACCEPTED'),
      type: String(f.get('type') || 'ENROLLMENT_FEE'),
      amount: String(f.get('amount')),
      due_date: due ? new Date(`${due}T23:59:59+07:00`).toISOString() : null,
      description: String(f.get('description') || '') || null,
    })
  }

  const appOptions = (Array.isArray(applications.data) ? applications.data : []).filter(
    (a) => !selectedPeriodId || a.admission_period_id === selectedPeriodId
  )

  const invoiceList = Array.isArray(allInvoices.data?.data) ? allInvoices.data.data : []

  return (
    <section className="card" style={{ margin: 0 }}>
      {bulkFeedback && (
        <div
          className="card"
          style={{
            margin: '0 0 16px 0',
            padding: '12px 16px',
            borderColor: 'var(--brand)',
            background: 'var(--brand-light)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon name="check-circle" size={18} />
          <span>{bulkFeedback}</span>
        </div>
      )}

      {/* Header & Aksi Tombol Tagihan */}
      <div
        className="card-header between"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}
      >
        <div>
          <h2>Tagihan Pendaftar</h2>
          <small className="hint">
            Gelombang: <strong>{selectedPeriodName}</strong> • Terbitkan tagihan perorangan atau sekaligus secara massal.
          </small>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            onClick={() => {
              setBulkErrors({})
              setShowBulkModal(true)
            }}
            title="Terbitkan tagihan serentak kepada semua calon siswa yang berstatus Diterima"
          >
            <Icon name="rocket" size={14} /> + Terbitkan Tagihan Massal
          </button>

          <button
            type="button"
            className="button secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
            onClick={() => setShowSingleModal(true)}
            title="Buat tagihan khusus untuk satu orang calon siswa"
          >
            <Icon name="check" size={13} /> + Buat Tagihan Perorangan
          </button>
        </div>
      </div>

      {/* Filter Status Tagihan & Pencarian */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.825rem', fontWeight: 600 }}>Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '0.825rem', padding: '4px 8px' }}
          >
            <option value="">Semua Status</option>
            <option value="UNPAID">Belum Dibayar (UNPAID)</option>
            <option value="PARTIALLY_PAID">Sebagian (PARTIALLY_PAID)</option>
            <option value="PAID">Lunas (PAID)</option>
            <option value="EXPIRED">Kedaluwarsa (EXPIRED)</option>
            <option value="CANCELLED">Dibatalkan/Bebas</option>
          </select>
        </div>

        <input
          type="search"
          placeholder="Cari nama siswa / no. reg / invoice…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ fontSize: '0.85rem', padding: '5px 10px', minWidth: 230 }}
        />
      </div>

      {/* Tabel Tagihan */}
      {allInvoices.isPending ? (
        <p className="loading-indicator">Memuat daftar tagihan siswa…</p>
      ) : invoiceList.length > 0 ? (
        <div className="table-wrapper" style={{ marginBottom: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '15%' }}>No. Tagihan</th>
                <th style={{ width: '22%' }}>Pendaftar</th>
                <th style={{ width: '15%' }}>Jenis / Keterangan</th>
                <th style={{ width: '13%' }}>Total Tagihan</th>
                <th style={{ width: '13%' }}>Terbayar</th>
                <th style={{ width: '12%' }}>Status</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {invoiceList.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <code style={{ fontSize: '0.8rem', background: 'var(--bg)', padding: '2px 5px', borderRadius: 4 }}>
                      {inv.invoice_number}
                    </code>
                    {inv.due_date && (
                      <small className="hint" style={{ display: 'block', fontSize: '0.72rem' }}>
                        Jatuh tempo: {new Date(inv.due_date).toLocaleDateString('id-ID')}
                      </small>
                    )}
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.9rem', display: 'block' }}>
                      {inv.applicant_name ?? '—'}
                    </strong>
                    <small style={{ fontFamily: 'monospace', color: 'var(--brand)', fontWeight: 600 }}>
                      {inv.registration_number ?? 'DRAF'}
                    </small>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                      {inv.description || inv.type}
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontSize: '0.92rem' }}>{rupiah(inv.amount)}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.875rem', color: Number(inv.paid_amount) > 0 ? 'var(--brand)' : 'var(--muted)' }}>
                      {rupiah(inv.paid_amount)}
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {inv.status !== 'CANCELLED' && inv.status !== 'PAID' && (
                      <button
                        type="button"
                        className="button secondary"
                        style={{ fontSize: '0.75rem', padding: '3px 8px', color: 'var(--danger)' }}
                        onClick={() => setCancelling({ id: inv.id, reason: '' })}
                        title="Bebaskan atau batalkan tagihan ini"
                      >
                        Bebaskan / batalkan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Tidak ada tagihan ditemukan"
          description={
            search || statusFilter
              ? 'Tidak ada tagihan yang cocok dengan filter saat ini.'
              : 'Belum ada tagihan yang diterbitkan pada gelombang ini. Gunakan tombol di atas untuk membuat tagihan.'
          }
        />
      )}

      {/* Modal Batalkan / Bebaskan Tagihan */}
      {cancelling && (
        <div className="modal-overlay" onClick={() => setCancelling(null)} role="presentation">
          <div
            className="modal-window"
            style={{ maxWidth: 460, padding: 22 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-cancel-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <h3 id="modal-cancel-title" style={{ margin: 0, fontSize: '1.1rem' }}>
                Pembebasan / Pembatalan Tagihan
              </h3>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '3px 8px', fontSize: '0.8rem' }}
                onClick={() => setCancelling(null)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                cancel.mutate(cancelling)
              }}
            >
              <label className="field">
                <span>Alasan pembebasan/pembatalan (wajib, tercatat di audit) *</span>
                <textarea
                  required
                  rows={3}
                  value={cancelling.reason}
                  onChange={(e) => setCancelling({ ...cancelling, reason: e.target.value })}
                  placeholder="Contoh: Beasiswa penuh yayasan, dispensasi kepala sekolah, dll."
                  autoFocus
                />
              </label>

              <ErrorNote error={cancel.error} />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setCancelling(null)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="button"
                  style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
                  disabled={cancel.isPending || !cancelling.reason.trim()}
                >
                  Konfirmasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Terbitkan Tagihan Massal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)} role="presentation">
          <div
            className="modal-window"
            style={{ maxWidth: 520, padding: 24 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-bulk-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 id="modal-bulk-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                  Terbitkan Tagihan Massal
                </h3>
                <small className="hint">
                  Gelombang: <strong>{selectedPeriodName}</strong>
                </small>
              </div>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                onClick={() => setShowBulkModal(false)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <form onSubmit={onSubmitBulk}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="field">
                  <span>Sasaran Calon Siswa *</span>
                  <select name="application_status" required defaultValue="ACCEPTED">
                    <option value="ACCEPTED">Semua Siswa yang Diterima (ACCEPTED)</option>
                    <option value="RE_REGISTRATION_VERIFIED">Siswa Daftar Ulang (RE_REGISTRATION_VERIFIED)</option>
                    <option value="VERIFIED">Siswa Lolos Berkas (VERIFIED)</option>
                  </select>
                  <small className="hint">
                    Siswa yang sudah memiliki tagihan aktif berjenis ini akan otomatis dilewati agar tidak terjadi duplikasi.
                  </small>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="field">
                    <span>Jenis Tagihan *</span>
                    <select name="type" required defaultValue="ENROLLMENT_FEE">
                      <option value="ENROLLMENT_FEE">Biaya Daftar Ulang (ENROLLMENT_FEE)</option>
                      <option value="REGISTRATION_FEE">Biaya Formulir (REGISTRATION_FEE)</option>
                      <option value="OTHER">Lainnya / Perlengkapan (OTHER)</option>
                    </select>
                  </label>

                  <label className="field">
                    <span>Nominal (Rp) *</span>
                    <input
                      name="amount"
                      inputMode="decimal"
                      pattern="\d+(\.\d{1,2})?"
                      required
                      placeholder="e.g. 2500000"
                    />
                    {bulkErrors.amount && <small className="error">{bulkErrors.amount}</small>}
                  </label>
                </div>

                <label className="field">
                  <span>Tanggal Jatuh Tempo (Opsional)</span>
                  <input name="due_date" type="date" />
                </label>

                <label className="field">
                  <span>Keterangan Tagihan</span>
                  <input
                    name="description"
                    placeholder="e.g. Uang Pangkal & Biaya Perlengkapan Sekolah TA 2026/2027"
                  />
                </label>

                <ErrorNote error={createBulk.error} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setShowBulkModal(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="button"
                    disabled={createBulk.isPending}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="check" size={14} />
                    {createBulk.isPending ? 'Menerbitkan…' : 'Terbitkan Sekarang'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buat Tagihan Perorangan */}
      {showSingleModal && (
        <div className="modal-overlay" onClick={() => setShowSingleModal(false)} role="presentation">
          <div
            className="modal-window"
            style={{ maxWidth: 520, padding: 24 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-single-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <h3 id="modal-single-title" style={{ margin: 0, fontSize: '1.15rem' }}>
                Buat Tagihan Perorangan
              </h3>
              <button
                type="button"
                className="button secondary"
                style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                onClick={() => setShowSingleModal(false)}
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <form onSubmit={onSubmitSingle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="field">
                  <span>Pilih Calon Siswa *</span>
                  <select
                    value={singleAppId}
                    onChange={(e) => setSingleAppId(e.target.value)}
                    required
                  >
                    <option value="">— Pilih Calon Siswa —</option>
                    {appOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.applicant_name} · {a.registration_number ?? 'DRAF'} · {a.status}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label className="field">
                    <span>Jenis Tagihan *</span>
                    <input
                      name="type"
                      list="invoice-types-list"
                      defaultValue="ENROLLMENT_FEE"
                      required
                      maxLength={50}
                    />
                    <datalist id="invoice-types-list">
                      <option value="REGISTRATION_FEE" />
                      <option value="ENROLLMENT_FEE" />
                      <option value="OTHER" />
                    </datalist>
                  </label>

                  <label className="field">
                    <span>Jumlah (Rp) *</span>
                    <input
                      name="amount"
                      inputMode="decimal"
                      pattern="\d+(\.\d{1,2})?"
                      required
                      placeholder="e.g. 1000000"
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Jatuh Tempo (Opsional)</span>
                  <input name="due_date" type="date" />
                </label>

                <label className="field">
                  <span>Keterangan</span>
                  <input name="description" placeholder="e.g. Uang Seragam & Buku" />
                </label>

                <ErrorNote error={createSingle.error} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setShowSingleModal(false)}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="button"
                    disabled={createSingle.isPending || !singleAppId}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Icon name="check" size={14} />
                    {createSingle.isPending ? 'Menyimpan…' : 'Buat Tagihan'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * Tab 3: Rekapitulasi Kas & Ekspor Data Pembayaran
 */
function FinanceReportsTab({
  selectedPeriodId,
  selectedPeriodName,
}: {
  selectedPeriodId: string
  selectedPeriodName: string
}) {
  const exportData = useQuery({
    queryKey: ['finance-export', selectedPeriodId],
    queryFn: () =>
      api<{ data: Payment[] }>(
        `/finance/export${selectedPeriodId ? `?period_id=${selectedPeriodId}` : ''}`
      ).catch(() => ({ data: [] })),
  })

  const payments = exportData.data?.data ?? []

  function handleDownloadCsv() {
    if (payments.length === 0) {
      alert('Tidak ada data pembayaran terverifikasi untuk diekspor.')
      return
    }

    const headers = [
      'No. Referensi',
      'No. Tagihan',
      'Nama Siswa',
      'No. Pendaftaran',
      'Nominal (Rp)',
      'Metode',
      'Waktu Bayar',
      'Status',
      'Petugas Verifikasi',
      'Waktu Verifikasi',
    ]

    const rows = payments.map((p) => [
      p.reference_number ?? '',
      p.invoice_number ?? '',
      p.applicant_name ?? '',
      p.registration_number ?? '',
      p.amount,
      p.method,
      p.paid_at ? new Date(p.paid_at).toLocaleString('id-ID') : '',
      p.status,
      p.verified_by_name ?? '',
      p.verified_at ? new Date(p.verified_at).toLocaleString('id-ID') : '',
    ])

    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`
    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((c) => escapeCsv(String(c))).join(','))
        .join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safePeriod = selectedPeriodName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    a.href = url
    a.download = `rekap_kas_masuk_${safePeriod}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const totalAmount = payments.reduce((acc, p) => acc + parseFloat(p.amount || '0'), 0)

  return (
    <section className="card" style={{ margin: 0 }}>
      <div
        className="card-header between"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}
      >
        <div>
          <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Rekap Arus Kas Masuk & Audit</h2>
          <small className="hint">
            Gelombang: <strong>{selectedPeriodName}</strong> • Rekapitulasi seluruh pembayaran yang telah disetujui.
          </small>
        </div>

        <button
          type="button"
          className="button"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          onClick={handleDownloadCsv}
          disabled={payments.length === 0}
        >
          <Icon name="database" size={14} /> Ekspor Data Pembayaran (.csv)
        </button>
      </div>

      {exportData.isPending ? (
        <p className="loading-indicator">Memuat data rekapitulasi pembayaran…</p>
      ) : payments.length > 0 ? (
        <>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              display: 'flex',
              gap: 20,
              fontSize: '0.85rem',
              marginBottom: 16,
            }}
          >
            <span>
              Total Transaksi Terverifikasi: <strong>{payments.length} transaksi</strong>
            </span>
            <span>
              Total Akumulasi Dana Masuk:{' '}
              <strong style={{ color: 'var(--brand)' }}>{rupiah(String(totalAmount))}</strong>
            </span>
          </div>

          <div className="table-wrapper" style={{ marginBottom: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '15%' }}>Waktu Verifikasi</th>
                  <th style={{ width: '15%' }}>No. Tagihan</th>
                  <th style={{ width: '25%' }}>Nama Calon Siswa</th>
                  <th style={{ width: '15%' }}>Nominal Terbayar</th>
                  <th style={{ width: '15%' }}>Metode & Ref</th>
                  <th style={{ width: '15%' }}>Diverifikasi Oleh</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        {p.verified_at
                          ? new Date(p.verified_at).toLocaleDateString('id-ID', {
                              dateStyle: 'medium',
                            })
                          : '—'}
                      </span>
                      {p.verified_at && (
                        <small className="hint" style={{ display: 'block', fontSize: '0.72rem' }}>
                          {new Date(p.verified_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </small>
                      )}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', background: 'var(--bg)', padding: '2px 5px', borderRadius: 4 }}>
                        {p.invoice_number ?? '—'}
                      </code>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.9rem', display: 'block' }}>
                        {p.applicant_name ?? '—'}
                      </strong>
                      <small style={{ fontFamily: 'monospace', color: 'var(--brand)', fontWeight: 600 }}>
                        {p.registration_number ?? 'DRAF'}
                      </small>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--brand)' }}>
                        {rupiah(p.amount)}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.825rem' }}>{p.method}</span>
                      {p.reference_number && (
                        <small className="hint" style={{ display: 'block', fontSize: '0.72rem' }}>
                          Ref: {p.reference_number}
                        </small>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>{p.verified_by_name || 'Petugas Keuangan'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <EmptyState
          title="Belum ada transaksi terverifikasi"
          description="Belum ada pembayaran yang disetujui pada gelombang ini."
        />
      )}
    </section>
  )
}

/**
 * Halaman Utama Keuangan Super Admin & Staf Keuangan
 */
export function FinancePage() {
  const { can } = useAuth()
  const canManage = can('payment.verify', 'application.override')

  const [activeTab, setActiveTab] = useState<'verification' | 'invoices' | 'reports'>('verification')
  const [selectedPeriodId, setSelectedPeriodId] = useState('')

  // Query periode gelombang pendaftaran
  const periods = useQuery({
    queryKey: ['periods-all'],
    queryFn: () =>
      api<{ id: string; name: string }[]>('/admission/periods', { auth: false }).catch(() => []),
  })

  const periodList = Array.isArray(periods.data) ? periods.data : []
  const currentPeriodId = selectedPeriodId || periodList[0]?.id || ''
  const selectedPeriodName =
    periodList.find((p) => p.id === currentPeriodId)?.name || 'Gelombang'

  // Query KPI summary keuangan
  const summary = useQuery({
    queryKey: ['finance-summary', currentPeriodId],
    queryFn: () =>
      api<FinanceSummary>(
        `/finance/summary${currentPeriodId ? `?period_id=${currentPeriodId}` : ''}`
      ).catch(() => null),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Keuangan & Pembayaran"
        description="Kelola antrean verifikasi bukti transfer, terbitkan tagihan daftar ulang perorangan/massal, dan pantau rekapitulasi arus kas."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label htmlFor="period-finance-select" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Gelombang:
            </label>
            <select
              id="period-finance-select"
              value={currentPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              style={{ fontSize: '0.85rem', minWidth: 180 }}
              aria-label="Periode"
            >
              {periodList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* KPI Cards Ringkasan Keuangan */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
        }}
      >
        <div className="card" style={{ margin: 0, padding: 16 }}>
          <span className="hint" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>
            Total Kas Masuk Terverifikasi
          </span>
          <strong style={{ fontSize: '1.35rem', color: 'var(--brand)' }}>
            {summary.data?.verified_amount ? rupiah(summary.data.verified_amount) : 'Rp 0'}
          </strong>
        </div>

        <div className="card" style={{ margin: 0, padding: 16 }}>
          <span className="hint" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>
            Menunggu Verifikasi Bukti
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong
              style={{
                fontSize: '1.35rem',
                color: (summary.data?.pending_payments ?? 0) > 0 ? 'var(--warning)' : 'var(--fg)',
              }}
            >
              {summary.data?.pending_payments ?? 0}
            </strong>
            {(summary.data?.pending_payments ?? 0) > 0 && (
              <span className="badge" style={{ background: 'var(--warning-light)', color: 'var(--warning)', fontWeight: 600, fontSize: '0.75rem' }}>
                Perlu Approval
              </span>
            )}
          </div>
        </div>

        <div className="card" style={{ margin: 0, padding: 16 }}>
          <span className="hint" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>
            Tagihan Belum Lunas
          </span>
          <strong style={{ fontSize: '1.35rem', color: 'var(--warning)' }}>
            {summary.data?.outstanding_invoices ?? 0} Tagihan
          </strong>
        </div>

        <div className="card" style={{ margin: 0, padding: 16 }}>
          <span className="hint" style={{ fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>
            Total Nilai Tagihan Terbit
          </span>
          <strong style={{ fontSize: '1.35rem', color: 'var(--fg)' }}>
            {summary.data?.total_invoiced_amount ? rupiah(summary.data.total_invoiced_amount) : 'Rp 0'}
          </strong>
        </div>
      </div>

      {/* Tab Switcher */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--line)',
          paddingBottom: 4,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className={activeTab === 'verification' ? 'button' : 'button secondary'}
          style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={() => setActiveTab('verification')}
        >
          <Icon name="check-circle" size={14} /> Antrean Verifikasi
          {(summary.data?.pending_payments ?? 0) > 0 && (
            <span
              style={{
                marginLeft: 4,
                padding: '1px 6px',
                borderRadius: 10,
                background: activeTab === 'verification' ? '#fff' : 'var(--warning)',
                color: activeTab === 'verification' ? 'var(--brand)' : '#fff',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              {summary.data?.pending_payments}
            </span>
          )}
        </button>

        {canManage && (
          <button
            type="button"
            className={activeTab === 'invoices' ? 'button' : 'button secondary'}
            style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => setActiveTab('invoices')}
          >
            <Icon name="database" size={14} /> Manajemen Tagihan & Invoice
          </button>
        )}

        <button
          type="button"
          className={activeTab === 'reports' ? 'button' : 'button secondary'}
          style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={() => setActiveTab('reports')}
        >
          <Icon name="bar-chart" size={14} /> Rekap Arus Kas & Ekspor
        </button>
      </div>

      {/* Konten Tab Aktif */}
      {activeTab === 'verification' && <PaymentQueue canManage={canManage} />}
      {activeTab === 'invoices' && canManage && (
        <InvoiceManagerUnified
          selectedPeriodId={currentPeriodId}
          selectedPeriodName={selectedPeriodName}
        />
      )}
      {activeTab === 'reports' && (
        <FinanceReportsTab
          selectedPeriodId={currentPeriodId}
          selectedPeriodName={selectedPeriodName}
        />
      )}
    </div>
  )
}
