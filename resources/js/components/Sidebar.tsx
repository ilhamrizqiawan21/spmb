import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'

interface NavItem {
  to: string
  label: string
  perms: string[]
  iconSvg: string
}

interface NavGroup {
  heading: string
  items: NavItem[]
}

const STAFF_GROUPS: NavGroup[] = [
  {
    heading: 'Dashboard & Ringkasan',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        perms: [
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
        ],
        iconSvg: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
      },
      {
        to: '/admin/dashboard',
        label: 'Kontrol Sistem',
        perms: ['application.override'],
        iconSvg: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V17a1 1 0 0 1-2 0v-.07A8 8 0 0 1 4.07 10H5a1 1 0 0 1 0 2 8 8 0 0 0 7 7 8 8 0 0 0 7-7 1 1 0 0 1 0-2h.93A8 8 0 0 1 13 16.93z',
      },
      {
        to: '/ringkasan',
        label: 'Laporan Ringkasan',
        perms: ['application.read', 'application.override'],
        iconSvg: 'M3 3v18h18 M9 15v4 M13 11v8 M17 7v12',
      },
    ],
  },
  {
    heading: 'Operasional Seleksi',
    items: [
      {
        to: '/verifikasi',
        label: 'Verifikasi',
        perms: ['document.verify', 'application.verify', 'application.override'],
        iconSvg: 'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
      },
      {
        to: '/jadwal-asesmen',
        label: 'Jadwal Asesmen',
        perms: ['assessment.input', 'assessment.approve', 'application.override'],
        iconSvg: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
      },
      {
        to: '/penilaian',
        label: 'Penilaian',
        perms: ['assessment.input', 'assessment.approve', 'application.override'],
        iconSvg: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
      },
      {
        to: '/seleksi',
        label: 'Seleksi',
        perms: ['assessment.approve', 'application.override'],
        iconSvg: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6 M18 9h1.5a2.5 2.5 0 0 0 0-5H18 M4 22h16 M10 14.66V17c0 .55-.45 1-1 1H7 M14 14.66V17c0 .55.45 1 1 1h2 M18 2H6v7a6 6 0 0 0 12 0V2z',
      },
    ],
  },
  {
    heading: 'Kesiswaan & Biaya',
    items: [
      {
        to: '/keuangan',
        label: 'Keuangan',
        perms: ['payment.read', 'payment.verify', 'application.override'],
        iconSvg: 'M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
      },
      {
        to: '/siswa',
        label: 'Siswa Baru',
        perms: ['enrollment.manage', 'application.override', 'mpls.manage'],
        iconSvg: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
      },
      {
        to: '/mpls',
        label: 'MPLS',
        perms: ['mpls.manage', 'application.override'],
        iconSvg: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      },
    ],
  },
  {
    heading: 'Konfigurasi Sistem',
    items: [
      {
        to: '/admin',
        label: 'Data Master',
        perms: ['application.override', 'enrollment.manage'],
        iconSvg: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
      },
      {
        to: '/pengguna',
        label: 'Pengguna & Staf',
        perms: ['user.manage', 'application.override'],
        iconSvg: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
      },
      {
        to: '/audit-logs',
        label: 'Jejak Audit',
        perms: ['audit.read', 'application.override'],
        iconSvg: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01',
      },
    ],
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, can, logout } = useAuth()

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'show' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`} aria-label="Navigasi Panel Staf">
        <div className="sidebar-header">
          <Link to="/dashboard" className="sidebar-brand" onClick={onClose}>
            <span className="sidebar-brand-badge">SPMB</span>
            <div className="sidebar-brand-text">
              <strong>SPMB Terpadu</strong>
              <small>T.A. 2026/2027</small>
            </div>
          </Link>
        </div>

        <nav className="sidebar-nav" id="sidebar-nav">
          {STAFF_GROUPS.map((group) => {
            const accessibleItems = group.items.filter((item) => can(...item.perms))
            if (accessibleItems.length === 0) return null
            return (
              <div key={group.heading} className="sidebar-group">
                <span className="sidebar-heading">{group.heading}</span>
                <ul className="sidebar-menu">
                  {accessibleItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        onClick={onClose}
                      >
                        <svg
                          className="sidebar-icon"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d={item.iconSvg} />
                        </svg>
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}

          <div className="sidebar-group">
            <span className="sidebar-heading">Portal Pendaftaran</span>
            <ul className="sidebar-menu">
              <li>
                <NavLink
                  to="/pendaftaran"
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <svg
                    className="sidebar-icon"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
                  </svg>
                  <span>Pendaftaran</span>
                </NavLink>
              </li>
            </ul>
          </div>
        </nav>

        {user && (
          <div className="sidebar-footer">
            <div className="sidebar-user-info">
              <span className="sidebar-user-name" title={user.name}>{user.name}</span>
              <span className="sidebar-user-role">Panel Staf</span>
            </div>
            <div className="sidebar-footer-actions">
              <NavLink to="/akun" className="sidebar-account-btn" onClick={onClose} title="Pengaturan Akun">
                Akun
              </NavLink>
              <button
                type="button"
                className="link sidebar-logout-btn"
                onClick={() => {
                  onClose()
                  void logout()
                }}
              >
                Keluar
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}

