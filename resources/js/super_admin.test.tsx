import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { tokenStore } from './lib/api'
import type { User } from './types/api'

const superAdmin: User = {
  id: 'sa1',
  name: 'Super Administrator',
  email: 'super_admin@demo.test',
  phone: null,
  is_active: true,
  roles: ['super_admin'],
  permissions: ['application.override', 'user.manage', 'audit.read'],
}

const verifierUser: User = {
  id: 'v1',
  name: 'Verifier Only',
  email: 'verifier@demo.test',
  phone: null,
  is_active: true,
  roles: ['verifier'],
  permissions: ['document.verify', 'application.read'],
}

function mockApi(me: User) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) return new Response(JSON.stringify(me), { status: 200 })
    if (url.includes('/users/roles')) return new Response(JSON.stringify([]), { status: 200 })
    if (url.includes('/users')) return new Response(JSON.stringify({ data: [], meta: { page: 1, per_page: 20, total: 0 } }), { status: 200 })
    if (url.includes('/audit-logs')) return new Response(JSON.stringify({ data: [], meta: { page: 1, per_page: 50, total: 0 } }), { status: 200 })
    return new Response(JSON.stringify([]), { status: 200 })
  })
}

beforeEach(() => tokenStore.set('mock-token'))
afterEach(() => {
  vi.restoreAllMocks()
  tokenStore.set(null)
  window.history.pushState({}, '', '/')
})

describe('Super Admin flow and access', () => {
  it('shows all administrative menus in sidebar for super admin', async () => {
    mockApi(superAdmin)
    render(<App />)

    // Verify all super admin menus are displayed
    expect(await screen.findByRole('link', { name: 'Data Master' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pengguna & Staf' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jejak Audit' })).toBeInTheDocument()
  })

  it('renders users management page for super admin', async () => {
    mockApi(superAdmin)
    window.history.pushState({}, '', '/pengguna')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Manajemen Pengguna & Staf' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tambah Pengguna' })).toBeInTheDocument()
  })

  it('renders audit logs page for super admin', async () => {
    mockApi(superAdmin)
    window.history.pushState({}, '', '/audit-logs')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Jejak Audit Sistem' })).toBeInTheDocument()
    expect(screen.getByLabelText('Filter aksi')).toBeInTheDocument()
  })

  it('blocks users without user.manage permission from accessing /pengguna', async () => {
    mockApi(verifierUser)
    window.history.pushState({}, '', '/pengguna')
    render(<App />)

    expect(await screen.findByText(/tidak memiliki akses/i)).toBeInTheDocument()
  })
})

