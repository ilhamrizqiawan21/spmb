import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

export function Layout() {
  const { user, logout, can } = useAuth()
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">SPMB Terpadu 2026/2027</Link>
        <nav>
          <Link to="/periods">Periode</Link>
          <Link to="/hasil">Cek Hasil</Link>
          {user && <Link to="/dashboard">Pendaftaran</Link>}
          {can('document.verify', 'application.verify', 'application.override') && <Link to="/verifikasi">Verifikasi</Link>}
          {user ? (
            <button className="link" onClick={() => void logout()}>Keluar ({user.name})</button>
          ) : (
            <>
              <Link to="/login">Masuk</Link>
              <Link to="/register">Daftar</Link>
            </>
          )}
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}

export function RequireAuth({ permissions }: { permissions?: string[] }) {
  const { user, loading, can } = useAuth()
  const location = useLocation()
  if (loading) return <p>Memuat…</p>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (permissions && !can(...permissions)) return <p className="error">Anda tidak memiliki akses ke halaman ini.</p>
  return <Outlet />
}
