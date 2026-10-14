import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ErrorNote } from '../../components/Notice'
import { api, fieldErrors } from '../../lib/api'
import { bytesToMb, fromLocalInput, mbToBytes, toLocalInput } from '../../lib/form'

export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'checkbox' | 'select' | 'csv' | 'mb'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  /** Options source for `select` fields. */
  options?: 'years' | 'periods'
  required?: boolean
  /** Sent on create only (the API does not allow changing it afterwards). */
  createOnly?: boolean
  /** Empty value is sent as null. */
  nullable?: boolean
  step?: string
  /** Show this field as a column in the list. */
  column?: boolean
  /** Initial value of a checkbox when creating (defaults to true). */
  defaultChecked?: boolean
}

type Row = { id: string } & Record<string, unknown>
type Values = Record<string, string | boolean>

interface Option { id: string; name: string }

function toForm(fields: FieldDef[], row?: Row): Values {
  const v: Values = {}
  for (const f of fields) {
    const raw = row?.[f.name]
    if (f.type === 'checkbox') v[f.name] = row ? Boolean(raw) : (f.defaultChecked ?? true)
    else if (f.type === 'datetime') v[f.name] = toLocalInput(raw as string | null)
    else if (f.type === 'csv') v[f.name] = Array.isArray(raw) ? raw.join(', ') : ''
    else if (f.type === 'mb') v[f.name] = raw == null ? '2' : String(bytesToMb(Number(raw)))
    else v[f.name] = raw == null ? '' : String(raw)
  }
  return v
}

function toPayload(fields: FieldDef[], v: Values, creating: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.createOnly && !creating) continue
    const val = v[f.name]
    const empty = val === '' || val === undefined
    if (f.type === 'checkbox') body[f.name] = Boolean(val)
    else if (empty) {
      if (f.nullable) body[f.name] = null
    } else if (f.type === 'number') body[f.name] = Number(val)
    else if (f.type === 'mb') body[f.name] = mbToBytes(Number(val))
    else if (f.type === 'datetime') body[f.name] = fromLocalInput(String(val))
    else if (f.type === 'csv') body[f.name] = String(val).split(',').map((s) => s.trim()).filter(Boolean)
    else body[f.name] = val
  }
  return body
}

function cell(f: FieldDef, row: Row, names: Map<string, string>): string {
  const raw = row[f.name]
  if (raw == null || raw === '') return '—'
  if (f.type === 'checkbox') return raw ? 'Ya' : 'Tidak'
  if (f.type === 'datetime') return new Date(String(raw)).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
  if (f.type === 'csv') return (raw as string[]).join(', ')
  if (f.type === 'mb') return `${bytesToMb(Number(raw))} MB`
  if (f.type === 'select') return names.get(String(raw)) ?? String(raw)
  return String(raw)
}

interface Props {
  title: string
  endpoint: string
  fields: FieldDef[]
  /** Hide DELETE (e.g. when the API does not support it). */
  hint?: string
}

export function ResourceManager({ title, endpoint, fields, hint }: Props) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [values, setValues] = useState<Values>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const list = useQuery({ queryKey: ['admin', endpoint], queryFn: () => api<Row[]>(endpoint) })
  const years = useQuery({ queryKey: ['admin', '/admission/academic-years'], queryFn: () => api<Option[]>('/admission/academic-years') })
  const periods = useQuery({ queryKey: ['admin', '/admission/periods'], queryFn: () => api<Option[]>('/admission/periods', { auth: false }) })
  const optionsFor = (f: FieldDef): Option[] => (f.options === 'years' ? years.data : periods.data) ?? []
  const names = new Map<string, string>([...(years.data ?? []), ...(periods.data ?? [])].map((o) => [o.id, o.name]))

  const done = async () => {
    setEditing(null)
    setErrors({})
    await qc.invalidateQueries() // master data feeds many screens (periods, components, requirements)
  }
  const save = useMutation({
    mutationFn: () => {
      const creating = editing === 'new'
      const body = toPayload(fields, values, creating)
      return creating
        ? api(endpoint, { method: 'POST', body })
        : api(`${endpoint}/${(editing as Row).id}`, { method: 'PATCH', body })
    },
    onSuccess: done,
    onError: (e) => setErrors(fieldErrors(e)),
  })
  const remove = useMutation({ mutationFn: (id: string) => api(`${endpoint}/${id}`, { method: 'DELETE' }), onSuccess: done })

  function open(row: Row | 'new') {
    setEditing(row)
    setErrors({})
    setValues(toForm(fields, row === 'new' ? undefined : row))
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setErrors({})
    save.mutate()
  }

  const cols = fields.filter((f) => f.column)

  return (
    <section className="card">
      <div className="row between">
        <h2>{title}</h2>
        {editing === null && <button onClick={() => open('new')}>Tambah</button>}
      </div>
      {hint && <p><small>{hint}</small></p>}

      {editing !== null && (
        <form onSubmit={onSubmit} className="grid-form" aria-label={`Form ${title}`}>
          {fields.filter((f) => editing === 'new' || !f.createOnly).map((f) => (
            <label key={f.name} className={f.type === 'checkbox' ? 'check' : 'field'}>
              {f.type !== 'checkbox' && <span>{f.label}{f.required && ' *'}</span>}
              {f.type === 'select' ? (
                <select value={String(values[f.name] ?? '')} required={f.required} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                  <option value="">{f.required ? 'Pilih…' : '— semua / umum —'}</option>
                  {optionsFor(f).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <><input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })} /> {f.label}</>
              ) : (
                <input
                  type={f.type === 'datetime' ? 'datetime-local' : f.type === 'mb' ? 'number' : f.type === 'csv' ? 'text' : f.type}
                  step={f.step ?? (f.type === 'mb' ? '0.1' : undefined)}
                  required={f.required}
                  placeholder={f.type === 'csv' ? 'application/pdf, image/png' : undefined}
                  value={String(values[f.name] ?? '')}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                />
              )}
              {errors[f.name] && <small className="error">{errors[f.name]}</small>}
            </label>
          ))}
          <div className="row">
            <button disabled={save.isPending}>Simpan</button>
            <button type="button" className="secondary" onClick={() => setEditing(null)}>Batal</button>
          </div>
          {!Object.keys(errors).some((k) => fields.some((f) => f.name === k)) && <ErrorNote error={save.error} />}
        </form>
      )}

      <table>
        <thead><tr>{cols.map((f) => <th key={f.name}>{f.label}</th>)}<th /></tr></thead>
        <tbody>
          {list.data?.map((row) => (
            <tr key={row.id}>
              {cols.map((f) => <td key={f.name}>{cell(f, row, names)}</td>)}
              <td className="row">
                <button className="secondary" onClick={() => open(row)}>Ubah</button>
                <button className="danger" onClick={() => window.confirm('Hapus data ini?') && remove.mutate(row.id)}>Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.data?.length === 0 && <p>Belum ada data.</p>}
      <ErrorNote error={list.error ?? remove.error} />
    </section>
  )
}
