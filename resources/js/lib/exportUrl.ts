import type { ExportFormat } from '../components/ExportFormat'

/** Append `format=` to an export path that may already carry a query string. */
export function exportUrl(path: string, format: ExportFormat): string {
  return `${path}${path.includes('?') ? '&' : '?'}format=${format}`
}
