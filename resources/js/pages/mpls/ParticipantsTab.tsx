import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Field, StatusBadge } from '../../components/Field'
import { ErrorNote } from '../../components/Notice'
import { api, downloadFile } from '../../lib/api'
import type { MplsGroup, MplsParticipant, MplsParticipantPage } from '../../types/api'
import { QrImage } from './QrImage'

export function ParticipantsTab({ yearId }: { yearId: string }) {
  const qc = useQueryClient()
  const [groupId, setGroupId] = useState('')
  const [search, setSearch] = useState('')
  const [qr, setQr] = useState<MplsParticipant | null>(null)
  const params = new URLSearchParams({ academic_year_id: yearId, per_page: '200', ...(groupId ? { group_id: groupId } : {}), ...(search ? { search } : {}) })
  const groups = useQuery({ queryKey: ['mpls-groups', yearId], queryFn: () => api<MplsGroup[]>(`/mpls/groups?academic_year_id=${yearId}`) })
  const list = useQuery({ queryKey: ['mpls-participants', yearId, groupId, search], queryFn: () => api<MplsParticipantPage>(`/mpls/participants?${params}`) })
  const refresh = () => qc.invalidateQueries({ queryKey: ['mpls-participants'] })
  const complete = useMutation({ mutationFn: (id: string) => api(`/mpls/participants/${id}/complete`, { method: 'POST', body: {} }), onSuccess: refresh })
  const rotate = useMutation({
    mutationFn: (id: string) => api<MplsParticipant>(`/mpls/participants/${id}/rotate-qr`, { method: 'POST' }),
    onSuccess: (p) => setQr(p),
  })
  const exportCsv = useMutation({ mutationFn: () => downloadFile(`/mpls/participants/export?academic_year_id=${yearId}${groupId ? `&group_id=${groupId}` : ''}`, 'peserta-mpls.csv') })

  return (
    <section className="card">
      <h2>Peserta {list.data && <small>({list.data.meta.total})</small>}</h2>
      <div className="row">
        <label className="field">
          <span>Kelompok</span>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Semua</option>
            {groups.data?.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
          </select>
        </label>
        <Field label="Cari nama / NIS" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="secondary field" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>Ekspor CSV</button>
      </div>
      {list.isLoading && <p>Memuat…</p>}
      {list.data?.data.length === 0 && <p>Belum ada peserta.</p>}
      {!!list.data?.data.length && (
        <table>
          <thead><tr><th>NIS</th><th>Nama</th><th>Kelompok</th><th className="num">H / S / I / A</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.data.data.map((p) => (
              <tr key={p.id}>
                <td>{p.student_number}</td>
                <td>{p.full_name}</td>
                <td>{p.group_code}</td>
                <td className="num">{p.attendance.present} / {p.attendance.sick} / {p.attendance.permitted} / {p.attendance.absent}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  {p.status === 'ACTIVE' && (
                    <>
                      <button className="link" onClick={() => { if (window.confirm(`Nyatakan ${p.full_name} selesai MPLS?`)) complete.mutate(p.id) }}>Selesaikan</button>{' '}
                      <button className="link" onClick={() => { if (window.confirm('Kode QR lama tidak berlaku lagi. Lanjutkan?')) rotate.mutate(p.id) }}>QR baru</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {qr?.qr_token && (
        <div className="card">
          <h3>Kode QR baru: {qr.full_name}</h3>
          <QrImage value={qr.qr_token} label={`QR ${qr.full_name}`} />
          <p><button className="secondary" onClick={() => setQr(null)}>Tutup</button></p>
        </div>
      )}
      <ErrorNote error={list.error ?? complete.error ?? rotate.error ?? exportCsv.error} />
    </section>
  )
}
