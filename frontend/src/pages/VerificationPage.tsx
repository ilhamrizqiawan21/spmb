import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { StatusBadge } from '../components/Field'
import { api } from '../lib/api'

interface QueueItem {
  id: string
  applicant_name: string
  period_name: string
  registration_number: string | null
  status: string
  assigned_verifier_name: string | null
  document_counts: { total: number; pending: number; valid: number; invalid: number; revision_required: number }
}

export function VerificationPage() {
  const [assignment, setAssignment] = useState('')
  const [search, setSearch] = useState('')
  const q = new URLSearchParams()
  if (assignment) q.set('assignment', assignment)
  if (search) q.set('search', search)
  const { data, isPending } = useQuery({
    queryKey: ['verification-queue', assignment, search],
    queryFn: () => api<QueueItem[]>(`/verification/queue?${q}`),
  })

  return (
    <section className="card">
      <h1>Antrean Verifikasi</h1>
      <div className="row">
        <input placeholder="Cari nama / no. pendaftaran" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari" />
        <select value={assignment} onChange={(e) => setAssignment(e.target.value)} aria-label="Penugasan">
          <option value="">Semua</option>
          <option value="unassigned">Belum ditugaskan</option>
          <option value="assigned_to_me">Ditugaskan ke saya</option>
        </select>
      </div>
      {isPending ? <p>Memuat…</p> : (
        <table>
          <thead><tr><th>No.</th><th>Nama</th><th>Status</th><th>Verifikator</th><th>Berkas (valid/total)</th></tr></thead>
          <tbody>
            {data?.map((i) => (
              <tr key={i.id}>
                <td>{i.registration_number}</td>
                <td>{i.applicant_name}</td>
                <td><StatusBadge status={i.status} /></td>
                <td>{i.assigned_verifier_name ?? '—'}</td>
                <td>{i.document_counts.valid}/{i.document_counts.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
