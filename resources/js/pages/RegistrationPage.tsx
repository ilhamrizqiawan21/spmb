import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import { Field, StatusBadge } from '../components/Field'
import { FormError } from '../components/Notice'
import { PageHeader } from '../components/PageHeader'
import { ApiError, api } from '../lib/api'
import { applyServerErrors, emptyToNull, isoDate, optionalDigits, optionalText, requiredText } from '../lib/validation'
import type { AdmissionPeriod, Applicant, Application } from '../types/api'

const applicantSchema = z.object({
  full_name: requiredText(200),
  gender: z.enum(['MALE', 'FEMALE'], { message: 'Pilih jenis kelamin.' }),
  birth_place: requiredText(150),
  birth_date: isoDate,
  religion: optionalText(50),
  nisn: optionalDigits(10, 'NISN'),
  nik: optionalDigits(16, 'NIK'),
  address: z.string().trim().min(1, 'Wajib diisi.'),
  city: optionalText(100),
  previous_school_name: optionalText(200),
})
type ApplicantInput = z.input<typeof applicantSchema>
const APPLICANT_FIELDS = Object.keys(applicantSchema.shape)

/**
 * Formulir Tambah Data Calon Siswa Baru
 */
function NewApplicantForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<ApplicantInput>({
    resolver: zodResolver(applicantSchema),
    defaultValues: { full_name: '', birth_place: '', birth_date: '', religion: '', nisn: '', nik: '', address: '', city: '', previous_school_name: '' },
  })
  const e = formState.errors

  const onSubmit = handleSubmit(async (v) => {
    setError(null)
    try {
      await api<Applicant>('/admission/applicants', { method: 'POST', body: emptyToNull(v) })
      await qc.invalidateQueries({ queryKey: ['applicants'] })
      onDone()
    } catch (err) {
      setError(applyServerErrors(err, setFieldError, APPLICANT_FIELDS))
    }
  })

  return (
    <form
      className="card"
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="applicant-title"
      style={{
        marginTop: 16,
        padding: 20,
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
        <h3 id="applicant-title" style={{ margin: 0, fontSize: '1.05rem', color: 'var(--brand)' }}>
          Formulir Biodata Calon Siswa Baru
        </h3>
        <button type="button" className="link" onClick={onDone} style={{ fontSize: '0.85rem' }}>
          Tutup Formulir ✕
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="row">
          <div style={{ flex: 2, minWidth: 260 }}>
            <Field label="Nama Lengkap Calon Siswa" required {...register('full_name')} error={e.full_name?.message} placeholder="Nama sesuai akta kelahiran" />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="field required">
              <span>Jenis Kelamin *</span>
              <select {...register('gender')} defaultValue="" aria-invalid={!!e.gender}>
                <option value="" disabled>Pilih jenis kelamin…</option>
                <option value="MALE">Laki-laki</option>
                <option value="FEMALE">Perempuan</option>
              </select>
              {e.gender && <small className="error">{e.gender.message}</small>}
            </label>
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Tempat Lahir" required {...register('birth_place')} error={e.birth_place?.message} placeholder="Kota kelahiran" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Tanggal Lahir" type="date" required {...register('birth_date')} error={e.birth_date?.message} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Field label="Agama" {...register('religion')} error={e.religion?.message} placeholder="Islam / lainnya" />
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field
              label="NISN"
              inputMode="numeric"
              maxLength={10}
              {...register('nisn')}
              error={e.nisn?.message}
              hint="10 digit nomor NISN nasional"
              placeholder="10 digit NISN"
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field
              label="NIK"
              inputMode="numeric"
              maxLength={16}
              {...register('nik')}
              error={e.nik?.message}
              hint="16 digit sesuai Kartu Keluarga"
              placeholder="16 digit NIK"
            />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Field label="Sekolah Asal (TK / SD / SMP)" {...register('previous_school_name')} error={e.previous_school_name?.message} placeholder="Nama sekolah asal sebelumnya" />
          </div>
        </div>

        <div className="row">
          <div style={{ flex: 2, minWidth: 280 }}>
            <Field label="Alamat Domisili Lengkap" required {...register('address')} error={e.address?.message} placeholder="Jalan, RT/RW, Kelurahan, Kecamatan" />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Field label="Kota / Kabupaten" {...register('city')} error={e.city?.message} placeholder="Kota tempat tinggal" />
          </div>
        </div>

        <FormError message={error} />

        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button type="submit" className="button" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Menyimpan…' : 'Simpan Data Calon Siswa'}
          </button>
          <button type="button" className="button secondary" onClick={onDone}>
            Batal
          </button>
        </div>
      </div>
    </form>
  )
}

/**
 * Pendaftaran Calon Siswa ke Gelombang Aktif
 */
function StartApplication({ applicant, periods }: { applicant: Applicant; periods: AdmissionPeriod[] }) {
  const qc = useQueryClient()
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? '')
  const start = useMutation({
    mutationFn: () => api<Application>('/admission/applications', { method: 'POST', body: { applicant_id: applicant.id, admission_period_id: periodId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications'] })
    },
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <select
        value={periodId}
        onChange={(e) => setPeriodId(e.target.value)}
        aria-label="Periode"
        style={{ fontSize: '0.85rem', padding: '6px 10px' }}
      >
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} {p.quota != null ? `(Kuota: ${p.quota})` : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="button"
        style={{ padding: '6px 14px', fontSize: '0.85rem' }}
        onClick={() => start.mutate()}
        disabled={!periodId || start.isPending}
      >
        {start.isPending ? 'Mendaftarkan…' : 'Daftarkan ke Gelombang Ini'}
      </button>
      {start.error && (
        <small className="error" style={{ display: 'block', width: '100%' }}>
          {start.error instanceof ApiError ? start.error.message : 'Gagal memulai pendaftaran.'}
        </small>
      )}
    </div>
  )
}

/**
 * Halaman Pendaftaran Calon Siswa Baru
 */
export function RegistrationPage() {
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const applicants = useQuery({ queryKey: ['applicants'], queryFn: () => api<Applicant[]>('/admission/applicants') })
  const applications = useQuery({ queryKey: ['applications'], queryFn: () => api<Application[]>('/admission/applications') })
  const periods = useQuery({ queryKey: ['periods'], queryFn: () => api<AdmissionPeriod[]>('/admission/periods?is_active=true', { auth: false }) })

  if (applicants.isPending || applications.isPending) {
    return <p className="loading-indicator">Memuat informasi pendaftaran…</p>
  }

  const appList = applications.data ?? []
  const applicantList = applicants.data ?? []

  // Filter pendaftaran
  const filteredApps = appList.filter((a) => {
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchName = a.applicant_name.toLowerCase().includes(q)
      const matchReg = (a.registration_number ?? '').toLowerCase().includes(q)
      const matchPeriod = a.period_name.toLowerCase().includes(q)
      if (!matchName && !matchReg && !matchPeriod) return false
    }
    return true
  })

  // Dapatkan ID applicant yang sudah didaftarkan ke gelombang
  const registeredApplicantIds = new Set(appList.map((a) => a.applicant_id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Portal Pendaftaran Calon Siswa"
        description="Kelola berkas dan pantau proses seleksi pendaftaran putra-putri Anda pada gelombang penerimaan murid baru."
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/dashboard" className="button secondary">
              ← Kembali ke Dashboard
            </Link>
            <button
              type="button"
              className="button"
              onClick={() => setAdding(!adding)}
            >
              {adding ? 'Tutup Formulir' : '+ Tambah Calon Siswa'}
            </button>
          </div>
        }
      />

      {/* Form Tambah Calon Siswa Baru */}
      {adding && <NewApplicantForm onDone={() => setAdding(false)} />}

      {/* 1. Bagian Daftar Pendaftaran Saya */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Daftar Pendaftaran Saya
              <span className="badge" style={{ marginLeft: 6, fontSize: '0.8rem', verticalAlign: 'middle' }}>
                {appList.length} Pendaftaran
              </span>
            </h2>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Klik tombol pendaftaran untuk melengkapi berkas persyaratan, melihat jadwal asesmen, atau mengecek pengumuman kelulusan.
            </p>
          </div>
        </div>

        {/* Toolbar Filter */}
        <div className="row" style={{ alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 2, minWidth: 240 }}>
            <Field
              label="Cari Pendaftaran"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari berdasarkan nama calon siswa, nomor registrasi, atau gelombang…"
            />
          </div>

          <label className="field" style={{ flex: 1, minWidth: 180 }}>
            <span>Filter Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">Semua Status ({appList.length})</option>
              <option value="DRAFT">Draf (Belum Dikirim)</option>
              <option value="SUBMITTED">Terkirim (Menunggu Verifikasi)</option>
              <option value="VERIFIED">Terverifikasi</option>
              <option value="REVISION_REQUIRED">Perlu Perbaikan Berkas</option>
              <option value="ASSESSMENT_SCHEDULED">Jadwal Asesmen Terbit</option>
              <option value="ACCEPTED">Lolos Seleksi (Diterima)</option>
              <option value="RE_REGISTRATION">Daftar Ulang</option>
              <option value="ENROLLED">Resmi Terdaftar</option>
            </select>
          </label>

          {(search || statusFilter !== 'ALL') && (
            <button
              type="button"
              className="button secondary"
              style={{ marginBottom: 2 }}
              onClick={() => {
                setSearch('')
                setStatusFilter('ALL')
              }}
            >
              Reset Filter
            </button>
          )}
        </div>

        {appList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, color: 'var(--muted)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.05rem' }}>Belum Ada Pendaftaran Aktif</h3>
            <p className="hint" style={{ margin: '0 0 16px 0', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
              Silakan tambahkan data calon siswa di bawah ini terlebih dahulu, lalu pilih gelombang pendaftaran yang tersedia untuk mendaftar.
            </p>
            <button type="button" className="button" onClick={() => setAdding(true)}>
              + Tambah Calon Siswa Sekarang
            </button>
          </div>
        ) : filteredApps.length === 0 ? (
          <p className="hint" style={{ textAlign: 'center', padding: '24px 0' }}>
            Tidak ditemukan pendaftaran yang cocok dengan filter pencarian.
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '18%' }}>No. Registrasi</th>
                  <th style={{ width: '28%' }}>Nama Calon Siswa</th>
                  <th style={{ width: '18%' }}>Gelombang</th>
                  <th style={{ width: '16%' }}>Waktu</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.registration_number ? (
                        <code
                          style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: 'var(--brand)',
                            background: 'var(--bg)',
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}
                        >
                          {a.registration_number}
                        </code>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 4,
                            background: 'var(--warning-light)',
                            color: 'var(--warning)',
                            fontWeight: 700,
                            fontSize: '0.78rem',
                          }}
                        >
                          DRAF
                        </span>
                      )}
                    </td>
                    <td>
                      <Link
                        to={`/applications/${a.id}`}
                        style={{
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: 'var(--brand)',
                          textDecoration: 'none',
                          display: 'block',
                        }}
                      >
                        {a.applicant_name}
                      </Link>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.875rem' }}>{a.period_name}</strong>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                        {a.submitted_at ? (
                          <div>
                            <strong>Tgl Submit:</strong>{' '}
                            {new Date(a.submitted_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        ) : a.created_at ? (
                          <div>
                            <strong>Draf:</strong>{' '}
                            {new Date(a.created_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        ) : (
                          '—'
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <StatusBadge status={a.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/applications/${a.id}`}
                        className="button"
                        style={{
                          fontSize: '0.8rem',
                          padding: '4px 12px',
                          textDecoration: 'none',
                          display: 'inline-block',
                        }}
                      >
                        {a.status === 'DRAFT' || a.status === 'REVISION_REQUIRED' ? 'Lanjutkan' : 'Detail'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2. Bagian Data Calon Siswa & Pendaftaran Gelombang Baru */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Data Calon Siswa Terdaftar
              <span className="badge" style={{ marginLeft: 6, fontSize: '0.8rem', verticalAlign: 'middle' }}>
                {applicantList.length} Siswa
              </span>
            </h2>
            <p className="hint" style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
              Daftar profil calon siswa pada akun Anda. Pilih gelombang pendaftaran yang aktif untuk mendaftarkan calon siswa ke proses seleksi baru.
            </p>
          </div>
          {!adding && (
            <button type="button" className="button secondary" onClick={() => setAdding(true)}>
              + Tambah Calon Siswa
            </button>
          )}
        </div>

        {applicantList.length === 0 ? (
          <p className="hint">Belum ada data calon siswa yang disimpan.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {applicantList.map((a) => {
              const hasRegistered = registeredApplicantIds.has(a.id)
              return (
                <div
                  key={a.id}
                  className="card"
                  style={{
                    margin: 0,
                    padding: 16,
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--brand)' }}>{a.full_name}</strong>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontWeight: 600,
                          background: a.gender === 'MALE' ? 'var(--info-light)' : 'var(--danger-light)',
                          color: a.gender === 'MALE' ? 'var(--info)' : 'var(--danger)',
                        }}
                      >
                        {a.gender === 'MALE' ? 'Laki-laki' : 'Perempuan'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.825rem', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div>
                        <strong>Lahir:</strong> {a.birth_place},{' '}
                        {new Date(a.birth_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      {a.nisn && (
                        <div>
                          <strong>NISN:</strong> <code>{a.nisn}</code>
                        </div>
                      )}
                      {a.nik && (
                        <div>
                          <strong>NIK:</strong> <code>{a.nik}</code>
                        </div>
                      )}
                      {a.religion && (
                        <div>
                          <strong>Agama:</strong> {a.religion}
                        </div>
                      )}
                      {a.address && (
                        <div style={{ marginTop: 2 }}>
                          <strong>Alamat:</strong> {a.address}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pendaftaran Gelombang untuk Anak ini */}
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                    {periods.data && periods.data.length > 0 ? (
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                          {hasRegistered ? 'Daftarkan ke Gelombang Lain:' : 'Pilih Gelombang Masuk:'}
                        </span>
                        <StartApplication applicant={a} periods={periods.data} />
                      </div>
                    ) : (
                      <p className="hint" style={{ margin: 0, fontSize: '0.8rem' }}>
                        Tidak ada gelombang pendaftaran yang sedang aktif saat ini.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
