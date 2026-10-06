import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorNote } from '../components/Notice'
import { api } from '../lib/api'
import { fromLocalInput } from '../lib/form'
import type { AuditLog, Paginated } from '../types/api'

const PER_PAGE = 25

function values(v: Record<string, unknown> | null) {
  if (!v || Object.keys(v).length === 0) return '—'
  return Object.entries(v).map(([k, val]) => `${k}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`).join('\n')
}

export function AuditPage() {
  const [filters, setFilters] = useState({ action: '', resource_type: '', from: '', to: '' })
  const [page, setPage] = useState(1)

  const actions = useQuery({ queryKey: ['audit-actions'], queryFn: () => api<string[]>('/audit/actions') })

  const q = new URLSearchParams({ per_page: String(PER_PAGE), page: String(page) })
  if (filters.action) q.set('action', filters.action)
  if (filters.resource_type) q.set('resource_type', filters.resource_type)
  const from = fromLocalInput(filters.from ? `${filters.from}T00:00` : '')
  const to = fromLocalInput(filters.to ? `${filters.to}T23:59:59` : '')
  if (from) q.set('from', from)
  if (to) q.set('to', to)

  const logs = useQuery({ queryKey: ['audit-logs', q.toString()], queryFn: () => api<Paginated<AuditLog>>(`/audit/logs?${q}`) })

  const set = (patch: Partial<typeof filters>) => {
    setFilters({ ...filters, ...patch })
    setPage(1)
  }
  const meta = logs.data?.meta

  return (
    <section className="card">
      <h1>Audit Log</h1>
      <p><small>Catatan tidak dapat diubah atau dihapus. Data pribadi hanya dicatat sebagai nama kolom.</small></p>
      <div className="row">
        <label className="field">
          <span>Aksi</span>
          <select value={filters.action} onChange={(e) => set({ action: e.target.value })}>
            <option value="">Semua</option>
            {actions.data?.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="field"><span>Jenis data</span><input value={filters.resource_type} onChange={(e) => set({ resource_type: e.target.value })} placeholder="application" /></label>
        <label className="field"><span>Dari</span><input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} /></label>
        <label className="field"><span>Sampai</span><input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} /></label>
      </div>
      <ErrorNote error={logs.error} />
      {logs.isPending ? <p>Memuat…</p> : (
        <table>
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Data</th><th>Sebelum</th><th>Sesudah</th><th>IP</th></tr></thead>
          <tbody>
            {logs.data?.data.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.created_at).toLocaleString('id-ID')}</td>
                <td>{l.user_name ?? '—'}</td>
                <td><code>{l.action}</code></td>
                <td>{l.resource_type ?? '—'}{l.resource_id && <><br /><small title={l.resource_id}>{l.resource_id.slice(0, 8)}…</small></>}</td>
                <td><pre className="values">{values(l.old_values)}</pre></td>
                <td><pre className="values">{values(l.new_values)}</pre></td>
                <td>{l.ip_address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {logs.data?.data.length === 0 && <p>Tidak ada catatan.</p>}
      {meta && (
        <div className="row between">
          <small>{meta.total} catatan · halaman {meta.page} / {Math.max(meta.last_page, 1)}</small>
          <div className="row">
            <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
            <button className="secondary" disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>Berikutnya</button>
          </div>
        </div>
      )}
    </section>
  )
}
