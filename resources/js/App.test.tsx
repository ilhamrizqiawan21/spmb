import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(() => window.history.pushState({}, '', '/'))

describe('App routing', () => {
  it('shows the landing page', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Penerimaan Murid Baru/ })).toBeInTheDocument()
  })

  it('redirects unauthenticated users from protected pages to login', async () => {
    window.history.pushState({}, '', '/dashboard')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Masuk' })).toBeInTheDocument()
  })
})
