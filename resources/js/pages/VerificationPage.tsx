import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { StatusBadge } from '../components/Field'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import type { QueueItem } from '../types/api'

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
      <PageHeader
        title="Antrean Verifikasi"
        description="Daftar berkas pendaftaran calon siswa yang menunggu penugasan dan pemeriksaan oleh staf verifikator."
      />
      <div className="row">
        <input placeholder="Cari nama / no. pendaftaran" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari" />
        <select value={assignment} onChange={(e) => setAssignment(e.target.value)} aria-label="Penugasan">
          <option value="">Semua</option>
          <option value="unassigned">Belum ditugaskan</option>
          <option value="assigned_to_me">Ditugaskan ke saya</option>
        </select>
      </div>
      {isPending ? <p className="loading-indicator">Memuat data antrean…</p> : (
        data && data.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>No. Pendaftaran</th>
                  <th>Nama Calon Siswa</th>
                  <th>Status</th>
                  <th>Verifikator</th>
                  <th>Berkas (valid/total)</th>
                </tr>
              </thead>
              <tbody>
                {data.map((i) => (
                  <tr key={i.id}>
                    <td><Link to={`/verifikasi/${i.id}`}><strong>{i.registration_number}</strong></Link></td>
                    <td>{i.applicant_name}</td>
                    <td><StatusBadge status={i.status} /></td>
                    <td>{i.assigned_verifier_name ?? '—'}</td>
                    <td>{i.document_counts.valid}/{i.document_counts.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Tidak ada pendaftaran di antrean"
            description="Semua berkas pendaftaran calon siswa telah diverifikasi atau belum ada berkas baru yang diajukan."
          />
        )
      )}
    </section>
  )
}
