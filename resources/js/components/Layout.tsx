import { useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

interface NavItem {
  to: string
  label: string
  perms?: string[]
}

const PUBLIC_NAV: NavItem[] = [
  { to: '/periods', label: 'Periode' },
  { to: '/hasil', label: 'Cek Hasil' },
]

const STAFF_NAV: NavItem[] = [
  { to: '/ringkasan', label: 'Dashboard', perms: ['application.read', 'application.override'] },
  { to: '/verifikasi', label: 'Verifikasi', perms: ['document.verify', 'application.verify', 'application.override'] },
  { to: '/penilaian', label: 'Penilaian', perms: ['assessment.input', 'assessment.approve', 'application.override'] },
  { to: '/seleksi', label: 'Seleksi', perms: ['assessment.approve', 'application.override'] },
  { to: '/keuangan', label: 'Keuangan', perms: ['payment.read', 'payment.verify', 'application.override'] },
  { to: '/siswa', label: 'Siswa', perms: ['enrollment.manage', 'application.override', 'mpls.manage'] },
  { to: '/mpls', label: 'MPLS', perms: ['mpls.manage', 'application.override'] },
  { to: '/admin', label: 'Data Master', perms: ['application.override', 'enrollment.manage'] },
]

export function Layout() {
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // The mobile menu is open only on the page where it was opened, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const open = openOn === location.pathname

  async function signOut() {
    await logout()
    // Go home explicitly so the next sign-in does not land on the previous user's page.
    navigate('/', { replace: true })
  }

  const links = [
    ...PUBLIC_NAV,
    ...(user ? [{ to: '/dashboard', label: 'Pendaftaran' }] : []),
    ...STAFF_NAV.filter((i) => !i.perms || can(...i.perms)),
  ]

  return (
    <>
      <a className="skip-link" href="#main">Langsung ke konten</a>
      <header className="topbar">
        <Link to="/" className="brand">SPMB Terpadu 2026/2027</Link>
        <button className="menu-toggle secondary" aria-expanded={open} aria-controls="main-nav" onClick={() => setOpenOn(open ? null : location.pathname)}>
          Menu
        </button>
        <nav id="main-nav" className={open ? 'open' : ''} aria-label="Navigasi utama">
          {links.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
          {user ? (
            <>
              <NavLink to="/akun">Akun ({user.name})</NavLink>
              <button className="link" onClick={() => void signOut()}>Keluar</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Masuk</NavLink>
              <NavLink to="/register">Daftar</NavLink>
            </>
          )}
        </nav>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}

export function RequireAuth({ permissions }: { permissions?: string[] }) {
  const { user, loading, can } = useAuth()
  const location = useLocation()
  if (loading) return <p role="status">Memuat…</p>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (permissions && !can(...permissions)) return <p className="error">Anda tidak memiliki akses ke halaman ini.</p>
  return <Outlet />
}
