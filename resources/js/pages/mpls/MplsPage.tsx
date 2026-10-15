import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorNote } from '../../components/Notice'
import { PageHeader } from '../../components/PageHeader'
import { api } from '../../lib/api'
import { EventsTab } from './EventsTab'
import { GroupsTab } from './GroupsTab'

interface AcademicYear {
  id: string
  name: string
  is_active: boolean
}

const TABS = [
  { key: 'groups', label: 'Kelompok & Calon Siswa Baru' },
  { key: 'events', label: 'Jadwal Kegiatan' },
] as const

type Tab = (typeof TABS)[number]['key']

export function MplsPage() {
  const [tab, setTab] = useState<Tab>('groups')
  const [picked, setPicked] = useState('')
  const years = useQuery({ queryKey: ['academic-years'], queryFn: () => api<AcademicYear[]>('/admission/academic-years') })
  const yearId = picked || years.data?.find((y) => y.is_active)?.id || years.data?.[0]?.id || ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="MPLS"
        description="Pengelolaan kelompok dan penempatan calon siswa baru untuk kegiatan Masa Pengenalan Lingkungan Sekolah."
      />

      <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <label className="field" style={{ minWidth: 220 }}>
          <span style={{ fontWeight: 600 }}>Tahun Ajaran</span>
          <select value={yearId} onChange={(e) => setPicked(e.target.value)}>
            {years.data?.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} {y.is_active ? '(Aktif)' : ''}
              </option>
            ))}
          </select>
        </label>
        <nav className="tabs" aria-label="Menu MPLS">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={tab === t.key ? '' : 'secondary'}
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <ErrorNote error={years.error} />
      {years.data?.length === 0 && <p className="hint">Buat tahun ajaran terlebih dahulu di Data Master.</p>}

      {yearId && tab === 'groups' && <GroupsTab yearId={yearId} />}
      {yearId && tab === 'events' && <EventsTab yearId={yearId} />}
    </div>
  )
}

