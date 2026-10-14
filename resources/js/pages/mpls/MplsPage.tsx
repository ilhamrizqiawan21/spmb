import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorNote } from '../../components/Notice'
import { api } from '../../lib/api'
import { AttendanceTab } from './AttendanceTab'
import { EventsTab } from './EventsTab'
import { GroupsTab } from './GroupsTab'
import { ParticipantsTab } from './ParticipantsTab'

interface AcademicYear {
  id: string
  name: string
  is_active: boolean
}

const TABS = [
  { key: 'groups', label: 'Kelompok' },
  { key: 'events', label: 'Kegiatan' },
  { key: 'attendance', label: 'Presensi' },
  { key: 'participants', label: 'Peserta' },
] as const

type Tab = (typeof TABS)[number]['key']

export function MplsPage() {
  const [tab, setTab] = useState<Tab>('groups')
  const [picked, setPicked] = useState('')
  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => api<AcademicYear[]>('/admission/academic-years') })
  const yearId = picked || years.data?.find((y) => y.is_active)?.id || years.data?.[0]?.id || ''

  return (
    <>
      <h1>MPLS</h1>
      <div className="row">
        <label className="field">
          <span>Tahun ajaran</span>
          <select value={yearId} onChange={(e) => setPicked(e.target.value)}>
            {years.data?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        </label>
        <nav className="tabs" aria-label="Menu MPLS">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? '' : 'secondary'} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </nav>
      </div>
      <ErrorNote error={years.error} />
      {years.data?.length === 0 && <p>Buat tahun ajaran terlebih dahulu di Data Master.</p>}
      {yearId && tab === 'groups' && <GroupsTab yearId={yearId} />}
      {yearId && tab === 'events' && <EventsTab yearId={yearId} />}
      {yearId && tab === 'attendance' && <AttendanceTab yearId={yearId} />}
      {yearId && tab === 'participants' && <ParticipantsTab yearId={yearId} />}
    </>
  )
}
