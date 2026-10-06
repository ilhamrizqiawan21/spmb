import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Field } from '../components/Field'
import { useAuth } from '../features/auth/AuthContext'
import { ApiError, api, fieldErrors } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await login(String(f.get('identifier')), String(f.get('password')))
      navigate((location.state as { from?: string } | null)?.from ?? '/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card narrow" onSubmit={onSubmit}>
      <h1>Masuk</h1>
      <Field label="Email atau nomor HP" name="identifier" required autoComplete="username" />
      <Field label="Kata sandi" name="password" type="password" required autoComplete="current-password" />
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
      <p><Link to="/forgot-password">Lupa kata sandi?</Link></p>
      <p>Belum punya akun? <Link to="/register">Daftar</Link></p>
    </form>
  )
}

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setBusy(true)
    setError(null)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: String(f.get('email')) }, auth: false })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim permintaan.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="card narrow">
        <h1>Periksa email Anda</h1>
        <p>Jika email terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim. Tautan berlaku 60 menit.</p>
        <p><Link to="/login">Kembali ke halaman masuk</Link></p>
      </div>
    )
  }

  return (
    <form className="card narrow" onSubmit={onSubmit}>
      <h1>Lupa Kata Sandi</h1>
      <p>Masukkan email akun Anda. Akun yang hanya memakai nomor HP perlu menghubungi panitia.</p>
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? 'Memproses…' : 'Kirim tautan'}</button>
      <p><Link to="/login">Kembali ke halaman masuk</Link></p>
    </form>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password'))
    if (password !== String(f.get('confirm'))) {
      setErrors({ confirm: 'Konfirmasi kata sandi tidak sama.' })
      return
    }
    setBusy(true)
    setErrors({})
    try {
      await api('/auth/reset-password', { method: 'POST', body: { email, token, password }, auth: false })
      // The server revoked every token of this account; drop any stale local session too.
      await logout().catch(() => undefined)
      navigate('/login', { replace: true })
    } catch (err) {
      setErrors(fieldErrors(err))
      if (!(err instanceof ApiError)) setErrors({ password: 'Gagal mengatur ulang kata sandi.' })
    } finally {
      setBusy(false)
    }
  }

  if (!email || !token) {
    return (
      <div className="card narrow">
        <h1>Tautan tidak valid</h1>
        <p><Link to="/forgot-password">Minta tautan baru</Link></p>
      </div>
    )
  }

  return (
    <form className="card narrow" onSubmit={onSubmit}>
      <h1>Atur Ulang Kata Sandi</h1>
      <Field label="Kata sandi baru (min. 8 karakter)" name="password" type="password" required minLength={8} autoComplete="new-password" error={errors.password} />
      <Field label="Ulangi kata sandi baru" name="confirm" type="password" required minLength={8} autoComplete="new-password" error={errors.confirm} />
      {errors.token && (
        <p className="error" role="alert">
          Tautan sudah tidak berlaku. <Link to="/forgot-password">Minta tautan baru</Link>
        </p>
      )}
      <button disabled={busy}>{busy ? 'Memproses…' : 'Simpan kata sandi'}</button>
    </form>
  )
}

export function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = {
      name: String(f.get('name')),
      email: String(f.get('email') || '') || null,
      phone: String(f.get('phone') || '') || null,
      password: String(f.get('password')),
    }
    setBusy(true)
    setErrors({})
    try {
      await api('/auth/register', { method: 'POST', body, auth: false })
      await login(body.email ?? body.phone ?? '', body.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setErrors(fieldErrors(err))
      if (!(err instanceof ApiError)) setErrors({ name: 'Gagal mendaftar.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card narrow" onSubmit={onSubmit}>
      <h1>Daftar Akun Orang Tua/Wali</h1>
      <Field label="Nama lengkap" name="name" required error={errors.name} />
      <Field label="Email" name="email" type="email" error={errors.email ?? errors.identifier} />
      <Field label="Nomor HP" name="phone" error={errors.phone} />
      <Field label="Kata sandi (min. 8 karakter)" name="password" type="password" required minLength={8} error={errors.password} />
      <button disabled={busy}>{busy ? 'Memproses…' : 'Buat akun'}</button>
      <p>Sudah punya akun? <Link to="/login">Masuk</Link></p>
    </form>
  )
}
