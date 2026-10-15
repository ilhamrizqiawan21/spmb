import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

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
]

export function Layout() {
  const { user, can } = useAuth()
  const location = useLocation()
  // The mobile sidebar is open only on the page where it was opened; navigating away closes it automatically.
  const [openOn, setOpenOn] = useState<string | null>(null)
  const sidebarOpen = openOn === location.pathname

  // Check authentication & staff privileges
  const isAuthenticated = !!user
  const isStaff = !!user && can(...STAFF_PERMISSIONS)

  return (
    <div className={`app-shell ${isAuthenticated ? 'layout-staff' : 'layout-portal'}`}>
      <a className="skip-link" href="#main">Langsung ke konten</a>

      {isAuthenticated && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setOpenOn(null)}
        />
      )}

      <div className="app-main-wrapper">
        <Topbar
          isStaff={isStaff}
          onToggleSidebar={() => setOpenOn(sidebarOpen ? null : location.pathname)}
          isSidebarOpen={sidebarOpen}
        />

        <main id="main" className={`container ${isAuthenticated ? 'container-fluid' : ''}`} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function RequireAuth({ permissions }: { permissions?: string[] }) {
  const { user, loading, can } = useAuth()
  const location = useLocation()
  if (loading) return <p role="status" className="loading-indicator">Memuat data…</p>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (permissions && !can(...permissions)) return <p className="error" role="alert">Anda tidak memiliki akses ke halaman ini.</p>
  return <Outlet />
}
