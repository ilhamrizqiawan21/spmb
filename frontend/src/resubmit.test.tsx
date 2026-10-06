import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApplicationPage } from './pages/ApplicationPage'

const app = (status: string) => ({
  id: 'a1', applicant_id: 'p1', applicant_name: 'Budi', admission_period_id: 'per1', period_name: 'G1',
  registration_number: 'REG-1', status, current_step: 5, completion_percentage: 100, status_histories: [],
})

function renderPage(status: string) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    return new Response(JSON.stringify(url.endsWith('/applications/a1') ? app(status) : []), { status: 200 })
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/applications/a1']}>
        <Routes><Route path="/applications/:id" element={<ApplicationPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('submit / resubmit button', () => {
  it('offers resubmission after a revision request', async () => {
    renderPage('REVISION_REQUIRED')
    expect(await screen.findByRole('button', { name: 'Kirim ulang pendaftaran' })).toBeInTheDocument()
    expect(screen.getByText(/meminta perbaikan/)).toBeInTheDocument()
  })

  it('offers first submission for drafts and nothing once submitted', async () => {
    renderPage('DRAFT')
    expect(await screen.findByRole('button', { name: 'Kirim pendaftaran' })).toBeInTheDocument()
    cleanup()
    vi.restoreAllMocks()
    renderPage('SUBMITTED')
    await screen.findByRole('heading', { name: 'Budi' })
    expect(screen.queryByRole('button', { name: /Kirim/ })).not.toBeInTheDocument()
  })
})
