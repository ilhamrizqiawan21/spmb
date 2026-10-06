import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResourceManager, type FieldDef } from './pages/admin/ResourceManager'

const FIELDS: FieldDef[] = [
  { name: 'name', label: 'Nama', type: 'text', required: true, column: true },
  { name: 'allowed_mime_types', label: 'Tipe file', type: 'csv', column: true },
  { name: 'max_file_size_bytes', label: 'Ukuran maks (MB)', type: 'mb', column: true },
  { name: 'quota', label: 'Kuota', type: 'number', nullable: true },
  { name: 'is_required', label: 'Wajib', type: 'checkbox', column: true },
]

function setup(handler: (url: string, init?: RequestInit) => unknown) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    calls.push({ url, init })
    const res = handler(url, init)
    return new Response(JSON.stringify(res ?? []), { status: init?.method === 'POST' ? 201 : 200 })
  })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={qc}><ResourceManager title="Persyaratan" endpoint="/things" fields={FIELDS} /></QueryClientProvider>)
  return calls
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ResourceManager', () => {
  it('lists rows with formatted values', async () => {
    setup((url) => (url.endsWith('/things') ? [{ id: '1', name: 'KK', allowed_mime_types: ['application/pdf'], max_file_size_bytes: 2097152, is_required: true }] : []))
    expect(await screen.findByText('KK')).toBeInTheDocument()
    expect(screen.getByText('2 MB')).toBeInTheDocument()
    expect(screen.getByText('application/pdf')).toBeInTheDocument()
  })

  it('creates a record converting csv, MB and empty nullable fields', async () => {
    const calls = setup(() => [])
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah' }))
    await userEvent.type(screen.getByLabelText(/Nama/), 'Akta')
    await userEvent.type(screen.getByLabelText(/Tipe file/), 'application/pdf, image/png')
    await userEvent.clear(screen.getByLabelText(/Ukuran maks/))
    await userEvent.type(screen.getByLabelText(/Ukuran maks/), '1.5')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(calls.some((c) => c.init?.method === 'POST')).toBe(true))
    const post = calls.find((c) => c.init?.method === 'POST')!
    expect(post.url).toContain('/things')
    expect(JSON.parse(String(post.init!.body))).toEqual({
      name: 'Akta',
      allowed_mime_types: ['application/pdf', 'image/png'],
      max_file_size_bytes: 1572864,
      quota: null,
      is_required: true,
    })
  })

  it('shows field errors from the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'dup', details: { name: ['Sudah ada.'] } } }), { status: 400 })
        : new Response('[]', { status: 200 }),
    )
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={qc}><ResourceManager title="X" endpoint="/things" fields={FIELDS} /></QueryClientProvider>)
    await userEvent.click(await screen.findByRole('button', { name: 'Tambah' }))
    await userEvent.type(screen.getByLabelText(/Nama/), 'Dup')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan' }))
    expect(await screen.findByText('Sudah ada.')).toBeInTheDocument()
  })
})
