import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReRegistrationCard } from './pages/ReRegistrationCard'
import type { Application, ReRegistration } from './types/api'

const app = (status: string): Application => ({
  id: 'a1', applicant_id: 'p1', applicant_name: 'Budi', admission_period_id: 'per1', period_name: 'G1',
  registration_number: 'REG-1', status, current_step: 5, completion_percentage: 100, status_histories: [],
})

const reReg = (items: ReRegistration['items']): ReRegistration => ({ id: 'r1', application_id: 'a1', status: 'IN_PROGRESS', items })

function renderCard(status: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}><ReRegistrationCard application={app(status)} /></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ReRegistrationCard', () => {
  it('lets an accepted applicant start re-registration', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }))
    renderCard('ACCEPTED')
    await userEvent.click(screen.getByRole('button', { name: 'Mulai daftar ulang' }))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(String(spy.mock.calls[0][0])).toContain('/enrollment/applications/a1/start-re-registration')
    expect((spy.mock.calls[0][1] as RequestInit).method).toBe('POST')
  })

  it('blocks completion until required items are done', async () => {
    const data = reReg([
      { id: 'i1', requirement_name: 'Seragam', is_required: true, status: 'PENDING', notes: null },
      { id: 'i2', requirement_name: 'Foto', is_required: false, status: 'PENDING', notes: null },
    ])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }))
    renderCard('RE_REGISTRATION')
    const button = await screen.findByRole('button', { name: 'Selesaikan daftar ulang' })
    expect(button).toBeDisabled()
    expect(screen.getByText(/1 persyaratan wajib/)).toBeInTheDocument()
  })

  it('enables completion when all required items are done', async () => {
    const data = reReg([{ id: 'i1', requirement_name: 'Seragam', is_required: true, status: 'COMPLETED', notes: null }])
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(data), { status: 200 }))
    renderCard('RE_REGISTRATION')
    expect(await screen.findByRole('button', { name: 'Selesaikan daftar ulang' })).toBeEnabled()
  })
})
