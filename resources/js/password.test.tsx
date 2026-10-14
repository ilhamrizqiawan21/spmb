import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.pushState({}, '', '/')
})

function mockFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    calls.push({ url: String(input), init })
    return new Response(JSON.stringify(body), { status })
  })
  return calls
}

describe('forgot password', () => {
  it('is linked from the login page and confirms without revealing whether the email exists', async () => {
    const calls = mockFetch(202, { message: 'ok' })
    window.history.pushState({}, '', '/login')
    render(<App />)
    await userEvent.click(await screen.findByRole('link', { name: 'Lupa kata sandi?' }))

    await userEvent.type(await screen.findByLabelText('Email'), 'ibu@example.test')
    await userEvent.click(screen.getByRole('button', { name: 'Kirim tautan' }))

    expect(await screen.findByRole('heading', { name: 'Periksa email Anda' })).toBeInTheDocument()
    expect(calls[0].url).toBe('/api/v1/auth/forgot-password')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'ibu@example.test' })
  })
})

describe('reset password', () => {
  it('rejects a link without token or email', async () => {
    window.history.pushState({}, '', '/reset-password')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Tautan tidak valid' })).toBeInTheDocument()
  })

  it('does not submit when the confirmation differs', async () => {
    const calls = mockFetch(200, {})
    window.history.pushState({}, '', '/reset-password?token=t1&email=ibu%40example.test')
    render(<App />)

    await userEvent.type(await screen.findByLabelText(/Kata sandi baru/), 'Passw0rd-baru')
    await userEvent.type(screen.getByLabelText('Ulangi kata sandi baru'), 'Passw0rd-lain')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan kata sandi' }))

    expect(await screen.findByText('Konfirmasi kata sandi tidak sama.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('sends token and email from the link and returns to login on success', async () => {
    const calls = mockFetch(200, { message: 'ok' })
    window.history.pushState({}, '', '/reset-password?token=t1&email=ibu%40example.test')
    render(<App />)

    await userEvent.type(await screen.findByLabelText(/Kata sandi baru/), 'Passw0rd-baru')
    await userEvent.type(screen.getByLabelText('Ulangi kata sandi baru'), 'Passw0rd-baru')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan kata sandi' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Masuk' })).toBeInTheDocument())
    expect(calls[0].url).toBe('/api/v1/auth/reset-password')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ email: 'ibu@example.test', token: 't1', password: 'Passw0rd-baru' })
  })

  it('drops a stale local session after a successful reset', async () => {
    localStorage.setItem('spmb.token', 'stale')
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      String(input).endsWith('/auth/reset-password')
        ? new Response('{}', { status: 200 })
        : new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'x', details: null } }), { status: 401 }),
    )
    window.history.pushState({}, '', '/reset-password?token=t1&email=ibu%40example.test')
    render(<App />)

    await userEvent.type(await screen.findByLabelText(/Kata sandi baru/), 'Passw0rd-baru')
    await userEvent.type(screen.getByLabelText('Ulangi kata sandi baru'), 'Passw0rd-baru')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan kata sandi' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Masuk' })).toBeInTheDocument())
    expect(localStorage.getItem('spmb.token')).toBeNull()
  })

  it('offers a new link when the token is expired', async () => {
    mockFetch(400, { error: { code: 'VALIDATION_ERROR', message: 'x', details: { token: ['The reset link is invalid or has expired.'] } } })
    window.history.pushState({}, '', '/reset-password?token=old&email=ibu%40example.test')
    render(<App />)

    await userEvent.type(await screen.findByLabelText(/Kata sandi baru/), 'Passw0rd-baru')
    await userEvent.type(screen.getByLabelText('Ulangi kata sandi baru'), 'Passw0rd-baru')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan kata sandi' }))

    expect(await screen.findByText(/Tautan sudah tidak berlaku/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Minta tautan baru' })).toHaveAttribute('href', '/forgot-password')
  })
})
