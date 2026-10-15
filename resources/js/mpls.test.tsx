import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { tokenStore } from './lib/api'
import { MplsCard } from './pages/mpls/MplsCard'
import type { Application, MplsEvent, MplsParticipant, User } from './types/api'

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
    '/mpls/participants': {
      data: [participant],
      meta: { page: 1, per_page: 50, total: 1 },
    },
    '/mpls/events': [event],
  }

  it('is hidden from users without mpls.manage', async () => {
    mockApi({ '/auth/me': user(['enrollment.manage']) })
    window.history.pushState({}, '', '/mpls')
    render(<App />)
    expect(await screen.findByText(/tidak memiliki akses/)).toBeInTheDocument()
  })

  it('lists groups of the active academic year at the top', async () => {
    const calls = mockApi(routes)
    window.history.pushState({}, '', '/mpls')
    render(<App />)
    expect(await screen.findByText('Daftar Kelompok Siswa')).toBeInTheDocument()
    expect(await screen.findByText('Bu Sari')).toBeInTheDocument()
    expect(screen.getByText('1 / 30')).toBeInTheDocument()
    expect(calls.some((c) => c.url.includes('/mpls/groups?academic_year_id=y1'))).toBe(true)
  })

  it('displays candidate students below with group code and mentor, without attendance menu', async () => {
    mockApi(routes)
    window.history.pushState({}, '', '/mpls')
    render(<App />)

    // Presensi menu does not exist
    expect(screen.queryByRole('button', { name: 'Presensi' })).not.toBeInTheDocument()

    // Candidate students section is rendered below groups
    expect(await screen.findByText('Daftar Calon Siswa Baru MPLS')).toBeInTheDocument()
    expect(await screen.findByText('Budi')).toBeInTheDocument()
    expect(screen.getByText('2026.001')).toBeInTheDocument()

    // Candidate student row displays group code and mentor name
    const codeBadges = screen.getAllByText('A')
    expect(codeBadges.length).toBeGreaterThanOrEqual(1)
    const mentorCells = screen.getAllByText('Bu Sari')
    expect(mentorCells.length).toBeGreaterThanOrEqual(2) // 1 in groups table, 1 in students table
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
