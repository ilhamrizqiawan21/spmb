import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../components/Field'
import { Icon } from '../components/Icon'
import { useAuth } from '../features/auth/AuthContext'
import { api } from '../lib/api'
import type { AdmissionPeriod, Applicant, Application, ReportSummary } from '../types/api'

const STAFF_PERMISSIONS = [
  'application.read',
  'document.verify',
  'application.verify',
  'assessment.input',
  'assessment.approve',
  'payment.read',
  'payment.verify',
  'enrollment.manage',
  'mpls.manage',
  'application.override',
  'user.manage',
  'audit.read',
]

/**
 * Dashboard Khusus Staf / Panitia SPMB
 */
function StaffDashboard() {
  const { user, can } = useAuth()
  const canReadReports = can('application.read', 'application.override')

  const summary = useQuery({
    queryKey: ['report-summary', 'dashboard'],
    queryFn: () => api<ReportSummary>('/reports/summary'),
    enabled: canReadReports,
  })

  const s = summary.data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header Sambutan Staf */}
      <div
        className="card"
        style={{
          margin: 0,
          padding: '24px 28px',
          background: 'linear-gradient(135deg, var(--card) 0%, var(--surface) 100%)',
          borderLeft: '5px solid var(--brand)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: 'var(--brand-light)',
                  color: 'var(--brand-dark)',
                }}
              >
                Panel Operasional SPMB
              </span>
              <span className="hint" style={{ fontSize: '0.85rem' }}>
                T.A. 2026/2027
              </span>
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.45rem', color: 'var(--brand)' }}>
              Selamat Datang Kembali, {user?.name}
            </h1>
            <p className="hint" style={{ margin: 0, fontSize: '0.9rem', maxWidth: 650, lineHeight: 1.5 }}>
              Pusat kendali dan navigasi kerja penerimaan murid baru. Pantau metrik penerimaan, tindak lanjuti antrean verifikasi, asesmen, seleksi, hingga peresmian siswa baru.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {canReadReports && (
              <Link to="/ringkasan" className="button secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon name="bar-chart" size={16} /> Laporan Detail
              </Link>
            )}
            <Link to="/pendaftaran" className="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon name="file-text" size={16} /> Menu Pendaftaran
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Metrik Ringkasan Utama (KPI Operasional) */}
      {canReadReports && s && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="activity" size={18} />
              Ringkasan Operasional Terkini
            </h2>
            <Link to="/ringkasan" className="link" style={{ fontSize: '0.85rem' }}>
              Lihat Analisis Lengkap →
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div className="card" style={{ margin: 0, padding: 18, borderTop: '3px solid var(--brand)' }}>
              <span className="hint" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Total Calon Siswa
              </span>
              <strong style={{ fontSize: '1.75rem', color: 'var(--brand)', display: 'block' }}>
                {s.total}
              </strong>
              <small className="hint" style={{ fontSize: '0.78rem' }}>
                Pendaftaran seluruh gelombang
              </small>
            </div>

            <div className="card" style={{ margin: 0, padding: 18, borderTop: '3px solid var(--warning)' }}>
              <span className="hint" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Menunggu Verifikasi
              </span>
              <strong style={{ fontSize: '1.75rem', color: 'var(--warning)', display: 'block' }}>
                {s.work_queue.awaiting_verification}
              </strong>
              <Link to="/verifikasi" className="link" style={{ fontSize: '0.78rem', display: 'inline-block', marginTop: 2 }}>
                Buka Antrean Verifikasi →
              </Link>
            </div>

            <div className="card" style={{ margin: 0, padding: 18, borderTop: '3px solid var(--info)' }}>
              <span className="hint" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Siap Keputusan Seleksi
              </span>
              <strong style={{ fontSize: '1.75rem', color: 'var(--info)', display: 'block' }}>
                {s.work_queue.awaiting_decision}
              </strong>
              <Link to="/seleksi" className="link" style={{ fontSize: '0.78rem', display: 'inline-block', marginTop: 2 }}>
                Buka Penetapan Seleksi →
              </Link>
            </div>

            <div className="card" style={{ margin: 0, padding: 18, borderTop: '3px solid #8b5cf6' }}>
              <span className="hint" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Verifikasi Pembayaran
              </span>
              <strong style={{ fontSize: '1.75rem', color: '#8b5cf6', display: 'block' }}>
                {s.finance?.pending_payments ?? 0}
              </strong>
              <Link to="/keuangan" className="link" style={{ fontSize: '0.78rem', display: 'inline-block', marginTop: 2 }}>
                Buka Konfirmasi Bayar →
              </Link>
            </div>

            <div className="card" style={{ margin: 0, padding: 18, borderTop: '3px solid var(--success)' }}>
              <span className="hint" style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Siswa Baru Siap NIS
              </span>
              <strong style={{ fontSize: '1.75rem', color: 'var(--success)', display: 'block' }}>
                {s.work_queue.awaiting_enrollment}
              </strong>
              <Link to="/siswa" className="link" style={{ fontSize: '0.78rem', display: 'inline-block', marginTop: 2 }}>
                Buka Daftar Siswa Baru →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 3. Pintasan Modul Kerja Berdasarkan Hak Akses */}
      <section>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="check-circle" size={18} />
            Akses Cepat Modul Kerja
          </h2>
          <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
            Akses langsung ke menu-menu operasional SPMB sesuai izin akun Anda.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {can('document.verify', 'application.verify', 'application.override') && (
            <Link
              to="/verifikasi"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                transition: 'border-color 0.15s ease, transform 0.15s ease',
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="file-text" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Verifikasi Berkas
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Tinjau kelengkapan dokumen persyaratan dan validasi berkas pendaftar.
                </span>
              </div>
            </Link>
          )}

          {can('assessment.input', 'assessment.approve', 'application.override') && (
            <Link
              to="/jadwal-asesmen"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="calendar" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Jadwal Asesmen
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Atur sesi tes seleksi, wawancara, dan penetapan ruang uji calon siswa.
                </span>
              </div>
            </Link>
          )}

          {can('assessment.input', 'assessment.approve', 'application.override') && (
            <Link
              to="/penilaian"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="clipboard" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Penilaian & Skor
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Input nilai tes akademik, wawancara, dan skor komponen seleksi.
                </span>
              </div>
            </Link>
          )}

          {can('assessment.approve', 'application.override') && (
            <Link
              to="/seleksi"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="award" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Penetapan Seleksi
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Kalkulasi ranking, penetapan kelulusan, cadangan, dan surat pengumuman.
                </span>
              </div>
            </Link>
          )}

          {can('payment.read', 'payment.verify', 'application.override') && (
            <Link
              to="/keuangan"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="dollar-sign" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Keuangan & Pembayaran
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Verifikasi bukti transfer biaya formulir dan daftar ulang calon murid.
                </span>
              </div>
            </Link>
          )}

          {can('enrollment.manage', 'application.override', 'mpls.manage') && (
            <Link
              to="/siswa"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="user-check" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Siswa Baru & NIS
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Konfirmasi calon siswa yang telah lolos seleksi dan terbitkan Nomor Induk Siswa.
                </span>
              </div>
            </Link>
          )}

          {can('mpls.manage', 'application.override') && (
            <Link
              to="/mpls"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="users" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Kegiatan MPLS
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Pengelompokan siswa baru, penugasan pendamping, dan agenda masa orientasi.
                </span>
              </div>
            </Link>
          )}

          {can('application.override', 'enrollment.manage') && (
            <Link
              to="/admin"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="settings" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Data Master SPMB
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Pengaturan gelombang pendaftaran, tahun akademik, dan kuota penerimaan.
                </span>
              </div>
            </Link>
          )}

          {can('application.override') && (
            <Link
              to="/admin/dashboard"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="shield" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Kontrol Sistem (Super Admin)
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Status infrastruktur, pembersihan cache, antrean jobs, dan pemulihan sistem.
                </span>
              </div>
            </Link>
          )}

          {can('user.manage', 'application.override') && (
            <Link
              to="/pengguna"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="users" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Pengguna & Staf
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Kelola akun administrator, penguji, verifikator, staf keuangan, dan hak akses.
                </span>
              </div>
            </Link>
          )}

          {can('audit.read', 'application.override') && (
            <Link
              to="/audit-logs"
              className="card"
              style={{
                margin: 0,
                padding: 16,
                textDecoration: 'none',
                color: 'inherit',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <div style={{ padding: 10, borderRadius: 8, background: 'var(--bg)', color: 'var(--brand)', flexShrink: 0 }}>
                <Icon name="history" size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '0.95rem', display: 'block', color: 'var(--brand)', marginBottom: 2 }}>
                  Jejak Audit
                </strong>
                <span className="hint" style={{ fontSize: '0.825rem', lineHeight: 1.4 }}>
                  Catatan riwayat aktivitas pengguna, perubahan data sensitif, dan log sistem.
                </span>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* 4. Alur Kerja SPMB Terpadu */}
      <section className="card" style={{ margin: 0, padding: 22 }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', color: 'var(--brand)' }}>
          Alur Kerja Standar Operasional SPMB
        </h3>
        <p className="hint" style={{ margin: '0 0 16px 0', fontSize: '0.85rem' }}>
          Tahapan baku proses penerimaan peserta didik baru dari registrasi hingga masa orientasi.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--brand)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand)', display: 'block' }}>Tahap 1</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '2px 0' }}>Registrasi Berkas</strong>
            <small className="hint">Orang tua melengkapi biodata & dokumen syarat.</small>
          </div>
          <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--warning)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning)', display: 'block' }}>Tahap 2</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '2px 0' }}>Verifikasi Dokumen</strong>
            <small className="hint">Pemeriksaan keaslian & validitas berkas.</small>
          </div>
          <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--info)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--info)', display: 'block' }}>Tahap 3</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '2px 0' }}>Asesmen & Seleksi</strong>
            <small className="hint">Penjadwalan ujian, skoring, & perangkingan.</small>
          </div>
          <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #8b5cf6' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b5cf6', display: 'block' }}>Tahap 4</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '2px 0' }}>Daftar Ulang & Biaya</strong>
            <small className="hint">Pengumuman kelulusan & verifikasi transfer.</small>
          </div>
          <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--success)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', display: 'block' }}>Tahap 5</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '2px 0' }}>Siswa Baru & MPLS</strong>
            <small className="hint">Penerbitan NIS resmi & kegiatan orientasi.</small>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * Dashboard Khusus Orang Tua / Wali Calon Siswa (Parent Portal)
 */
function ParentDashboard() {
  const { user } = useAuth()

  const applicants = useQuery({ queryKey: ['applicants'], queryFn: () => api<Applicant[]>('/admission/applicants') })
  const applications = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/admission/applications') })
  const periods = useQuery({ queryKey: ['periods'], queryFn: () => api<AdmissionPeriod[]>('/admission/periods?is_active=true', { auth: false }) })

  const appList = applications.data ?? []
  const applicantList = applicants.data ?? []
  const activePeriods = periods.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Header Sambutan Orang Tua */}
      <div
        className="card"
        style={{
          margin: 0,
          padding: '26px 30px',
          background: 'linear-gradient(135deg, var(--card) 0%, var(--surface) 100%)',
          borderLeft: '5px solid var(--brand)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: 'var(--brand-light)',
                  color: 'var(--brand-dark)',
                }}
              >
                Portal Pendaftaran Murid Baru
              </span>
              <span className="hint" style={{ fontSize: '0.85rem' }}>
                Tahun Ajaran 2026/2027
              </span>
            </div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.45rem', color: 'var(--brand)' }}>
              Selamat Datang, {user?.name}
            </h1>
            <p className="hint" style={{ margin: 0, fontSize: '0.9rem', maxWidth: 640, lineHeight: 1.5 }}>
              Selamat datang di sistem pendaftaran murid baru terpadu. Daftarkan putra-putri Anda, unggah dokumen persyaratan, ikuti proses seleksi, dan pantau pengumuman penerimaan secara online.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/pendaftaran" className="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px' }}>
              <Icon name="file-text" size={16} /> Buka Menu Pendaftaran
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Ringkasan Status Pendaftaran Anak Saya */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="users" size={18} />
              Status Pendaftaran Putra-Putri Anda
            </h2>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              {applicantList.length > 0
                ? `${applicantList.length} profil calon siswa tersimpan pada akun keluarga Anda.`
                : 'Daftar pendaftaran aktif calon siswa baru pada akun keluarga Anda.'}
            </p>
          </div>
          <Link to="/pendaftaran" className="button secondary" style={{ fontSize: '0.85rem' }}>
            + Daftarkan Siswa Baru
          </Link>
        </div>

        {applications.isLoading || applicants.isLoading ? (
          <p className="loading-indicator">Memuat status pendaftaran…</p>
        ) : appList.length === 0 ? (
          <div
            className="card"
            style={{
              margin: 0,
              padding: '36px 20px',
              textAlign: 'center',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--line)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                color: 'var(--brand)',
              }}
            >
              <Icon name="file-text" size={24} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>Belum Ada Pendaftaran Calon Siswa</h3>
            <p className="hint" style={{ margin: '0 auto 18px', maxWidth: 480, fontSize: '0.875rem', lineHeight: 1.5 }}>
              Anda belum mendaftarkan calon siswa pada gelombang penerimaan ini. Mulai dengan mengisi data diri anak dan memilih gelombang masuk.
            </p>
            <Link to="/pendaftaran" className="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon name="plus" size={16} /> Mulai Pendaftaran Sekarang
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {appList.map((app) => (
              <div
                key={app.id}
                className="card"
                style={{
                  margin: 0,
                  padding: 20,
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--brand)', display: 'block' }}>
                        {app.applicant_name}
                      </strong>
                      <span className="hint" style={{ fontSize: '0.825rem' }}>
                        Gelombang: <strong>{app.period_name}</strong>
                      </span>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    <div>
                      <strong>No. Registrasi:</strong>{' '}
                      {app.registration_number ? (
                        <code style={{ fontWeight: 700, color: 'var(--brand)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>
                          {app.registration_number}
                        </code>
                      ) : (
                        <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Draf Belum Dikirim</span>
                      )}
                    </div>
                    {app.submitted_at && (
                      <div>
                        <strong>Tanggal Kirim:</strong>{' '}
                        {new Date(app.submitted_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {app.status === 'DRAFT'
                      ? 'Lengkapi berkas pendaftaran'
                      : app.status === 'SUBMITTED'
                        ? 'Menunggu verifikasi berkas'
                        : app.status === 'ACCEPTED'
                          ? 'Selamat! Calon siswa diterima'
                          : 'Proses seleksi berlangsung'}
                  </span>
                  <Link to={`/applications/${app.id}`} className="button" style={{ fontSize: '0.825rem', padding: '5px 14px' }}>
                    {app.status === 'DRAFT' || app.status === 'REVISION_REQUIRED' ? 'Lanjutkan Berkas' : 'Lihat Detail'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Panduan Alur Pendaftaran SPMB (6 Langkah) */}
      <section className="card" style={{ margin: 0, padding: 22 }}>
        <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: 'var(--brand)' }}>
          Tahapan & Alur Pendaftaran Murid Baru
        </h3>
        <p className="hint" style={{ margin: '0 0 16px 0', fontSize: '0.85rem' }}>
          Ikuti 6 langkah mudah proses penerimaan peserta didik baru hingga resmi terdaftar di sekolah.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--brand)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand)', display: 'block' }}>Langkah 1</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '3px 0' }}>Biodata Siswa</strong>
            <small className="hint">Lengkapi identitas anak, NISN, NIK, dan data orang tua/wali.</small>
          </div>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--brand)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand)', display: 'block' }}>Langkah 2</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '3px 0' }}>Unggah Berkas</strong>
            <small className="hint">Upload akta kelahiran, KK, pas foto, dan rapor sekolah asal.</small>
          </div>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--warning)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning)', display: 'block' }}>Langkah 3</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '3px 0' }}>Verifikasi & Tes</strong>
            <small className="hint">Panitia memverifikasi berkas dan menerbitkan jadwal asesmen.</small>
          </div>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--info)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--info)', display: 'block' }}>Langkah 4</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '3px 0' }}>Pengumuman</strong>
            <small className="hint">Cek hasil kelulusan seleksi dan unduh surat penerimaan.</small>
          </div>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid #8b5cf6' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8b5cf6', display: 'block' }}>Langkah 5</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '3px 0' }}>Daftar Ulang</strong>
            <small className="hint">Konfirmasi kesediaan dan selesaikan administrasi daftar ulang.</small>
          </div>
          <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderTop: '3px solid var(--success)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', display: 'block' }}>Langkah 6</span>
            <strong style={{ fontSize: '0.875rem', display: 'block', margin: '3px 0' }}>Siswa Baru & MPLS</strong>
            <small className="hint">Dapatkan NIS resmi dan ikuti kegiatan Masa Pengenalan Lingkungan Sekolah.</small>
          </div>
        </div>
      </section>

      {/* 4. Gelombang Pendaftaran Aktif & Bantuan Kontak */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <section className="card" style={{ margin: 0, padding: 20 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.05rem', color: 'var(--brand)' }}>
            Gelombang Masuk Aktif
          </h3>
          {activePeriods.length === 0 ? (
            <p className="hint">Belum ada gelombang pendaftaran yang sedang dibuka saat ini.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activePeriods.map((p) => (
                <div key={p.id} style={{ padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.925rem' }}>{p.name}</strong>
                    <span className="badge" style={{ fontSize: '0.75rem', background: 'var(--success-light)', color: 'var(--success)' }}>
                      Dibuka
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                    Periode: {new Date(p.registration_start).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} s.d.{' '}
                    {new Date(p.registration_end).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {p.quota != null && <span> • Kuota: {p.quota} siswa</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" style={{ margin: 0, padding: 20 }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.05rem', color: 'var(--brand)' }}>
            Pusat Bantuan & Layanan SPMB
          </h3>
          <p className="hint" style={{ margin: '0 0 12px 0', fontSize: '0.85rem' }}>
            Membutuhkan informasi seputar persyaratan berkas, alur seleksi, atau kendala teknis?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.85rem' }}>
            <div>
              <strong>Sekretariat Panitia SPMB:</strong> Gedung Administrasi Lt. 1
            </div>
            <div>
              <strong>Jam Layanan:</strong> Senin – Jumat, 08.00 – 15.00 WIB
            </div>
            <div>
              <strong>Hotline WhatsApp:</strong> <span style={{ color: 'var(--brand)', fontWeight: 600 }}>0812-3456-7890</span>
            </div>
            <div>
              <strong>Email SPMB:</strong> <span style={{ color: 'var(--brand)' }}>spmb@sekolah.sch.id</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

/**
 * Halaman Utama Dashboard (Halaman Awal Setelah Login)
 * Secara otomatis menyesuaikan tampilan bagi Staf / Admin atau Orang Tua / Calon Siswa
 */
export function DashboardPage() {
  const { user, can } = useAuth()
  const isStaff = !!user && can(...STAFF_PERMISSIONS)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {isStaff ? <StaffDashboard /> : <ParentDashboard />}
    </div>
  )
}
