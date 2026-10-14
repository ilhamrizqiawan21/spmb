import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { tokenStore } from './lib/api'
import type { ReportSummary, User } from './types/api'

const user = (permissions: string[]): User => ({ id: 'u1', name: 'Staf', email: 's@x.test', phone: null, is_active: true, roles: [], permissions })

const summary = (over: Partial<ReportSummary> = {}): ReportSummary => ({
  total: 12,
  by_status: { DRAFT: 2 },
  funnel: [
    { key: 'registered', label: 'Registrasi', total: 12 },
    { key: 'enrolled', label: 'Enrolled', total: 3 },
  ],
  work_queue: { awaiting_verification: 4, revision_required: 1, awaiting_decision: 0, re_registration_in_progress: 2, awaiting_enrollment: 1 },
  periods: [{ id: 'p1', name: 'Gelombang 1', academic_year_name: '2026/2027', quota: 10, applications: 12, accepted: 6, enrolled: 3, remaining_quota: 4 }],
  top_schools: [{ value: 'SD Negeri 1', total: 5 }],
  top_cities: [],
  finance: null,
  ...over,
})

type Call = { url: string; init?: RequestInit }
function mockApi(routes: Record<string, unknown>, calls: Call[] = []) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    const key = Object.keys(routes).find((k) => url.includes(k))
    return new Response(JSON.stringify(key ? routes[key] : {}), { status: 200 })
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

describe('staff dashboard', () => {
  it('is hidden from parents', async () => {
    mockApi({ '/auth/me': user([]) })
    window.history.pushState({}, '', '/ringkasan')
    render(<App />)
    expect(await screen.findByText(/tidak memiliki akses/)).toBeInTheDocument()
  })

  it('shows tiles, funnel, quota and only the exports the user may download', async () => {
    mockApi({ '/auth/me': user(['application.read', 'document.verify']), '/reports/summary': summary(), '/admission/periods': [] })
    window.history.pushState({}, '', '/ringkasan')
    render(<App />)

    expect(await screen.findByText('Menunggu verifikasi')).toBeInTheDocument()
    expect(screen.getByLabelText('Funnel pendaftaran')).toHaveTextContent('Registrasi12')
    expect(screen.getByText('SD Negeri 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ekspor Pendaftar (CSV)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ekspor Pembayaran (CSV)' })).not.toBeInTheDocument()
    expect(screen.queryByText('Tagihan belum lunas')).not.toBeInTheDocument()
  })

  it('refetches the summary for the chosen period', async () => {
    const calls = mockApi({
      '/auth/me': user(['application.read']),
      '/reports/summary': summary({ finance: { pending_payments: 2, outstanding_invoices: 1, paid_invoices: 0, verified_amount: '0.00' } }),
      '/admission/periods': [{ id: 'p1', academic_year_id: 'y', name: 'Gelombang 1', code: 'G1', registration_start: '', registration_end: '', announcement_at: null, quota: 10, is_active: true }],
    })
    window.history.pushState({}, '', '/ringkasan')
    render(<App />)

    expect(await screen.findByText('Tagihan belum lunas')).toBeInTheDocument()
    await userEvent.selectOptions(await screen.findByLabelText('Gelombang'), 'p1')
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/reports/summary?admission_period_id=p1'))).toBe(true))
  })
})
