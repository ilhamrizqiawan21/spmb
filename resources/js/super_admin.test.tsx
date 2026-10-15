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
    if (url.includes('/system/admin-dashboard')) {
      return new Response(
        JSON.stringify({
          health: {
            database: 'ok',
            cache: 'ok',
            environment: 'testing',
            php_version: '8.3.0',
            laravel_version: '13.0.0',
            queue: { pending_jobs: 0, failed_jobs: 0 },
            notifications: { sent_24h: 10, failed_24h: 0 },
            storage: { total_documents: 25, total_bytes: 10485760 },
          },
          alerts: [],
          governance: {
            total_users: 15,
            active_users: 14,
            inactive_users: 1,
            roles: [{ code: 'verifier', name: 'Verifier', active_users_count: 3 }],
          },
          academic_year: '2026/2027',
          periods: [],
          recent_audits: [],
        }),
        { status: 200 },
      )
    }
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
    expect(await screen.findByRole('link', { name: 'Kontrol Sistem' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Data Master' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pengguna & Staf' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jejak Audit' })).toBeInTheDocument()
  })

  it('renders dedicated admin console dashboard with operational controls for super admin', async () => {
    mockApi(superAdmin)
    window.history.pushState({}, '', '/admin/dashboard')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Kontrol Sistem & Super Admin' })).toBeInTheDocument()
    expect(screen.getByText('Panel Kendali Operasional')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bersihkan Cache Sistem' })).toBeInTheDocument()
    expect(screen.getByText(/Kondisi Sistem Normal/i)).toBeInTheDocument()
    expect(screen.getByText('Status Infrastruktur & Subsistem')).toBeInTheDocument()
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

