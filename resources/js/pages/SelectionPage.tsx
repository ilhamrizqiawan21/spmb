import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { StatusBadge } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { useAuth } from '../features/auth/AuthContext'
import { api } from '../lib/api'
import type { Application, ApplicationScore, Decision, WaitingListEntry } from '../types/api'

function DecisionCell({ app, onDone }: { app: Application; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const existing = useQuery({ queryKey: ['decision', app.id], queryFn: () => api<Decision>(`/selection/applications/${app.id}/decision`).catch(() => null) })
  const decide = useMutation({
    mutationFn: (decision: string) => api('/selection/applications/' + app.id + '/decision', { method: 'POST', body: { decision, reason: reason || null } }),
    onSuccess: onDone,
  })
  return (
    <div>
      {existing.data && <p><StatusBadge status={existing.data.decision} /></p>}
      <div className="row">
        <input placeholder={existing.data ? 'Alasan (wajib untuk ubah)' : 'Alasan (opsional)'} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={`Alasan ${app.registration_number}`} />
        <button onClick={() => decide.mutate('ACCEPTED')}>Terima</button>
        <button className="secondary" onClick={() => decide.mutate('WAITLISTED')}>Daftar tunggu</button>
        <button className="danger" onClick={() => decide.mutate('REJECTED')}>Tolak</button>
      </div>
      <ErrorNote error={decide.error} />
    </div>
  )
}

export function SelectionPage() {
  const { can } = useAuth()
  const qc = useQueryClient()
  const periods = useQuery({ queryKey: ['periods-all'], queryFn: () => api<{ id: string; name: string }[]>('/admission/periods', { auth: false }) })
  const [periodId, setPeriodId] = useState('')
  const pid = periods.data ? periodId || periods.data[0]?.id || '' : ''

  const ranking = useQuery({ queryKey: ['ranking', pid], enabled: !!pid, queryFn: () => api<ApplicationScore[]>(`/selection/periods/${pid}/ranking`) })
  const waiting = useQuery({ queryKey: ['waiting', pid], enabled: !!pid, queryFn: () => api<WaitingListEntry[]>(`/selection/periods/${pid}/waiting-list`) })
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/admission/applications') })

  const refresh = async () => {
    await Promise.all(['ranking', 'waiting', 'applications', 'decision'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
  }
  const rank = useMutation({ mutationFn: () => api(`/selection/periods/${pid}/ranking`, { method: 'POST' }), onSuccess: refresh })
  const promote = useMutation({
    mutationFn: (entryId: string) => {
      const reason = window.prompt('Alasan promosi dari daftar tunggu?')
      if (!reason) return Promise.resolve(null)
      return api(`/selection/waiting-list/${entryId}/promote`, { method: 'POST', body: { reason } })
    },
    onSuccess: refresh,
  })
  const publish = useMutation({
    mutationFn: () => api<{ published_count: number }>(`/selection/periods/${pid}/publish-announcement`, { method: 'POST', body: {} }),
    onSuccess: refresh,
  })
  const byId = new Map(apps.data?.map((a) => [a.id, a]))

  return (
    <>
      <section className="card">
        <h1>Seleksi &amp; Keputusan</h1>
        <div className="row">
          <select value={pid} onChange={(e) => setPeriodId(e.target.value)} aria-label="Periode">
            {periods.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => rank.mutate()} disabled={!pid || rank.isPending}>Hitung peringkat</button>
          {can('announcement.publish', 'application.override') && (
            <button className="secondary" onClick={() => window.confirm('Umumkan hasil untuk semua pendaftar periode ini?') && publish.mutate()} disabled={!pid}>Umumkan hasil</button>
          )}
        </div>
        <ErrorNote error={rank.error ?? publish.error ?? promote.error} />
        {publish.data && <p role="status">{publish.data.published_count} hasil diumumkan.</p>}
      </section>

      <section className="card">
        <h2>Peringkat</h2>
        <table>
          <thead><tr><th>#</th><th>Pendaftar</th><th>Nilai akhir</th><th>Status</th><th>Keputusan</th></tr></thead>
          <tbody>
            {ranking.data?.map((s) => {
              const app = byId.get(s.application_id)
              return (
                <tr key={s.id}>
                  <td>{s.rank ?? '—'}</td>
                  <td>{s.registration_number}<br /><small>{s.applicant_name}</small></td>
                  <td>{s.final_score}</td>
                  <td>{app && <StatusBadge status={app.status} />}</td>
                  <td>{app && <DecisionCell app={app} onDone={refresh} />}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {ranking.data?.length === 0 && <p>Belum ada nilai. Isi penilaian lalu hitung peringkat.</p>}
      </section>

      <section className="card">
        <h2>Daftar Tunggu</h2>
        <ul className="list">
          {waiting.data?.map((w) => (
            <li key={w.id}>
              #{w.position} {w.applicant_name} ({w.score})
              <button onClick={() => promote.mutate(w.id)}>Promosikan</button>
            </li>
          ))}
        </ul>
        {waiting.data?.length === 0 && <p>Kosong.</p>}
      </section>
    </>
  )
}
