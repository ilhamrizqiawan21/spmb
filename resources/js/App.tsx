import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout, RequireAuth } from './components/Layout'
import { AuthProvider } from './features/auth/AuthContext'
import { AdminPage } from './pages/admin/AdminPage'
import { ApplicationPage } from './pages/ApplicationPage'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from './pages/AuthPages'
import { DashboardPage } from './pages/DashboardPage'
import { FinancePage } from './pages/FinancePage'
import { AnnouncementLookupPage, HomePage, PeriodsPage } from './pages/PublicPages'
import { AssessmentPage } from './pages/AssessmentPage'
import { SelectionPage } from './pages/SelectionPage'
import { VerificationDetailPage } from './pages/VerificationDetailPage'
import { VerificationPage } from './pages/VerificationPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
                <Route path="applications/:id" element={<ApplicationPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['document.verify', 'application.verify', 'application.override']} />}>
                <Route path="verifikasi" element={<VerificationPage />} />
                <Route path="verifikasi/:id" element={<VerificationDetailPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['assessment.input', 'assessment.approve', 'application.override']} />}>
                <Route path="penilaian" element={<AssessmentPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['application.override', 'enrollment.manage']} />}>
                <Route path="admin" element={<AdminPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['assessment.approve', 'application.override']} />}>
                <Route path="seleksi" element={<SelectionPage />} />
              </Route>
              <Route element={<RequireAuth permissions={['payment.read', 'payment.verify', 'application.override']} />}>
                <Route path="keuangan" element={<FinancePage />} />
              </Route>
              <Route path="*" element={<p>Halaman tidak ditemukan.</p>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
