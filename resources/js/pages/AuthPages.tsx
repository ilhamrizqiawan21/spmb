import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
      <p>Belum punya akun? <Link to="/register">Daftar</Link></p>
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
