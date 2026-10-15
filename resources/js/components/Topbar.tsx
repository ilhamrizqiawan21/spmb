import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { ThemeToggle } from './ThemeToggle'

interface TopbarProps {
  isStaff: boolean
  isAuthenticated?: boolean
  onToggleSidebar?: () => void
  isSidebarOpen?: boolean
}

const PUBLIC_NAV = [
  { to: '/periods', label: 'Periode' },
  { to: '/hasil', label: 'Cek Hasil' },
]

export function Topbar({ isStaff, isAuthenticated, onToggleSidebar, isSidebarOpen }: TopbarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function signOut() {
    await logout()
    navigate('/', { replace: true })
  }

  // Current page label for breadcrumbs
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/dashboard') return isStaff ? 'Dashboard Utama' : 'Dashboard Pendaftar'
    if (path.startsWith('/pendaftaran')) return 'Pendaftaran Calon Siswa'
    if (path.startsWith('/ringkasan')) return 'Laporan Ringkasan SPMB'
    if (path.startsWith('/verifikasi')) return 'Verifikasi Dokumen & Berkas'
    if (path.startsWith('/jadwal-asesmen')) return 'Jadwal Asesmen & Ujian Seleksi'
    if (path.startsWith('/penilaian')) return 'Penilaian & Skor Seleksi'
    if (path.startsWith('/seleksi')) return 'Penetapan Hasil Seleksi'
    if (path.startsWith('/keuangan')) return 'Keuangan & Pembayaran'
    if (path.startsWith('/siswa')) return 'Siswa Baru (Enrollment)'
    if (path.startsWith('/mpls')) return 'Manajemen Kegiatan MPLS'
    if (path.startsWith('/admin/dashboard')) return 'Kontrol Sistem & Super Admin'
    if (path.startsWith('/admin')) return 'Data Master Sistem'
    if (path.startsWith('/pengguna')) return 'Manajemen Pengguna & Staf'
    if (path.startsWith('/audit-logs')) return 'Jejak Audit Sistem'
    if (path.startsWith('/periods')) return 'Informasi Gelombang & Kuota'
    if (path.startsWith('/hasil')) return 'Pengumuman Hasil Seleksi'
    if (path.startsWith('/applications')) return 'Detail Berkas Pendaftaran'
    if (path.startsWith('/akun')) return 'Pengaturan Akun'
    return isStaff ? 'Panel Staf SPMB' : 'Portal Pendaftar SPMB'
  }

  const isUserLoggedIn = isAuthenticated ?? !!user

  // Unified topbar for all authenticated users (Staff and Parent/Applicant)
  if (isUserLoggedIn) {
    return (
      <header className="topbar topbar-staff">
        <div className="topbar-left">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Toggle navigasi sidebar"
            aria-expanded={isSidebarOpen}
            onClick={onToggleSidebar}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="topbar-context">
            <span className="topbar-context-badge">
              {isStaff ? 'PANEL STAF' : 'PORTAL PENDAFTAR'}
            </span>
            <span className="topbar-context-divider">/</span>
            <span className="topbar-context-title">{getPageTitle()}</span>
          </div>
        </div>

        <div className="topbar-right">
          <ThemeToggle />
          {user && (
            <div className="topbar-user">
              <NavLink to="/akun" className="topbar-user-link">
                Akun ({user.name})
              </NavLink>
              <button type="button" className="link topbar-logout" onClick={() => void signOut()}>
                Keluar
              </button>
            </div>
          )}
        </div>
      </header>
    )
  }

  // Public topbar for guests (not logged in)
  return (
    <header className="topbar topbar-public">
      <div className="topbar-public-left">
        <Link to="/" className="brand">
          <span className="brand-accent">SPMB</span> Terpadu 2026/2027
        </Link>
      </div>

      <nav className="topbar-nav" id="main-nav" aria-label="Navigasi utama">
        {PUBLIC_NAV.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {l.label}
          </NavLink>
        ))}
        <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : '')}>
          Masuk
        </NavLink>
        <NavLink to="/register" className={({ isActive }) => (isActive ? 'active' : '')}>
          Daftar
        </NavLink>
        <ThemeToggle />
      </nav>
    </header>
  )
}

