import { ApiError } from '../lib/api'

/** Inline error for a failed mutation/query. */
export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="error" role="alert">{error instanceof ApiError ? error.message : 'Terjadi kesalahan.'}</p>
}
