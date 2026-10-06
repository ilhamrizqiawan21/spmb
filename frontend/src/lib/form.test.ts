import { describe, expect, it } from 'vitest'
import { bytesToMb, fromLocalInput, mbToBytes, toLocalInput } from './form'

describe('form helpers', () => {
  it('round-trips datetime-local values through UTC ISO', () => {
    const local = '2026-12-01T09:30'
    const iso = fromLocalInput(local)
    expect(iso).toMatch(/Z$/)
    expect(toLocalInput(iso)).toBe(local)
  })

  it('treats empty values as null', () => {
    expect(fromLocalInput('')).toBeNull()
    expect(toLocalInput(null)).toBe('')
  })

  it('converts file sizes', () => {
    expect(mbToBytes(2)).toBe(2097152)
    expect(bytesToMb(2097152)).toBe(2)
    expect(bytesToMb(mbToBytes(1.5))).toBe(1.5)
  })
})
