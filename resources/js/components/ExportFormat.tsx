export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

const OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
]

interface Props {
  value: ExportFormat
  onChange: (format: ExportFormat) => void
}

/** Format picker shared by every report download. */
export function ExportFormatSelect({ value, onChange }: Props) {
  return (
    <label className="field">
      <span>Format ekspor</span>
      <select value={value} onChange={(e) => onChange(e.target.value as ExportFormat)}>
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
