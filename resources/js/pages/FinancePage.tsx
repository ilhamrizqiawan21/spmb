import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Field, StatusBadge } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { useAuth } from '../features/auth/AuthContext'
import { api, openBlob } from '../lib/api'
import { rupiah } from '../lib/money'
import type { Application, Invoice, PaymentPage } from '../types/api'

const STATUS_FILTERS = [
  { value: 'PENDING', label: 'Menunggu verifikasi' },
  { value: 'PAID', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: '', label: 'Semua' },
]

function PaymentQueue({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDING')
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null)

  const payments = useQuery({
    queryKey: ['payments', status],
    queryFn: () => api<PaymentPage>(`/finance/payments${status ? `?status=${status}` : ''}`),
  })
  const proof = useMutation({ mutationFn: (id: string) => openBlob(`/finance/payments/${id}/proof`) })
  const verify = useMutation({
    mutationFn: (v: { id: string; approved: boolean; note?: string }) =>
      api(`/finance/payments/${v.id}/verify`, { method: 'POST', body: { approved: v.approved, note: v.note || null } }),
    onSuccess: async () => {
      setRejecting(null)
      await qc.invalidateQueries({ queryKey: ['payments'] })
      await qc.invalidateQueries({ queryKey: ['finance-invoices'] })
    },
  })

  return (
    <section className="card">
      <h1>Keuangan</h1>
      <h2>Verifikasi Pembayaran</h2>
      <label className="field">
        <span>Tampilkan</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </label>
      <table>
        <thead>
          <tr><th>Tagihan</th><th>Pendaftar</th><th>Jumlah</th><th>Referensi</th><th>Status</th><th>Aksi</th></tr>
        </thead>
        <tbody>
          {payments.data?.data.map((p) => (
            <tr key={p.id}>
              <td>{p.invoice_number}</td>
              <td>{p.applicant_name}<br /><small>{p.registration_number}</small></td>
              <td>{rupiah(p.amount)}</td>
              <td>{p.reference_number}</td>
              <td>
                <StatusBadge status={p.status} />
                {p.verification_note && <><br /><small>{p.verification_note}</small></>}
              </td>
              <td>
                {p.has_proof && <button className="link" onClick={() => proof.mutate(p.id)}>Bukti</button>}{' '}
                {canManage && p.status === 'PENDING' && (
                  <>
                    <button onClick={() => verify.mutate({ id: p.id, approved: true })} disabled={verify.isPending}>Setujui</button>{' '}
                    <button className="secondary" onClick={() => setRejecting({ id: p.id, note: '' })}>Tolak</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {payments.data && payments.data.data.length === 0 && <p>Tidak ada pembayaran.</p>}
      {rejecting && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            verify.mutate({ id: rejecting.id, approved: false, note: rejecting.note })
          }}
        >
          <label className="field">
            <span>Alasan penolakan</span>
            <textarea required value={rejecting.note} onChange={(e) => setRejecting({ ...rejecting, note: e.target.value })} />
          </label>
          <button disabled={verify.isPending}>Konfirmasi penolakan</button>{' '}
          <button type="button" className="secondary" onClick={() => setRejecting(null)}>Batal</button>
        </form>
      )}
      <ErrorNote error={payments.error ?? verify.error ?? proof.error} />
    </section>
  )
}

function InvoiceList({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient()
  const [cancelling, setCancelling] = useState<{ id: string; reason: string } | null>(null)
  const invoices = useQuery({
    queryKey: ['finance-invoices', applicationId],
    queryFn: () => api<Invoice[]>(`/finance/applications/${applicationId}/invoices`),
  })
  const cancel = useMutation({
    mutationFn: (v: { id: string; reason: string }) => api(`/finance/invoices/${v.id}/cancel`, { method: 'POST', body: { reason: v.reason } }),
    onSuccess: async () => {
      setCancelling(null)
      await qc.invalidateQueries({ queryKey: ['finance-invoices', applicationId] })
    },
  })

  if (!invoices.data) return null
  if (invoices.data.length === 0) return <p>Belum ada tagihan untuk pendaftar ini.</p>

  return (
    <>
      <table>
        <thead>
          <tr><th>No.</th><th>Jenis</th><th>Total</th><th>Terbayar</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {invoices.data.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.invoice_number}</td>
              <td>{inv.description || inv.type}</td>
              <td>{rupiah(inv.amount)}</td>
              <td>{rupiah(inv.paid_amount)}</td>
              <td><StatusBadge status={inv.status} /></td>
              <td>
                {inv.status !== 'CANCELLED' && inv.status !== 'PAID' && (
                  <button className="secondary" onClick={() => setCancelling({ id: inv.id, reason: '' })}>Bebaskan / batalkan</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cancelling && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            cancel.mutate(cancelling)
          }}
        >
          <label className="field">
            <span>Alasan pembebasan/pembatalan (wajib, tercatat di audit)</span>
            <textarea required value={cancelling.reason} onChange={(e) => setCancelling({ ...cancelling, reason: e.target.value })} />
          </label>
          <button disabled={cancel.isPending}>Konfirmasi</button>{' '}
          <button type="button" className="secondary" onClick={() => setCancelling(null)}>Batal</button>
        </form>
      )}
      <ErrorNote error={cancel.error} />
    </>
  )
}

function InvoiceManager() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const applications = useQuery({ queryKey: ['applications-staff'], queryFn: () => api<Application[]>('/admission/applications') })

  const needle = search.trim().toLowerCase()
  const options = (applications.data ?? [])
    .filter((a) => !needle || `${a.applicant_name} ${a.registration_number ?? ''}`.toLowerCase().includes(needle))
    .slice(0, 50)

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(`/finance/applications/${applicationId}/invoices`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finance-invoices', applicationId] }),
  })

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const due = String(f.get('due_date') || '')
    create.mutate(
      {
        type: String(f.get('type')),
        amount: String(f.get('amount')),
        due_date: due ? new Date(`${due}T23:59:59+07:00`).toISOString() : null,
        description: String(f.get('description') || '') || null,
      },
      { onSuccess: () => form.reset() },
    )
  }

  return (
    <section className="card">
      <h2>Tagihan Pendaftar</h2>
      <Field label="Cari pendaftar (nama / no. pendaftaran)" value={search} onChange={(e) => setSearch(e.target.value)} />
      <label className="field">
        <span>Pendaftar</span>
        <select value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
          <option value="">— pilih pendaftar —</option>
          {options.map((a) => (
            <option key={a.id} value={a.id}>{a.applicant_name} · {a.registration_number ?? 'draf'} · {a.status}</option>
          ))}
        </select>
      </label>
      {applicationId && (
        <>
          <InvoiceList applicationId={applicationId} />
          <form onSubmit={onSubmit}>
            <h3>Buat tagihan baru</h3>
            <Field label="Jenis tagihan" name="type" list="invoice-types" defaultValue="ENROLLMENT_FEE" required maxLength={50} />
            <datalist id="invoice-types">
              <option value="REGISTRATION_FEE" />
              <option value="ENROLLMENT_FEE" />
              <option value="OTHER" />
            </datalist>
            <Field label="Jumlah (Rp)" name="amount" inputMode="decimal" pattern="\d+(\.\d{1,2})?" required />
            <Field label="Jatuh tempo (opsional)" name="due_date" type="date" />
            <Field label="Keterangan" name="description" />
            <ErrorNote error={create.error} />
            <button disabled={create.isPending}>Buat tagihan</button>
          </form>
        </>
      )}
    </section>
  )
}

export function FinancePage() {
  const { can } = useAuth()
  const canManage = can('payment.verify', 'application.override')
  return (
    <>
      <PaymentQueue canManage={canManage} />
      {canManage && <InvoiceManager />}
    </>
  )
}
