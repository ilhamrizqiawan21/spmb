/** ISO-8601 (UTC) → value for `<input type="datetime-local">` in the browser's timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** `datetime-local` value (browser timezone) → ISO-8601 UTC for the API. */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

export const bytesToMb = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 100) / 100
export const mbToBytes = (mb: number) => Math.round(mb * 1024 * 1024)
