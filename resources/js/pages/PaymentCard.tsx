import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, type FormEvent } from 'react'
import { Field, StatusBadge } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { api, openBlob } from '../lib/api'
import { cents, fromCents, rupiah } from '../lib/money'
import type { Application, Invoice } from '../types/api'

const PAYABLE = ['UNPAID', 'PARTIALLY_PAID']

function PaymentForm({ invoice, applicationId }: { invoice: Invoice; applicationId: string }) {
  const qc = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const reserved = invoice.payments.filter((p) => p.status === 'PENDING').reduce((sum, p) => sum + cents(p.amount), 0)
  const remaining = cents(invoice.balance) - reserved

  const submit = useMutation({
    mutationFn: (form: FormData) => api(`/finance/invoices/${invoice.id}/payments`, { method: 'POST', form }),
    onSuccess: async () => {
      formRef.current?.reset()
      await qc.invalidateQueries({ queryKey: ['invoices', applicationId] })
    },
  })

  if (remaining <= 0) return <p>Pembayaran Anda sedang menunggu verifikasi petugas keuangan.</p>

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    form.set('method', 'BANK_TRANSFER')
    for (const key of ['reference_number', 'paid_at']) if (!form.get(key)) form.delete(key)
    submit.mutate(form)
  }

  return (
    <form ref={formRef} onSubmit={onSubmit}>
      <h3>Unggah bukti pembayaran</h3>
      <Field label="Jumlah ditransfer (Rp)" name="amount" inputMode="decimal" pattern="\d+(\.\d{1,2})?" defaultValue={fromCents(remaining)} required />
      <Field label="Nomor referensi / berita transfer" name="reference_number" />
      <Field label="Tanggal transfer" name="paid_at" type="date" />
      <Field label="Bukti transfer (PDF/JPG/PNG, maks. 2 MB)" name="proof" type="file" accept=".pdf,.jpg,.jpeg,.png" required />
      <ErrorNote error={submit.error} />
      <button disabled={submit.isPending}>{submit.isPending ? 'Mengunggah…' : 'Kirim bukti pembayaran'}</button>
    </form>
  )
}

function InvoiceBlock({ invoice, applicationId, onProof }: { invoice: Invoice; applicationId: string; onProof: (paymentId: string) => void }) {
  return (
    <article className="invoice">
      <h3>{invoice.description || invoice.type} <StatusBadge status={invoice.status} /></h3>
      <p>
        No. {invoice.invoice_number} · Total <strong>{rupiah(invoice.amount)}</strong> · Terbayar {rupiah(invoice.paid_amount)} · Sisa {rupiah(invoice.balance)}
        {invoice.due_date && <> · Jatuh tempo {new Date(invoice.due_date).toLocaleDateString('id-ID')}</>}
      </p>
      {invoice.payments.length > 0 && (
        <table>
          <thead>
            <tr><th>Jumlah</th><th>Status</th><th>Catatan petugas</th><th></th></tr>
          </thead>
          <tbody>
            {invoice.payments.map((p) => (
              <tr key={p.id}>
                <td>{rupiah(p.amount)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{p.verification_note}</td>
                <td>{p.has_proof && <button className="link" onClick={() => onProof(p.id)}>Lihat bukti</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {PAYABLE.includes(invoice.status) && <PaymentForm invoice={invoice} applicationId={applicationId} />}
      {invoice.status === 'EXPIRED' && <p className="error">Tagihan ini sudah melewati jatuh tempo. Hubungi panitia.</p>}
    </article>
  )
}

/** Invoices and proof-of-payment upload for the parent. Hidden when the application has no invoices. */
export function PaymentCard({ application }: { application: Application }) {
  const invoices = useQuery({
    queryKey: ['invoices', application.id],
    queryFn: () => api<Invoice[]>(`/finance/applications/${application.id}/invoices`),
  })
  const proof = useMutation({ mutationFn: (paymentId: string) => openBlob(`/finance/payments/${paymentId}/proof`) })

  if (!invoices.data?.length) return null

  return (
    <section className="card">
      <h2>Pembayaran</h2>
      <p>Lakukan transfer sesuai petunjuk dari panitia, lalu unggah bukti transfer di bawah ini. Petugas keuangan akan memverifikasinya.</p>
      {invoices.data.map((inv) => (
        <InvoiceBlock key={inv.id} invoice={inv} applicationId={application.id} onProof={(id) => proof.mutate(id)} />
      ))}
      <ErrorNote error={proof.error} />
    </section>
  )
}
