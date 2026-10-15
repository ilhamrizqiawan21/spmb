import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout, RequireAuth } from './components/Layout'
import { AuthProvider } from './features/auth/AuthContext'
import { ThemeProvider } from './features/theme/ThemeContext'
import { AccountPage } from './pages/AccountPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminPage } from './pages/admin/AdminPage'
import { ApplicationPage } from './pages/ApplicationPage'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'
import { DashboardPage } from './pages/DashboardPage'
import { RegistrationPage } from './pages/RegistrationPage'
import { FinancePage } from './pages/FinancePage'
import { AnnouncementLookupPage, HomePage, PeriodsPage } from './pages/PublicPages'
import { AssessmentPage } from './pages/AssessmentPage'
import { SchedulePage } from './pages/SchedulePage'
import { MplsPage } from './pages/mpls/MplsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SelectionPage } from './pages/SelectionPage'
import { StudentsPage } from './pages/StudentsPage'
import { AuditLogPage } from './pages/AuditLogPage'
import { UsersPage } from './pages/UsersPage'
import { VerificationDetailPage } from './pages/VerificationDetailPage'
import { VerificationPage } from './pages/VerificationPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="periods" element={<PeriodsPage />} />
              <Route path="hasil" element={<AnnouncementLookupPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<RegisterPage />} />
              <Route path="forgot-password" element={<ForgotPasswordPage />} />
              <Route path="reset-password" element={<ResetPasswordPage />} />
              <Route element={<RequireAuth />}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="pendaftaran" element={<RegistrationPage />} />
                <Route path="akun" element={<AccountPage />} />
                <Route path="applications/:id" element={<ApplicationPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['document.verify', 'application.verify', 'application.override']} />}>
                <Route path="verifikasi" element={<VerificationPage />} />
                <Route path="verifikasi/:id" element={<VerificationDetailPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['assessment.input', 'assessment.approve', 'application.override']} />}>
                <Route path="jadwal-asesmen" element={<SchedulePage />} />
                <Route path="penilaian" element={<AssessmentPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['application.override']} />}>
                <Route path="admin/dashboard" element={<AdminDashboardPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['application.override', 'enrollment.manage']} />}>
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['user.manage', 'application.override']} />}>
                <Route path="pengguna" element={<UsersPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['audit.read', 'application.override']} />}>
                <Route path="audit-logs" element={<AuditLogPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['assessment.approve', 'application.override']} />}>
                <Route path="seleksi" element={<SelectionPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['payment.read', 'payment.verify', 'application.override']} />}>
                <Route path="keuangan" element={<FinancePage />} />
              </Route>
              <Route element={<RequireAuth permissions={['application.read', 'application.override']} />}>
                <Route path="ringkasan" element={<ReportsPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['enrollment.manage', 'application.override', 'mpls.manage']} />}>
                <Route path="siswa" element={<StudentsPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['mpls.manage', 'application.override']} />}>
                <Route path="mpls" element={<MplsPage />} />
              </Route>
              <Route path="*" element={<p>Halaman tidak ditemukan.</p>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  )
}
