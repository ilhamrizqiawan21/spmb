import type { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Field({ label, error, ...rest }: Props) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...rest} aria-invalid={!!error} />
      {error && <small className="error">{error}</small>}
    </label>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status.replaceAll('_', ' ')}</span>
}
