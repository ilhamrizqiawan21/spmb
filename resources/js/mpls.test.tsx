import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { tokenStore } from './lib/api'
import { MplsCard } from './pages/mpls/MplsCard'
import type { Application, MplsEvent, MplsParticipant, MplsRoster, User } from './types/api'

const user = (permissions: string[]): User => ({ id: 'u1', name: 'Staf', email: 's@x.test', phone: null, is_active: true, roles: [], permissions })

const participant: MplsParticipant = {
  id: 'mp1', student_id: 's1', student_number: '2026.001', full_name: 'Budi', group_id: 'g1', group_name: 'Kelompok A',
  group_code: 'A', mentor_name: 'Bu Sari', status: 'ACTIVE', joined_at: '2026-07-01T00:00:00Z', completed_at: null,
  attendance: { present: 1, sick: 0, permitted: 0, absent: 0 },
}

const event: MplsEvent = {
  id: 'e1', academic_year_id: 'y1', group_id: null, group_name: null, title: 'Pengenalan sekolah', description: null,
  start_at: '2026-07-13T00:00:00Z', end_at: '2026-07-13T03:00:00Z', location: 'Aula', is_mandatory: true,
}

const roster: MplsRoster = {
  event,
  rows: [{ participant_id: 'mp1', student_number: '2026.001', full_name: 'Budi', group_name: 'Kelompok A', attendance: null }],
}

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

describe('MPLS staff page', () => {
  const routes = {
    '/auth/me': user(['mpls.manage']),
    '/admission/academic-years': [{ id: 'y1', name: '2026/2027', is_active: true }],
    '/mpls/groups': [{ id: 'g1', academic_year_id: 'y1', academic_year_name: '2026/2027', name: 'Kelompok A', code: 'A', capacity: 30, participant_count: 1, mentor_name: 'Bu Sari', description: null }],
    '/mpls/participants/unassigned': [],
    '/mpls/events/e1/attendance': roster,
    '/mpls/events': [event],
    '/mpls/attendance': { attendance: { id: 'at1', event_id: 'e1', participant_id: 'mp1', full_name: 'Budi', status: 'PRESENT', checked_at: null, checked_by_name: null, notes: null }, already_recorded: false },
  }

  it('is hidden from users without mpls.manage', async () => {
    mockApi({ '/auth/me': user(['enrollment.manage']) })
    window.history.pushState({}, '', '/mpls')
    render(<App />)
    expect(await screen.findByText(/tidak memiliki akses/)).toBeInTheDocument()
  })

  it('lists groups of the active academic year', async () => {
    const calls = mockApi(routes)
    window.history.pushState({}, '', '/mpls')
    render(<App />)
    expect(await screen.findByText('Bu Sari')).toBeInTheDocument()
    expect(screen.getByText('1 / 30')).toBeInTheDocument()
    expect(calls.some((c) => c.url.includes('/mpls/groups?academic_year_id=y1'))).toBe(true)
  })

  it('records attendance by scanned QR token and manually', async () => {
    const calls = mockApi(routes)
    window.history.pushState({}, '', '/mpls')
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Presensi' }))
    await userEvent.selectOptions(await screen.findByLabelText('Kegiatan'), 'e1')
    await userEvent.type(await screen.findByLabelText('Scan / tempel kode QR'), 'TOKEN123{Enter}')
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/mpls/attendance/scan'))).toBe(true))
    const scan = calls.find((c) => c.url.endsWith('/scan'))!
    expect(JSON.parse(String(scan.init!.body))).toEqual({ event_id: 'e1', qr_token: 'TOKEN123' })
    expect(await screen.findByText(/Budi: hadir/)).toBeInTheDocument()

    await userEvent.selectOptions(await screen.findByLabelText('Presensi Budi'), 'SICK')
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/mpls/attendance') && c.init?.method === 'POST')).toBe(true))
    const manual = calls.find((c) => c.url.endsWith('/mpls/attendance'))!
    expect(JSON.parse(String(manual.init!.body))).toEqual({ event_id: 'e1', participant_id: 'mp1', status: 'SICK' })
  })
})

describe('parent MPLS card', () => {
  const app = (status: Application['status']): Application => ({
    id: 'a1', applicant_id: 'p1', applicant_name: 'Budi', admission_period_id: 'per1', period_name: 'G1',
    registration_number: 'REG-1', status, current_step: 5, completion_percentage: 100, status_histories: [],
  })
  const wrap = (ui: React.ReactNode) =>
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

  it('shows group, QR and schedule with own attendance', async () => {
    mockApi({ '/mpls/applications/a1': { data: { participant: { ...participant, qr_token: 'abc' }, events: [{ ...event, attendance_status: 'PRESENT' }] } } })
    wrap(<MplsCard application={app('MPLS_ACTIVE')} />)
    expect(await screen.findByText('A — Kelompok A')).toBeInTheDocument()
    expect(screen.getByAltText('Kode QR presensi MPLS')).toHaveAttribute('src', expect.stringMatching(/^data:image\/gif;base64,/))
    expect(screen.getByText('Pengenalan sekolah')).toBeInTheDocument()
    expect(screen.getByText('(Hadir)')).toBeInTheDocument()
  })

  it('does not query before the student joins MPLS', () => {
    const calls = mockApi({})
    const { container } = wrap(<MplsCard application={app('ENROLLED')} />)
    expect(container).toBeEmptyDOMElement()
    expect(calls).toHaveLength(0)
  })
})
