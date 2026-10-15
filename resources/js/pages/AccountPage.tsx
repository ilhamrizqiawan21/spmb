import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Field } from '../components/Field'
import { FormError } from '../components/Notice'
import { useAuth } from '../features/auth/AuthContext'
import { api } from '../lib/api'
import { applyServerErrors, newPasswordSchema, optionalPhone, requiredText } from '../lib/validation'
import type { User } from '../types/api'

const profileSchema = z.object({ name: requiredText(150), phone: optionalPhone })

function ProfileForm({ user }: { user: User }) {
  const { setCurrentUser } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, formState, setError: setFieldError } = useForm({
    resolver: zodResolver(profileSchema), defaultValues: { name: user.name, phone: user.phone ?? '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    setSaved(false)
    try {
      setCurrentUser(await api<User>('/auth/me', { method: 'PATCH', body: { name: v.name, phone: v.phone || null } }))
      setSaved(true)
    } catch (err) {
      setError(applyServerErrors(err, setFieldError, ['name', 'phone']))
    }
  })

  return (
    <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="profile-title">
      <h2 id="profile-title">Profil</h2>
      <Field label="Nama lengkap" autoComplete="name" required {...register('name')} error={formState.errors.name?.message} />
      <Field label="Email" value={user.email ?? '—'} readOnly disabled hint="Email tidak bisa diubah sendiri. Hubungi panitia bila perlu mengganti email." />
      <Field label="Nomor HP" type="tel" inputMode="tel" autoComplete="tel" {...register('phone')} error={formState.errors.phone?.message} />
      <FormError message={error} />
      {saved && <p role="status">Profil tersimpan.</p>}
      <button disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Menyimpan…' : 'Simpan profil'}</button>
    </form>
  )
}

const changePasswordSchema = z.object({ current_password: z.string().min(1, 'Wajib diisi.') }).and(newPasswordSchema)

function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const { register, handleSubmit, formState, reset, setError: setFieldError } = useForm({
    resolver: zodResolver(changePasswordSchema), defaultValues: { current_password: '', password: '', confirm: '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    setDone(false)
    try {
      await api('/auth/change-password', { method: 'POST', body: { current_password: v.current_password, password: v.password } })
      reset()
      setDone(true)
    } catch (err) {
      setError(applyServerErrors(err, setFieldError, ['current_password', 'password']))
    }
  })

  return (
    <form className="card" onSubmit={onSubmit} noValidate aria-labelledby="password-title">
      <h2 id="password-title">Ganti Kata Sandi</h2>
      <Field label="Kata sandi saat ini" type="password" autoComplete="current-password" required {...register('current_password')} error={formState.errors.current_password?.message} />
      <Field label="Kata sandi baru (min. 8 karakter)" type="password" autoComplete="new-password" required {...register('password')} error={formState.errors.password?.message} />
      <Field label="Ulangi kata sandi baru" type="password" autoComplete="new-password" required {...register('confirm')} error={formState.errors.confirm?.message} />
      <FormError message={error} />
      {done && <p role="status">Kata sandi diganti. Sesi di perangkat lain telah dikeluarkan.</p>}
      <button disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Menyimpan…' : 'Ganti kata sandi'}</button>
    </form>
  )
}

export function AccountPage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="narrow">
      <h1>Akun Saya</h1>
      <ProfileForm user={user} />
      <ChangePasswordForm />
    </div>
  )
}
