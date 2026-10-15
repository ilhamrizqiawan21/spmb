import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './components/ThemeToggle'
import { ThemeProvider } from './features/theme/ThemeContext'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle component', () => {
  it('toggles between light and dark themes on click and updates data-theme attribute', async () => {
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    const btn = screen.getByRole('button', { name: /beralih ke mode/i })
    expect(btn).toBeInTheDocument()

    // Click to toggle
    await user.click(btn)
    expect(document.documentElement.getAttribute('data-theme')).toMatch(/dark|light/)
    expect(localStorage.getItem('spmb_theme')).toMatch(/dark|light/)

    // Click again to toggle back
    await user.click(btn)
    expect(localStorage.getItem('spmb_theme')).toMatch(/dark|light/)
  })
})

