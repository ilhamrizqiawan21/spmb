import { ApiError } from '../lib/api'

/** Inline error for a failed mutation/query. */
export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="error" role="alert">{error instanceof ApiError ? error.message : 'Terjadi kesalahan.'}</p>
}

/** Form-level message (errors that do not belong to a single field). */
export function FormError({ message }: { message: string | null }) {
  return message ? <p className="error" role="alert">{message}</p> : null
}
