const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api/v1'
const TOKEN_KEY = 'spmb.token'

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage unavailable */
    }
  },
}

/** Standard backend error envelope: `{"error": {code, message, details}}`. */
export class ApiError extends Error {
  status: number
  code: string
  details: Record<string, string[] | string> | null

  constructor(status: number, code: string, message: string, details: ApiError['details']) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

type Options = { method?: string; body?: unknown; form?: FormData; auth?: boolean }

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  const res = await fetch(`${BASE_URL}${path}`, { method: opts.method ?? 'GET', headers, body })
  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data?.error
    throw new ApiError(res.status, err?.code ?? 'HTTP_ERROR', err?.message ?? res.statusText, err?.details ?? null)
  }
  return data as T
}

/** Flatten `details` into a field => first message map for form display. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || !err.details) return {}
  return Object.fromEntries(
    Object.entries(err.details).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]),
  )
}

/** Private files/PDFs need the bearer token, so fetch as a blob and open it in a new tab. */
export async function openBlob(path: string): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` } })
  if (!res.ok) throw new ApiError(res.status, 'HTTP_ERROR', 'Gagal mengunduh berkas.', null)
  window.open(URL.createObjectURL(await res.blob()), '_blank', 'noopener')
}
