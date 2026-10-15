import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { tokenStore } from './lib/api'
import { StudentCard } from './pages/ReRegistrationCard'
import type { Application, EnrollmentCandidate, Student, User } from './types/api'

const user = (permissions: string[]): User => ({ id: 'u1', name: 'Staf', email: 's@x.test', phone: null, is_active: true, roles: [], permissions })

const candidate: EnrollmentCandidate = {
  application_id: 'a1', registration_number: 'REG-1', applicant_name: 'Budi', nisn: '0141234567',
  admission_period_name: 'Gelombang 1', status: 'RE_REGISTRATION_VERIFIED',
}

const student: Student = {
  id: 's1', student_number: '2026.001', nisn: '0141234567', full_name: 'Budi', gender: 'MALE', birth_place: 'Bandung',
  birth_date: '2014-05-17', status: 'ACTIVE',
  enrollment: { id: 'e1', status: 'ACTIVE', enrolled_at: '2026-10-14T00:00:00Z', enrolled_by_name: 'Admin', notes: null },
  application_id: 'a1', registration_number: 'REG-1', admission_period_name: 'Gelombang 1', academic_year_name: '2026/2027',
  created_at: '2026-10-14T00:00:00Z',
}

type Call = { url: string; init?: RequestInit }
function mockApi(routes: Record<string, unknown>, calls: Call[] = [], status: (c: Call) => number = () => 200) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = { url: String(input), init }
    calls.push(call)
    const key = Object.keys(routes).find((k) => call.url.includes(k))
    return new Response(JSON.stringify(key ? routes[key] : {}), { status: status(call) })
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

describe('students page', () => {
  const routes = (eligible: EnrollmentCandidate[]) => ({
    '/auth/me': user(['enrollment.manage']),
    '/enrollment/eligible': eligible,
    '/enrollment/students': { data: [student], meta: { page: 1, per_page: 50, total: 1 } },
  })

  it('is hidden from users without an enrollment permission', async () => {
    mockApi({ '/auth/me': user(['payment.verify']) })
    window.history.pushState({}, '', '/siswa')
    render(<App />)
    expect(await screen.findByText(/tidak memiliki akses/)).toBeInTheDocument()
  })

  it('enrolls a candidate with the typed NIS', async () => {
    const calls = mockApi(routes([candidate]))
    window.history.pushState({}, '', '/siswa')
    render(<App />)

    expect(await screen.findByText('2026.001')).toBeInTheDocument()
    await userEvent.click(await screen.findByRole('button', { name: 'Jadikan siswa' }))
    await userEvent.type(screen.getByLabelText('NIS'), '2026.002')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/enrollment/applications/a1/enroll'))).toBe(true))
    const enroll = calls.find((c) => c.url.endsWith('/enroll'))!
    expect(JSON.parse(String(enroll.init!.body))).toEqual({ student_number: '2026.002', notes: null })
  })

  it('shows a duplicate NIS error next to the field', async () => {
    const routesWithError = {
      ...routes([candidate]),
      '/enroll': { error: { code: 'VALIDATION_ERROR', message: 'dup', details: { student_number: ["Student number '1' is already in use."] } } },
    }
    mockApi(routesWithError, [], (c) => (c.url.endsWith('/enroll') ? 400 : 200))
    window.history.pushState({}, '', '/siswa')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Jadikan siswa' }))
    await userEvent.type(screen.getByLabelText('NIS'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByText("Student number '1' is already in use.")).toBeInTheDocument()
  })

  it('lets MPLS officers read the list without enrollment actions', async () => {
    mockApi({ ...routes([candidate]), '/auth/me': user(['mpls.manage']) })
    window.history.pushState({}, '', '/siswa')
    render(<App />)
    expect(await screen.findByText('2026.001')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Jadikan siswa' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Koreksi NIS' })).not.toBeInTheDocument()
  })
})

describe('parent student card', () => {
  const app = (status: Application['status']): Application => ({
    id: 'a1', applicant_id: 'p1', applicant_name: 'Budi', admission_period_id: 'per1', period_name: 'G1',
    registration_number: 'REG-1', status, current_step: 5, completion_percentage: 100, status_histories: [],
  })
  const wrap = (ui: React.ReactNode) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

  it('shows the NIS once enrolled', async () => {
    mockApi({ '/student': { data: student } })
    wrap(<StudentCard application={app('ENROLLED')} />)
    expect(await screen.findByText('2026.001')).toBeInTheDocument()
  })

  it('does not query before enrollment', () => {
    const calls = mockApi({})
    const { container } = wrap(<StudentCard application={app('RE_REGISTRATION_VERIFIED')} />)
    expect(container).toBeEmptyDOMElement()
    expect(calls).toHaveLength(0)
  })
})
