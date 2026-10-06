import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuditPage } from './pages/AuditPage'

const log = (i: number) => ({
  id: `l${i}`, user_id: 'u1', user_name: 'Admin', action: i === 1 ? 'decision.overridden' : 'auth.login', resource_type: 'application_decision',
  resource_id: '01a10f6b-6a1d-7176-bd66-73556838d9b7', old_values: { decision: 'ACCEPTED' }, new_values: { decision: 'REJECTED' },
  ip_address: '10.0.0.1', created_at: '2026-10-06T04:00:00.000000Z',
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AuditPage', () => {
  it('renders rows, sends filters and paginates', async () => {
    const urls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      urls.push(url)
      if (url.includes('/audit/actions')) return new Response(JSON.stringify(['auth.login', 'decision.overridden']), { status: 200 })
      return new Response(JSON.stringify({ data: [log(1)], meta: { page: 1, per_page: 25, total: 40, last_page: 2 } }), { status: 200 })
    })
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuditPage /></QueryClientProvider>)

    expect(await screen.findByText('decision.overridden', { selector: 'code' })).toBeInTheDocument()
    expect(screen.getByText('decision: ACCEPTED')).toBeInTheDocument()
    expect(screen.getByText(/40 catatan/)).toBeInTheDocument()

    await userEvent.selectOptions(await screen.findByLabelText('Aksi'), 'decision.overridden')
    await waitFor(() => expect(urls.some((u) => u.includes('action=decision.overridden') && u.includes('page=1'))).toBe(true))

    await userEvent.click(screen.getByRole('button', { name: 'Berikutnya' }))
    await waitFor(() => expect(urls.some((u) => u.includes('page=2'))).toBe(true))
  })
})
