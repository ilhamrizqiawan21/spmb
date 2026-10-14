import { useId, type InputHTMLAttributes, type Ref } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  ref?: Ref<HTMLInputElement>
}

/** Labelled input; works with react-hook-form `register()` (React 19 passes `ref` as a prop). */
export function Field({ label, error, hint, ref, ...rest }: Props) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <label className={rest.required ? 'field required' : 'field'}>
      <span>{label}</span>
      <input {...rest} ref={ref} aria-invalid={!!error} aria-describedby={describedBy} />
      {hint && <small id={`${id}-hint`} className="hint">{hint}</small>}
      {error && <small id={`${id}-error`} className="error">{error}</small>}
    </label>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status.replaceAll('_', ' ')}</span>
}
