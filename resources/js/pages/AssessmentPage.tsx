import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { StatusBadge } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { api } from '../lib/api'
import { ScheduleSection } from './ScheduleSection'
import type { Application, ApplicationScore, SelectionComponent } from '../types/api'

const ASSESSABLE = ['VERIFIED', 'ASSESSMENT_SCHEDULED', 'ASSESSED']

function ScoreRow({ app, components }: { app: Application; components: SelectionComponent[] }) {
  const qc = useQueryClient()
  const key = ['score', app.id]
  const score = useQuery({ queryKey: key, queryFn: () => api<ApplicationScore>(`/selection/applications/${app.id}/scores`).catch(() => null) })
  const [values, setValues] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: (v: { componentId: string; score: string }) =>
      api('/selection/assessments/input', { method: 'POST', body: { application_id: app.id, component_id: v.componentId, score: v.score } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: key })
      await qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })
  const given = (cid: string) => score.data?.assessments.find((a) => a.component_id === cid)?.score

  return (
    <tr>
      <td>{app.registration_number}<br /><small>{app.applicant_name}</small></td>
      <td><StatusBadge status={app.status} /></td>
      {components.map((c) => (
        <td key={c.id}>
          <div className="row">
            <input
              type="number" min={0} max={c.max_score} step="0.01" style={{ width: 90 }}
              aria-label={`${c.name} ${app.registration_number}`}
              placeholder={given(c.id) ?? '—'}
              value={values[c.id] ?? ''}
              onChange={(e) => setValues({ ...values, [c.id]: e.target.value })}
            />
            <button disabled={!values[c.id] || save.isPending} onClick={() => save.mutate({ componentId: c.id, score: values[c.id] })}>Simpan</button>
          </div>
        </td>
      ))}
      <td>{score.data?.final_score ?? '—'}<ErrorNote error={save.error} /></td>
    </tr>
  )
}

export function AssessmentPage() {
  const periods = useQuery({ queryKey: ['periods-all'], queryFn: () => api<{ id: string; name: string }[]>('/admission/periods', { auth: false }) })
  const [periodId, setPeriodId] = useState('')
  const pid = periodId || periods.data?.[0]?.id || ''
  const components = useQuery({ queryKey: ['components', pid], enabled: !!pid, queryFn: () => api<SelectionComponent[]>(`/selection/components?admission_period_id=${pid}`, { auth: false }) })
  const apps = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/admission/applications') })
  const list = apps.data?.filter((a) => a.admission_period_id === pid && ASSESSABLE.includes(a.status)) ?? []

  return (
    <>
      <section className="card">
        <h1>Penilaian</h1>
        <select value={pid} onChange={(e) => setPeriodId(e.target.value)} aria-label="Periode">
          {periods.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <p><small>Nilai akhir = Σ (nilai ÷ nilai maks × bobot). Status berpindah ke ASSESSED setelah semua komponen terisi.</small></p>
        <table>
          <thead>
            <tr><th>Pendaftar</th><th>Status</th>{components.data?.map((c) => <th key={c.id}>{c.name} ({c.weight}%)</th>)}<th>Nilai akhir</th></tr>
          </thead>
          <tbody>{components.data && list.map((a) => <ScoreRow key={a.id} app={a} components={components.data} />)}</tbody>
        </table>
        {list.length === 0 && <p>Belum ada pendaftar terverifikasi di periode ini.</p>}
      </section>
      {components.data && (
        <ScheduleSection periodId={pid} applications={list.filter((a) => a.status !== 'ASSESSED')} components={components.data} />
      )}
    </>
  )
}
