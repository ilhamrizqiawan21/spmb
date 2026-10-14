import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { Field } from '../components/Field'
import { FormError } from '../components/Notice'
import { useAuth } from '../features/auth/AuthContext'
import { api, fieldErrors } from '../lib/api'
import { applyServerErrors, email, newPasswordSchema, optionalEmail, optionalPhone, password, requiredText } from '../lib/validation'

const loginSchema = z.object({ identifier: requiredText(255), password: z.string().min(1, 'Wajib diisi.') })

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { identifier: '', password: '' } })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await login(v.identifier, v.password)
      navigate((location.state as { from?: string } | null)?.from ?? '/dashboard', { replace: true })
    } catch (err) {
      setError(applyServerErrors(err, () => undefined, []) ?? 'Gagal masuk.')
    }
  })

  return (
    <form className="card narrow" onSubmit={onSubmit} noValidate>
      <h1>Masuk</h1>
      <Field label="Email atau nomor HP" autoComplete="username" required {...register('identifier')} error={formState.errors.identifier?.message} />
      <Field label="Kata sandi" type="password" autoComplete="current-password" required {...register('password')} error={formState.errors.password?.message} />
      <FormError message={error} />
      <button disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Memproses…' : 'Masuk'}</button>
      <p><Link to="/forgot-password">Lupa kata sandi?</Link></p>
      <p>Belum punya akun? <Link to="/register">Daftar</Link></p>
    </form>
  )
}

const forgotSchema = z.object({ email })

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email: v.email }, auth: false })
      setSent(true)
    } catch (err) {
      setError(applyServerErrors(err, () => undefined, []) ?? 'Gagal mengirim permintaan.')
    }
  })

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
    <form className="card narrow" onSubmit={onSubmit} noValidate>
      <h1>Lupa Kata Sandi</h1>
      <p>Masukkan email akun Anda. Akun yang hanya memakai nomor HP perlu menghubungi panitia.</p>
      <Field label="Email" type="email" autoComplete="email" required {...register('email')} error={formState.errors.email?.message} />
      <FormError message={error} />
      <button disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Memproses…' : 'Kirim tautan'}</button>
      <p><Link to="/login">Kembali ke halaman masuk</Link></p>
    </form>
  )
}

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const emailParam = params.get('email') ?? ''
  const token = params.get('token') ?? ''
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const { register, handleSubmit, formState, setError: setFieldError } = useForm({
    resolver: zodResolver(newPasswordSchema), defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await api('/auth/reset-password', { method: 'POST', body: { email: emailParam, token, password: v.password }, auth: false })
      // The server revoked every token of this account; drop any stale local session too.
      await logout().catch(() => undefined)
      navigate('/login', { replace: true })
    } catch (err) {
      if (fieldErrors(err).token) setExpired(true)
      else setError(applyServerErrors(err, setFieldError, ['password']))
    }
  })

  if (!emailParam || !token) {
    return (
      <div className="card narrow">
        <h1>Tautan tidak valid</h1>
        <p><Link to="/forgot-password">Minta tautan baru</Link></p>
      </div>
    )
  }

  return (
    <form className="card narrow" onSubmit={onSubmit} noValidate>
      <h1>Atur Ulang Kata Sandi</h1>
      <Field label="Kata sandi baru (min. 8 karakter)" type="password" autoComplete="new-password" required {...register('password')} error={formState.errors.password?.message} />
      <Field label="Ulangi kata sandi baru" type="password" autoComplete="new-password" required {...register('confirm')} error={formState.errors.confirm?.message} />
      {expired && (
        <p className="error" role="alert">
          Tautan sudah tidak berlaku. <Link to="/forgot-password">Minta tautan baru</Link>
        </p>
      )}
      <FormError message={error} />
      <button disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Memproses…' : 'Simpan kata sandi'}</button>
    </form>
  )
}

const registerSchema = z.object({ name: requiredText(150), email: optionalEmail, phone: optionalPhone, password })
  .refine((v) => v.email !== '' || v.phone !== '', { path: ['email'], message: 'Isi email atau nomor HP.' })
const REGISTER_FIELDS = ['name', 'email', 'phone', 'password'] as const

export function RegisterPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState, setError: setFieldError } = useForm({
    resolver: zodResolver(registerSchema), defaultValues: { name: '', email: '', phone: '', password: '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    const body = { name: v.name, email: v.email || null, phone: v.phone || null, password: v.password }
    try {
      await api('/auth/register', { method: 'POST', body, auth: false })
      await login(body.email ?? body.phone ?? '', body.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(applyServerErrors(err, setFieldError, REGISTER_FIELDS))
    }
  })

  return (
    <form className="card narrow" onSubmit={onSubmit} noValidate>
      <h1>Daftar Akun Orang Tua/Wali</h1>
      <Field label="Nama lengkap" autoComplete="name" required {...register('name')} error={formState.errors.name?.message} />
      <Field label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
      <Field label="Nomor HP" type="tel" autoComplete="tel" inputMode="tel" {...register('phone')} error={formState.errors.phone?.message}
        hint="Isi email atau nomor HP (boleh keduanya). Email diperlukan untuk reset kata sandi mandiri." />
      <Field label="Kata sandi (min. 8 karakter)" type="password" autoComplete="new-password" required {...register('password')} error={formState.errors.password?.message} />
      <FormError message={error} />
      <button disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Memproses…' : 'Buat akun'}</button>
      <p>Sudah punya akun? <Link to="/login">Masuk</Link></p>
    </form>
  )
}
