import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { tokenStore } from './lib/api'
import { PaymentCard } from './pages/PaymentCard'
import type { Application, Invoice, Payment, User } from './types/api'

const application: Application = {
  id: 'a1', applicant_id: 'p1', applicant_name: 'Budi', admission_period_id: 'per1', period_name: 'G1',
  registration_number: 'REG-1', status: 'ACCEPTED', current_step: 5, completion_percentage: 100, status_histories: [],
}

const payment = (over: Partial<Payment> = {}): Payment => ({
  id: 'pay1', invoice_id: 'inv1', invoice_number: 'INV-202610-AAAAAA', application_id: 'a1', registration_number: 'REG-1',
  applicant_name: 'Budi', amount: '400000.00', method: 'BANK_TRANSFER', reference_number: 'TRX-9', status: 'PENDING',
  paid_at: null, has_proof: true, proof_filename: 'bukti.pdf', verified_at: null, verified_by_name: null,
  verification_note: null, created_at: '2026-10-06T00:00:00Z', ...over,
})

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'inv1', application_id: 'a1', invoice_number: 'INV-202610-AAAAAA', type: 'ENROLLMENT_FEE', amount: '1000000.00',
  paid_amount: '0.00', balance: '1000000.00', due_date: null, status: 'UNPAID', description: 'Uang pangkal', payments: [],
  created_at: '2026-10-06T00:00:00Z', ...over,
})

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

const user = (permissions: string[]): User => ({ id: 'u1', name: 'Staf', email: 's@x.test', phone: null, is_active: true, roles: [], permissions })

type Call = { url: string; init?: RequestInit }
function mockApi(routes: Record<string, unknown>, calls: Call[] = []) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    const key = Object.keys(routes).find((k) => url.includes(k))
    return new Response(JSON.stringify(key ? routes[key] : {}), { status: init?.method === 'POST' ? 201 : 200 })
  })
  return calls
}

beforeEach(() => tokenStore.set('t'))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  tokenStore.set(null)
  window.history.pushState({}, '', '/')
})

describe('parent payment card', () => {
  it('renders nothing when the application has no invoices', async () => {
    const calls = mockApi({ '/invoices': [] })
    const { container } = wrap(<PaymentCard application={application} />)
    await waitFor(() => expect(calls.length).toBeGreaterThan(0))
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the invoice in Rupiah and uploads a proof as multipart with the remaining balance', async () => {
    const calls = mockApi({ '/finance/applications/a1/invoices': [invoice()], '/finance/invoices/inv1/payments': payment() })
    wrap(<PaymentCard application={application} />)

    expect(await screen.findByText(/Uang pangkal/)).toBeInTheDocument()
    expect(screen.getByText(/Total/).textContent).toMatch(/Rp\s?1\.000\.000/)

    const amount = screen.getByLabelText(/Jumlah ditransfer/) as HTMLInputElement
    expect(amount.value).toBe('1000000.00')
    await userEvent.clear(amount)
    await userEvent.type(amount, '400000')
    await userEvent.type(screen.getByLabelText(/Nomor referensi/), 'TRX-9')
    const file = new File(['%PDF-1.4'], 'bukti.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText(/Bukti transfer/), file)
    // jsdom does not count user-event's uploaded files for `required` validation, so submit the form directly.
    fireEvent.submit(screen.getByRole('button', { name: 'Kirim bukti pembayaran' }).closest('form')!)

    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true))
    const post = calls.find((c) => c.init?.method === 'POST')!
    expect(post.url).toBe('/api/v1/finance/invoices/inv1/payments')
    const form = post.init!.body as FormData
    expect(form.get('amount')).toBe('400000')
    expect(form.get('method')).toBe('BANK_TRANSFER')
    expect(form.get('reference_number')).toBe('TRX-9')
    // jsdom's FormData ignores user-event's uploaded file contents/name, so only check the field is a file part.
    expect(form.get('proof')).toBeInstanceOf(File)
    expect(form.has('paid_at')).toBe(false)
  })

  it('shows a waiting note instead of the form when pending payments cover the balance', async () => {
    mockApi({ '/invoices': [invoice({ payments: [payment({ amount: '1000000.00' })] })] })
    wrap(<PaymentCard application={application} />)

    expect(await screen.findByText(/menunggu verifikasi petugas keuangan/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kirim bukti pembayaran' })).not.toBeInTheDocument()
  })

  it('shows the finance note of a rejected payment and keeps the form available', async () => {
    mockApi({ '/invoices': [invoice({ payments: [payment({ status: 'REJECTED', verification_note: 'Nominal tidak sesuai' })] })] })
    wrap(<PaymentCard application={application} />)

    expect(await screen.findByText('Nominal tidak sesuai')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kirim bukti pembayaran' })).toBeInTheDocument()
  })
})

describe('finance page', () => {
  const routes = (queue: Payment[]) => ({
    '/auth/me': user(['payment.verify', 'payment.read']),
    '/finance/payments': { data: queue, meta: { page: 1, per_page: 50, total: queue.length } },
    '/admission/applications': [],
  })

  it('is hidden from users without a payment permission', async () => {
    mockApi({ '/auth/me': user(['assessment.input']) })
    window.history.pushState({}, '', '/keuangan')
    render(<App />)
    expect(await screen.findByText(/tidak memiliki akses/)).toBeInTheDocument()
  })

  it('approves a pending payment', async () => {
    const calls = mockApi(routes([payment()]))
    window.history.pushState({}, '', '/keuangan')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Setujui' }))
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/finance/payments/pay1/verify'))).toBe(true))
    const verify = calls.find((c) => c.url.endsWith('/verify'))!
    expect(JSON.parse(String(verify.init!.body))).toEqual({ approved: true, note: null })
  })

  it('requires a reason to reject', async () => {
    const calls = mockApi(routes([payment()]))
    window.history.pushState({}, '', '/keuangan')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Tolak' }))
    await userEvent.type(screen.getByLabelText('Alasan penolakan'), 'Bukti tidak terbaca')
    await userEvent.click(screen.getByRole('button', { name: 'Konfirmasi penolakan' }))

    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/verify'))).toBe(true))
    expect(JSON.parse(String(calls.find((c) => c.url.endsWith('/verify'))!.init!.body))).toEqual({ approved: false, note: 'Bukti tidak terbaca' })
  })

  it('read-only staff see the queue without action buttons or the invoice form', async () => {
    mockApi({ ...routes([payment()]), '/auth/me': user(['payment.read']) })
    window.history.pushState({}, '', '/keuangan')
    render(<App />)

    expect(await screen.findByText('INV-202610-AAAAAA')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Setujui' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tagihan Pendaftar' })).not.toBeInTheDocument()
  })
})
