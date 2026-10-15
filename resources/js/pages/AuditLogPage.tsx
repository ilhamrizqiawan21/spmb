import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { api } from '../lib/api'
import type { AuditLogEntry, AuditLogPage as AuditLogPageType } from '../types/api'

export function AuditLogPage() {
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)

  const q = new URLSearchParams()
  if (action) q.set('action', action)
  if (resourceType) q.set('resource_type', resourceType)
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  q.set('page', String(page))

  const { data, isPending } = useQuery({
    queryKey: ['audit-logs', action, resourceType, from, to, page],
    queryFn: () => api<AuditLogPageType>(`/audit-logs?${q}`),
  })

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    } catch {
      return iso
    }
  }

  const getActionBadgeClass = (act: string) => {
    if (act.includes('deleted') || act.includes('disabled') || act.includes('overridden') || act.includes('rejected')) {
      return 'badge-rejected'
    }
    if (act.includes('created') || act.includes('verified') || act.includes('accepted')) {
      return 'badge-verified'
    }
    return 'badge-pending'
  }

  return (
    <section className="card">
      <PageHeader
        title="Jejak Audit Sistem"
        description="Catatan riwayat perubahan data sensitif, keputusan seleksi, dan aktivitas operasional yang bersifat append-only."
      />

      <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
        <div className="field" style={{ margin: 0, minWidth: 200, flex: 1 }}>
          <span>Aksi (Action)</span>
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPage(1)
            }}
            aria-label="Filter aksi"
          >
            <option value="">Semua Aksi</option>
            <option value="decision.made">decision.made (Penetapan Hasil)</option>
            <option value="decision.overridden">decision.overridden (Override Keputusan)</option>
            <option value="application.status_changed">application.status_changed (Perubahan Status)</option>
            <option value="user.created">user.created (Tambah Pengguna)</option>
            <option value="user.updated">user.updated (Ubah Pengguna/Role)</option>
            <option value="user.disabled">user.disabled (Nonaktifkan Akun)</option>
            <option value="payment.verified">payment.verified (Verifikasi Pembayaran)</option>
            <option value="document.verified">document.verified (Verifikasi Berkas)</option>
            <option value="document.revision_requested">document.revision_requested (Permintaan Revisi)</option>
            <option value="enrollment.created">enrollment.created (Penetapan Siswa Resmi)</option>
          </select>
        </div>

        <div className="field" style={{ margin: 0, minWidth: 150 }}>
          <span>Dari Tanggal</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(1)
            }}
            aria-label="Dari tanggal"
          />
        </div>

        <div className="field" style={{ margin: 0, minWidth: 150 }}>
          <span>Sampai Tanggal</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(1)
            }}
            aria-label="Sampai tanggal"
          />
        </div>

        {(action || resourceType || from || to) && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setAction('')
              setResourceType('')
              setFrom('')
              setTo('')
              setPage(1)
            }}
          >
            Reset Filter
          </button>
        )}
      </div>

      {isPending ? (
        <p className="loading-indicator">Memuat jejak audit…</p>
      ) : data && data.data.length > 0 ? (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Waktu Kejadian</th>
                  <th>Aksi</th>
                  <th>Pelaku (User)</th>
                  <th>Sumber Daya</th>
                  <th>Alasan / Catatan</th>
                  <th>IP Address</th>
                  <th>Rincian</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }} className="num">
                      {formatTimestamp(log.created_at)}
                    </td>
                    <td>
                      <span className={`badge ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      {log.user ? (
                        <strong>{log.user.name}</strong>
                      ) : (
                        <span className="hint">Sistem</span>
                      )}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem' }}>{log.resource_type}</code>
                    </td>
                    <td>{log.reason ?? '—'}</td>
                    <td className="num">
                      <small className="hint">{log.ip_address ?? '—'}</small>
                    </td>
                    <td>
                      {(log.old_values || log.new_values) ? (
                        <button
                          type="button"
                          className="secondary"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => setSelectedEntry(log)}
                        >
                          Lihat Data
                        </button>
                      ) : (
                        <span className="hint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.meta.total > data.meta.per_page && (
            <div className="row between" style={{ marginTop: 12 }}>
              <span className="hint">
                Menampilkan {data.data.length} dari {data.meta.total} rekaman log (Halaman {data.meta.page})
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={page * data.meta.per_page >= data.meta.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="Tidak ada catatan audit yang cocok"
          description="Cobalah untuk mengatur ulang filter pencarian atau rentang tanggal kejadian."
        />
      )}

      {/* Modal Detail Perubahan Data */}
      {selectedEntry && (
        <div className="sidebar-backdrop show" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} role="dialog" aria-labelledby="detail-title">
            <h2 id="detail-title">Rincian Perubahan Log</h2>
            <p className="hint">
              Aksi <code>{selectedEntry.action}</code> pada {formatTimestamp(selectedEntry.created_at)} oleh {selectedEntry.user?.name ?? 'Sistem'}
            </p>

            {selectedEntry.reason && (
              <div style={{ marginBottom: 16, padding: '8px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                <strong>Alasan:</strong> {selectedEntry.reason}
              </div>
            )}

            <div className="grid-2">
              <div>
                <h4>Nilai Lama (Sebelum)</h4>
                <pre style={{ background: 'var(--bg)', padding: 10, borderRadius: 6, fontSize: '0.8rem', overflowX: 'auto' }}>
                  {selectedEntry.old_values ? JSON.stringify(selectedEntry.old_values, null, 2) : 'Tidak ada (Baru dibuat)'}
                </pre>
              </div>
              <div>
                <h4>Nilai Baru (Sesudah)</h4>
                <pre style={{ background: 'var(--bg)', padding: 10, borderRadius: 6, fontSize: '0.8rem', overflowX: 'auto' }}>
                  {selectedEntry.new_values ? JSON.stringify(selectedEntry.new_values, null, 2) : 'Tidak ada'}
                </pre>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
              <button type="button" onClick={() => setSelectedEntry(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

