import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, fieldErrors, tokenStore } from './api'

afterEach(() => {
  vi.restoreAllMocks()
  tokenStore.set(null)
})

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

describe('api client', () => {
  it('sends the bearer token and parses JSON', async () => {
    tokenStore.set('abc')
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { ok: true }))
    await expect(api('/auth/me')).resolves.toEqual({ ok: true })
    const init = spy.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  })

  it('maps the error envelope to ApiError and field errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(400, { error: { code: 'VALIDATION_ERROR', message: 'bad', details: { email: ['Email is already registered.'] } } }),
    )
    const err = await api('/auth/register', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(400)
    expect(fieldErrors(err)).toEqual({ email: 'Email is already registered.' })
  })

  it('returns undefined for 204', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
    await expect(api('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })
})
