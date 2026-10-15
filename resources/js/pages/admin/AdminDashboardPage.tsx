import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { PageHeader } from '../../components/PageHeader'
import { api } from '../../lib/api'
import type { AdminDashboardData } from '../../types/api'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function AdminDashboardPage() {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const { data, isPending, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<AdminDashboardData>('/system/admin-dashboard'),
  })

  async function handleClearCache() {
    if (!window.confirm('Bersihkan seluruh cache sistem dan data sementara sekarang?')) return
    setActionLoading('clear-cache')
    setFeedback(null)
    try {
      const res = await api<{ message: string }>('/system/actions/clear-cache', { method: 'POST' })
      setFeedback({ type: 'success', message: res.message })
      await refetch()
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: (e as Error)?.message || 'Gagal membersihkan cache aplikasi.' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRetryJobs() {
    if (!window.confirm('Jadwalkan ulang seluruh pekerjaan antrean yang gagal untuk diproses kembali?')) return
    setActionLoading('retry-jobs')
    setFeedback(null)
    try {
      const res = await api<{ message: string }>('/system/actions/retry-jobs', { method: 'POST' })
      setFeedback({ type: 'success', message: res.message })
      await refetch()
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: (e as Error)?.message || 'Gagal menjadwalkan ulang antrean.' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleFlushFailedJobs() {
    if (!window.confirm('Hapus seluruh riwayat pekerjaan antrean yang gagal secara permanen?')) return
    setActionLoading('flush-jobs')
    setFeedback(null)
    try {
      const res = await api<{ message: string }>('/system/actions/flush-failed-jobs', { method: 'POST' })
      setFeedback({ type: 'success', message: res.message })
      await refetch()
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: (e as Error)?.message || 'Gagal membersihkan antrean gagal.' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleTogglePeriod(id: string, name: string, currentActive: boolean) {
    const actionName = currentActive ? 'menonaktifkan' : 'mengaktifkan kembali'
    if (!window.confirm(`Yakin ingin ${actionName} gelombang '${name}'?`)) return
    setActionLoading(`toggle-${id}`)
    setFeedback(null)
    try {
      const res = await api<{ message: string }>('/system/actions/toggle-period/' + id, { method: 'POST' })
      setFeedback({ type: 'success', message: res.message })
      await refetch()
    } catch (e: unknown) {
      setFeedback({ type: 'error', message: (e as Error)?.message || 'Gagal mengubah status gelombang.' })
    } finally {
      setActionLoading(null)
    }
  }

  if (isPending) {
    return <p className="loading-indicator">Memuat metrik kontrol sistem…</p>
  }

  if (!data) {
    return (
      <EmptyState
        title="Gagal memuat kontrol sistem"
        description="Terjadi kendala saat mengambil status kesehatan dan kendali sistem."
        action={<button type="button" onClick={() => void refetch()}>Muat Ulang</button>}
      />
    )
  }

  const { health, alerts, governance, periods, academic_year, recent_audits } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Kontrol Sistem & Super Admin"
        description="Pusat kendali dan komando operasional infrastruktur, pembersihan cache, antrean tugas, tata kelola akun staf, dan audit keamanan sistem."
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/ringkasan" className="button secondary">
              📊 Funnel Pendaftaran
            </Link>
            <button type="button" onClick={() => void refetch()} aria-label="Segarkan data">
              Segarkan Status
            </button>
          </div>
        }
      />

      {/* Feedback banner aksi kontrol */}
      {feedback && (
        <div
          className="card"
          style={{
            margin: 0,
            padding: '12px 16px',
            borderColor: feedback.type === 'success' ? 'var(--brand)' : 'var(--danger)',
            background: feedback.type === 'success' ? 'var(--brand-light)' : 'var(--danger-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          role="status"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{feedback.type === 'success' ? '✅' : '❌'}</span>
            <strong>{feedback.message}</strong>
          </div>
          <button
            type="button"
            className="link"
            style={{ fontSize: '0.85rem' }}
            onClick={() => setFeedback(null)}
          >
            Tutup
          </button>
        </div>
      )}

      {/* 1. Baris Peringatan Dini & Anomali */}
      {alerts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`card`}
              style={{
                margin: 0,
                padding: '12px 16px',
                borderColor: alert.level === 'danger' ? 'var(--danger)' : 'var(--warning)',
                background: alert.level === 'danger' ? 'var(--danger-light)' : 'var(--warning-light)',
              }}
              role="alert"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.25rem' }}>
                  {alert.level === 'danger' ? '🚨' : '⚠️'}
                </span>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.95rem' }}>{alert.title}</strong>
                  <span style={{ fontSize: '0.875rem' }}>{alert.message}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="card"
          style={{
            margin: 0,
            padding: '12px 16px',
            borderColor: 'var(--brand)',
            background: 'var(--brand-light)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>🟢</span>
          <div>
            <strong>Kondisi Sistem Normal</strong>
            <span style={{ display: 'block', fontSize: '0.85rem' }}>
              Seluruh subsistem (Database, Cache, Antrean, dan Pengiriman Email) beroperasi tanpa hambatan.
            </span>
          </div>
        </div>
      )}

      {/* 2. Panel Kendali & Aksi Cepat Operasional */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.15rem' }}>Panel Kendali Operasional</h2>
            <small className="hint">Eksekusi kendali infrastruktur, pembersihan cache, dan penanganan antrean tugas langsung.</small>
          </div>
          <span className="badge badge-verified">Hak Akses Super Admin</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Aksi Cache */}
          <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)' }}>
            <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: 4 }}>🧹 Cache & Data Sementara</strong>
            <p className="hint" style={{ fontSize: '0.825rem', marginBottom: 12 }}>
              Bersihkan seluruh memory cache aplikasi dan template kompilasi saat ada pembaruan konfigurasi atau data.
            </p>
            <button
              type="button"
              className="button secondary"
              style={{ width: '100%', fontSize: '0.85rem' }}
              disabled={actionLoading !== null}
              onClick={() => void handleClearCache()}
            >
              {actionLoading === 'clear-cache' ? 'Membersihkan Cache…' : 'Bersihkan Cache Sistem'}
            </button>
          </div>

          {/* Aksi Queue Workers */}
          <div style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--bg)' }}>
            <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: 4 }}>⚙️ Manajemen Antrean Tugas</strong>
            <p className="hint" style={{ fontSize: '0.825rem', marginBottom: 12 }}>
              Status: <strong>{health.queue.failed_jobs}</strong> pekerjaan gagal. Jadwalkan ulang atau bersihkan log antrean yang bermasalah.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="button secondary"
                style={{ flex: 1, fontSize: '0.85rem' }}
                disabled={actionLoading !== null || health.queue.failed_jobs === 0}
                onClick={() => void handleRetryJobs()}
                title={health.queue.failed_jobs === 0 ? 'Tidak ada pekerjaan gagal' : 'Proses ulang'}
              >
                {actionLoading === 'retry-jobs' ? 'Menjadwalkan…' : '🔁 Proses Ulang'}
              </button>
              <button
                type="button"
                className="button secondary"
                style={{ flex: 1, fontSize: '0.85rem', color: health.queue.failed_jobs > 0 ? 'var(--danger)' : 'inherit' }}
                disabled={actionLoading !== null || health.queue.failed_jobs === 0}
                onClick={() => void handleFlushFailedJobs()}
                title={health.queue.failed_jobs === 0 ? 'Tidak ada pekerjaan gagal' : 'Hapus riwayat'}
              >
                {actionLoading === 'flush-jobs' ? 'Menghapus…' : '🗑️ Hapus Gagal'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Metrik Kesehatan Subsistem & Infrastruktur */}
      <div>
        <h2 style={{ fontSize: '1.15rem', marginBottom: 12 }}>Status Infrastruktur & Subsistem</h2>
        <div className="tiles">
          <div className="tile">
            <span className="tile-label">Database & Cache</span>
            <strong className="tile-value" style={{ color: health.database === 'ok' ? 'var(--brand)' : 'var(--danger)', fontSize: '1.4rem' }}>
              {health.database.toUpperCase()} / {health.cache.toUpperCase()}
            </strong>
            <small className="hint">PHP {health.php_version} • {health.environment}</small>
          </div>

          <div className="tile">
            <span className="tile-label">Antrean Pekerjaan</span>
            <strong className="tile-value" style={{ fontSize: '1.4rem' }}>
              {health.queue.pending_jobs} Pending
            </strong>
            <small className="hint" style={{ color: health.queue.failed_jobs > 0 ? 'var(--danger)' : 'inherit' }}>
              {health.queue.failed_jobs} Failed jobs
            </small>
          </div>

          <div className="tile">
            <span className="tile-label">Email Transaksional (24 Jam)</span>
            <strong className="tile-value" style={{ fontSize: '1.4rem' }}>
              {health.notifications.sent_24h} Terkirim
            </strong>
            <small className="hint" style={{ color: health.notifications.failed_24h > 0 ? 'var(--danger)' : 'inherit' }}>
              {health.notifications.failed_24h} Gagal kirim
            </small>
          </div>

          <div className="tile">
            <span className="tile-label">Dokumen & Berkas Terunggah</span>
            <strong className="tile-value" style={{ fontSize: '1.4rem' }}>
              {health.storage.total_documents} Berkas
            </strong>
            <small className="hint">{formatBytes(health.storage.total_bytes)}</small>
          </div>
        </div>
      </div>

      {/* 3. Grid Tata Kelola & Kuota Gelombang */}
      <div className="grid-2">
        {/* Kolom Tata Kelola Staf */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header between" style={{ display: 'flex', alignItems: 'center' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Tata Kelola Pengguna & Staf</h3>
            <Link to="/pengguna" className="button secondary" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
              Kelola Pengguna →
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <span className="hint" style={{ display: 'block', fontSize: '0.75rem' }}>TOTAL PENGGUNA</span>
              <strong style={{ fontSize: '1.25rem' }}>{governance.total_users}</strong>
            </div>
            <div>
              <span className="hint" style={{ display: 'block', fontSize: '0.75rem' }}>AKTIF</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--brand)' }}>{governance.active_users}</strong>
            </div>
            <div>
              <span className="hint" style={{ display: 'block', fontSize: '0.75rem' }}>NONAKTIF</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--muted)' }}>{governance.inactive_users}</strong>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Pos / Peran Staf</th>
                  <th className="num">Petugas Aktif</th>
                  <th>Status Pos</th>
                </tr>
              </thead>
              <tbody>
                {governance.roles.map((r) => (
                  <tr key={r.code}>
                    <td><strong>{r.name}</strong></td>
                    <td className="num">{r.active_users_count}</td>
                    <td>
                      {r.active_users_count > 0 ? (
                        <span className="badge badge-verified">Terisi</span>
                      ) : (
                        <span className="badge badge-rejected">Kosong</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Periode & Kuota */}
        <div className="card" style={{ margin: 0 }}>
          <div className="card-header between" style={{ display: 'flex', alignItems: 'center' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Periode Pendaftaran Aktif</h3>
              <small className="hint">Tahun Ajaran: {academic_year ?? 'Belum Diatur'}</small>
            </div>
            <Link to="/admin" className="button secondary" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
              Atur Master →
            </Link>
          </div>

          {periods.length === 0 ? (
            <p className="hint">Tidak ada gelombang pendaftaran aktif saat ini.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {periods.map((p) => (
                <div key={p.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                  <div className="between" style={{ display: 'flex', marginBottom: 6, alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong>{p.name}</strong>
                      <span className="hint">({p.code})</span>
                      <span className={`badge ${p.is_active ? 'badge-verified' : 'badge-rejected'}`} style={{ fontSize: '0.7rem' }}>
                        {p.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={`badge ${p.is_open ? 'badge-verified' : 'badge-draft'}`} style={{ fontSize: '0.75rem' }}>
                        {p.is_open ? 'Buka' : 'Tutup'}
                      </span>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        disabled={actionLoading !== null}
                        onClick={() => void handleTogglePeriod(p.id, p.name, p.is_active)}
                        title={p.is_active ? 'Nonaktifkan gelombang ini sementara' : 'Aktifkan kembali gelombang ini'}
                      >
                        {actionLoading === `toggle-${p.id}`
                          ? 'Menyimpan…'
                          : p.is_active
                          ? 'Nonaktifkan'
                          : 'Aktifkan'}
                      </button>
                    </div>
                  </div>

                  <div className="between" style={{ display: 'flex', fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
                    <span>Pendaftar Masuk: <strong>{p.applications_count}</strong></span>
                    <span>Kuota: <strong>{p.quota ?? 'Tidak Dibatasi'}</strong></span>
                  </div>

                  {p.quota && p.quota > 0 && (
                    <div style={{ width: '100%', height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, p.fill_percentage ?? 0)}%`,
                          background: (p.fill_percentage ?? 0) >= 90 ? 'var(--danger)' : 'var(--brand)',
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Rekaman Audit Terkini */}
      <div className="card" style={{ margin: 0 }}>
        <div className="card-header between" style={{ display: 'flex', alignItems: 'center' }}>
          <div>
            <h3 className="card-title" style={{ fontSize: '1.1rem' }}>Aktivitas Keamanan & Audit Terkini</h3>
            <small className="hint">6 aktivitas administratif dan mutasi data sensitif terbaru</small>
          </div>
          <Link to="/audit-logs" className="button secondary" style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
            Lihat Semua Audit →
          </Link>
        </div>

        {recent_audits.length === 0 ? (
          <p className="hint">Belum ada catatan aktivitas di sistem.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Aksi</th>
                  <th>Pelaku</th>
                  <th>Alasan / Keterangan</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {recent_audits.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap' }} className="num">{formatTime(a.created_at)}</td>
                    <td><code style={{ fontSize: '0.8rem' }}>{a.action}</code></td>
                    <td><strong>{a.user_name}</strong></td>
                    <td>{a.reason ?? '—'}</td>
                    <td className="num"><small className="hint">{a.ip_address ?? '—'}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

