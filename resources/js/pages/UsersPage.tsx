import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { EmptyState } from '../components/EmptyState'
import { Field } from '../components/Field'
import { ErrorNote } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { useAuth } from '../features/auth/AuthContext'
import { api, fieldErrors } from '../lib/api'
import type { ManagedUser, ManagedUserPage, SystemRole } from '../types/api'

interface UserFormData {
  name: string
  email: string
  phone: string
  password?: string
  roles: string[]
  is_active?: boolean
  reason?: string
}

export function UsersPage() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)

  // Modals state
  const [isCreating, setIsCreating] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)

  // Query users
  const q = new URLSearchParams()
  if (search) q.set('search', search)
  if (roleFilter) q.set('role', roleFilter)
  q.set('page', String(page))

  const usersQuery = useQuery({
    queryKey: ['users', search, roleFilter, page],
    queryFn: () => api<ManagedUserPage>(`/users?${q}`),
  })

  // Query roles
  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<SystemRole[]>('/users/roles'),
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body: UserFormData) => api('/users', { method: 'POST', body }),
    onSuccess: async () => {
      setIsCreating(false)
      await qc.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserFormData }) =>
      api(`/users/${id}`, { method: 'PATCH', body }),
    onSuccess: async () => {
      setEditingUser(null)
      await qc.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api(`/users/${id}`, { method: 'PATCH', body: { is_active, reason: is_active ? 'Diaktifkan kembali' : 'Dinonaktifkan' } }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] })
    },
  })

  return (
    <section className="card">
      <PageHeader
        title="Manajemen Pengguna & Staf"
        description="Kelola akun pengguna, penetapan peran (role), dan hak akses staf SPMB."
        actions={
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            aria-label="Tambah Pengguna"
          >
            + Tambah Pengguna
          </button>
        }
      />

      <div className="row">
        <input
          type="search"
          placeholder="Cari nama / email / no. HP…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          aria-label="Cari pengguna"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          aria-label="Filter peran"
        >
          <option value="">Semua Peran</option>
          {rolesQuery.data?.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {usersQuery.isPending ? (
        <p className="loading-indicator">Memuat data pengguna…</p>
      ) : usersQuery.data && usersQuery.data.data.length > 0 ? (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nama Pengguna</th>
                  <th>Email</th>
                  <th>Peran (Role)</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.data.map((u) => {
                  const isSelf = currentUser?.id === u.id
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        {isSelf && <small className="hint" style={{ marginLeft: 6 }}>(Anda)</small>}
                      </td>
                      <td>{u.email ?? '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {u.roles.map((r) => (
                            <span key={r.code} className="badge">
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-verified' : 'badge-rejected'}`}>
                          {u.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setEditingUser(u)}
                            aria-label={`Edit ${u.name}`}
                          >
                            Edit
                          </button>
                          {!isSelf && (
                            <button
                              type="button"
                              className={u.is_active ? 'secondary danger' : 'secondary'}
                              onClick={() => toggleStatusMutation.mutate({ id: u.id, is_active: !u.is_active })}
                              aria-label={u.is_active ? `Nonaktifkan ${u.name}` : `Aktifkan ${u.name}`}
                            >
                              {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {usersQuery.data.meta.total > usersQuery.data.meta.per_page && (
            <div className="row between" style={{ marginTop: 12 }}>
              <span className="hint">
                Total {usersQuery.data.meta.total} pengguna (Halaman {usersQuery.data.meta.page})
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={page * usersQuery.data.meta.per_page >= usersQuery.data.meta.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          title="Tidak ada pengguna ditemukan"
          description="Coba ubah kata kunci pencarian atau filter peran yang dipilih."
        />
      )}

      {/* Modal / Form Tambah Pengguna */}
      {isCreating && (
        <CreateUserModal
          roles={rolesQuery.data ?? []}
          isPending={createMutation.isPending}
          error={createMutation.error}
          onClose={() => setIsCreating(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}

      {/* Modal / Form Edit Pengguna */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={rolesQuery.data ?? []}
          isPending={updateMutation.isPending}
          error={updateMutation.error}
          onClose={() => setEditingUser(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingUser.id, body: data })}
        />
      )}
    </section>
  )
}

function CreateUserModal({
  roles,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  roles: SystemRole[]
  isPending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (data: UserFormData) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const errors = fieldErrors(error)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      name,
      email,
      phone: phone || '',
      password,
      roles: selectedRoles,
    })
  }

  const toggleRole = (code: string) => {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code],
    )
  }

  return (
    <div className="sidebar-backdrop show" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} role="dialog" aria-labelledby="create-title">
        <h2 id="create-title">Tambah Pengguna Baru</h2>
        <ErrorNote error={error} />
        <form onSubmit={handleSubmit}>
          <Field label="Nama Lengkap" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Field label="Nomor Telepon (opsional)" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
          <Field label="Kata Sandi (min. 8 karakter)" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />

          <div className="field required">
            <span>Pilih Peran (Role)</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 4 }}>
              {roles.map((r) => (
                <label key={r.code} className="check" style={{ fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.code)}
                    onChange={() => toggleRole(r.code)}
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
            {errors.roles && <small className="error">{errors.roles}</small>}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="secondary" onClick={onClose} disabled={isPending}>
              Batal
            </button>
            <button type="submit" disabled={isPending || selectedRoles.length === 0}>
              {isPending ? 'Menyimpan…' : 'Simpan Pengguna'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditUserModal({
  user,
  roles,
  isPending,
  error,
  onClose,
  onSubmit,
}: {
  user: ManagedUser
  roles: SystemRole[]
  isPending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (data: UserFormData) => void
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles.map((r) => r.code))
  const errors = fieldErrors(error)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const payload: UserFormData = {
      name,
      email,
      phone: phone || '',
      roles: selectedRoles,
      reason: reason || undefined,
    }
    if (password) payload.password = password
    onSubmit(payload)
  }

  const toggleRole = (code: string) => {
    setSelectedRoles((prev) =>
      prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code],
    )
  }

  return (
    <div className="sidebar-backdrop show" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} role="dialog" aria-labelledby="edit-title">
        <h2 id="edit-title">Edit Pengguna: {user.name}</h2>
        <ErrorNote error={error} />
        <form onSubmit={handleSubmit}>
          <Field label="Nama Lengkap" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
          <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <Field label="Nomor Telepon" value={phone} onChange={(e) => setPhone(e.target.value)} error={errors.phone} />
          <Field
            label="Ganti Kata Sandi (kosongkan jika tidak diubah)"
            type="password"
            placeholder="Minimal 8 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <Field
            label="Alasan Perubahan (dicatat di jejak audit)"
            placeholder="Contoh: Penugasan verifikator gelombang 1"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={errors.reason}
          />

          <div className="field required">
            <span>Pilih Peran (Role)</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 4 }}>
              {roles.map((r) => (
                <label key={r.code} className="check" style={{ fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.code)}
                    onChange={() => toggleRole(r.code)}
                  />
                  <span>{r.name}</span>
                </label>
              ))}
            </div>
            {errors.roles && <small className="error">{errors.roles}</small>}
          </div>

          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="secondary" onClick={onClose} disabled={isPending}>
              Batal
            </button>
            <button type="submit" disabled={isPending || selectedRoles.length === 0}>
              {isPending ? 'Menyimpan…' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

