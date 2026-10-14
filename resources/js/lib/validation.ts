import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, fieldErrors } from './api'

/**
 * Client-side rules mirroring the backend (the server stays the final authority).
 * Messages are Indonesian because they are shown next to the field.
 */
const REQUIRED = 'Wajib diisi.'

export const requiredText = (max: number) => z.string().trim().min(1, REQUIRED).max(max, `Maksimal ${max} karakter.`)
export const optionalText = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter.`)

/** Same as AuthController::passwordRules(): at least 8 characters, not only digits. */
export const password = z.string().min(8, 'Minimal 8 karakter.').regex(/\D/, 'Kata sandi tidak boleh hanya angka.')

/** New password + confirmation; shared by reset and change password. */
export const newPasswordSchema = z.object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Konfirmasi kata sandi tidak sama.' })

export const email = z.string().trim().email('Format email tidak valid.').max(255)
export const optionalEmail = z.union([z.literal(''), email])

/** Indonesian phone numbers, optionally with +, spaces, dashes or brackets (backend: /^\+?[0-9 ()-]{6,30}$/). */
export const phone = z.string().trim().regex(/^\+?[0-9 ()-]{6,30}$/, 'Nomor HP tidak valid.')
export const optionalPhone = z.union([z.literal(''), phone])

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.')

/** Digits only with an exact or bounded length (NISN = 10, NIK/KK = 16). */
export const optionalDigits = (length: number, label: string) =>
  z.union([z.literal(''), z.string().trim().regex(new RegExp(`^\\d{${length}}$`), `${label} harus ${length} digit angka.`)])

/** Empty strings become null so optional fields are sent as "not provided". */
export function emptyToNull<T extends Record<string, unknown>>(values: T): { [K in keyof T]: T[K] | null } {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])) as { [K in keyof T]: T[K] | null }
}

/**
 * Put server validation messages on the matching form fields. Returns the message of errors that
 * do not belong to a known field (e.g. `detail`), so the caller can show it as a form-level error.
 */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, fields: readonly string[]): string | null {
  const byField = fieldErrors(err)
  let rest: string | null = null
  for (const [key, message] of Object.entries(byField)) {
    if (fields.includes(key)) setError(key as Path<T>, { type: 'server', message })
    else rest ??= message
  }
  if (Object.keys(byField).length === 0) return err instanceof ApiError ? err.message : 'Terjadi kesalahan. Coba lagi.'
  return rest
}
