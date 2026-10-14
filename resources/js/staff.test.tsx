import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { tokenStore } from './lib/api'
import type { User } from './types/api'

const user = (permissions: string[]): User => ({ id: 'u1', name: 'Staf', email: 's@x.test', phone: null, is_active: true, roles: [], permissions })

function mockApi(me: User) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const body = String(input).endsWith('/auth/me') ? me : []
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

beforeEach(() => tokenStore.set('t'))
afterEach(() => {
  vi.restoreAllMocks()
  tokenStore.set(null)
  window.history.pushState({}, '', '/')
})

describe('staff navigation and route guards', () => {
  it('shows only the links the user has permissions for', async () => {
    mockApi(user(['assessment.input']))
    render(<App />)
    expect(await screen.findByRole('link', { name: 'Penilaian' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Seleksi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Verifikasi' })).not.toBeInTheDocument()
  })

  it('blocks routes without the permission', async () => {
    mockApi(user(['assessment.input']))
    window.history.pushState({}, '', '/seleksi')
    render(<App />)
    expect(await screen.findByText(/tidak memiliki akses/)).toBeInTheDocument()
  })

  it('renders the selection page for approvers', async () => {
    mockApi(user(['assessment.approve', 'announcement.publish']))
    window.history.pushState({}, '', '/seleksi')
    render(<App />)
    expect(await screen.findByRole('heading', { name: /Seleksi/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Umumkan hasil' })).toBeInTheDocument()
  })
})
