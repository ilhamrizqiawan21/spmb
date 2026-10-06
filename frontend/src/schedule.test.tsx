import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScheduleCard } from './pages/ReRegistrationCard'
import { ScheduleSection } from './pages/ScheduleSection'
import type { Application, SelectionComponent } from './types/api'

const app = (status: string): Application => ({
  id: 'a1', applicant_id: 'p1', applicant_name: 'Budi', admission_period_id: 'per1', period_name: 'G1',
  registration_number: 'REG-1', status, current_step: 5, completion_percentage: 100, status_histories: [],
})
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('assessment schedule', () => {
  it('parent sees the schedule only when one exists', async () => {
    const schedule = { id: 's1', application_id: 'a1', component_id: 'c1', component_name: 'Wawancara', scheduled_at: '2026-12-01T02:00:00.000000Z', location: 'Aula', room: 'R1', notes: null, status: 'SCHEDULED', registration_number: 'REG-1', applicant_name: 'Budi' }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify([schedule]), { status: 200 }))
    wrap(<ScheduleCard application={app('ASSESSMENT_SCHEDULED')} />)
    expect(await screen.findByText('Wawancara')).toBeInTheDocument()
    expect(screen.getByText('Aula / R1')).toBeInTheDocument()
  })

  it('parent sees nothing for an empty schedule', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('[]', { status: 200 }))
    const { container } = wrap(<ScheduleCard application={app('VERIFIED')} />)
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('staff creates a schedule with a UTC timestamp', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      calls.push({ url: String(input), init })
      return new Response(init?.method === 'POST' ? '{}' : '[]', { status: init?.method === 'POST' ? 201 : 200 })
    })
    const comps: SelectionComponent[] = [{ id: 'c1', admission_period_id: 'per1', name: 'Wawancara', code: 'INT', weight: '40.00', max_score: '100.00' }]
    wrap(<ScheduleSection periodId="per1" applications={[app('VERIFIED')]} components={comps} />)

    await userEvent.selectOptions(await screen.findByLabelText(/Pendaftar/), 'a1')
    await userEvent.selectOptions(screen.getByLabelText(/Komponen/), 'c1')
    await userEvent.type(screen.getByLabelText(/Waktu/), '2026-12-01T09:00')
    await userEvent.type(screen.getByLabelText(/Ruang/), 'R1')
    await userEvent.click(screen.getByRole('button', { name: 'Jadwalkan' }))

    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true))
    const body = JSON.parse(String(calls.find((c) => c.init?.method === 'POST')!.init!.body))
    expect(body).toMatchObject({ application_id: 'a1', component_id: 'c1', room: 'R1', location: null })
    expect(body.scheduled_at).toBe(new Date('2026-12-01T09:00').toISOString())
  })
})
