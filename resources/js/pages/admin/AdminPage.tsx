import { useState } from 'react'
import { useAuth } from '../../features/auth/AuthContext'
import { ResourceManager, type FieldDef } from './ResourceManager'

const YEAR: FieldDef[] = [
  { name: 'name', label: 'Nama', type: 'text', required: true, column: true },
  { name: 'start_date', label: 'Mulai', type: 'date', required: true, column: true },
  { name: 'end_date', label: 'Selesai', type: 'date', required: true, column: true },
  { name: 'is_active', label: 'Aktif', type: 'checkbox', column: true, defaultChecked: false },
]

const PERIOD: FieldDef[] = [
  { name: 'academic_year_id', label: 'Tahun ajaran', type: 'select', options: 'years', required: true, createOnly: true, column: true },
  { name: 'name', label: 'Nama', type: 'text', required: true, column: true },
  { name: 'code', label: 'Kode', type: 'text', required: true, column: true },
  { name: 'registration_start', label: 'Pendaftaran dibuka', type: 'datetime', required: true, column: true },
  { name: 'registration_end', label: 'Pendaftaran ditutup', type: 'datetime', required: true, column: true },
  { name: 'announcement_at', label: 'Pengumuman', type: 'datetime', nullable: true },
  { name: 'quota', label: 'Kuota', type: 'number', nullable: true, column: true },
  { name: 'is_active', label: 'Aktif', type: 'checkbox', column: true },
]

const DOC_REQ: FieldDef[] = [
  { name: 'admission_period_id', label: 'Periode', type: 'select', options: 'periods', createOnly: true, column: true },
  { name: 'name', label: 'Nama', type: 'text', required: true, column: true },
  { name: 'code', label: 'Kode', type: 'text', required: true, column: true },
  { name: 'description', label: 'Keterangan', type: 'text', nullable: true },
  { name: 'allowed_mime_types', label: 'Tipe file (pisahkan koma)', type: 'csv', column: true },
  { name: 'max_file_size_bytes', label: 'Ukuran maks (MB)', type: 'mb', column: true },
  { name: 'sort_order', label: 'Urutan', type: 'number' },
  { name: 'is_required', label: 'Wajib', type: 'checkbox', column: true },
  { name: 'is_active', label: 'Aktif', type: 'checkbox' },
]

const COMPONENT: FieldDef[] = [
  { name: 'admission_period_id', label: 'Periode', type: 'select', options: 'periods', required: true, createOnly: true, column: true },
  { name: 'name', label: 'Nama', type: 'text', required: true, column: true },
  { name: 'code', label: 'Kode', type: 'text', required: true, column: true },
  { name: 'weight', label: 'Bobot (%)', type: 'number', step: '0.01', required: true, column: true },
  { name: 'max_score', label: 'Nilai maks', type: 'number', step: '0.01', column: true },
  { name: 'sort_order', label: 'Urutan', type: 'number' },
  { name: 'is_active', label: 'Aktif', type: 'checkbox' },
]

const REREG: FieldDef[] = [
  { name: 'admission_period_id', label: 'Periode', type: 'select', options: 'periods', required: true, createOnly: true, column: true },
  { name: 'name', label: 'Nama', type: 'text', required: true, column: true },
  { name: 'code', label: 'Kode', type: 'text', required: true, column: true },
  { name: 'sort_order', label: 'Urutan', type: 'number', column: true },
  { name: 'is_required', label: 'Wajib', type: 'checkbox', column: true },
]

const TABS = [
  { id: 'years', label: 'Tahun Ajaran', perms: ['application.override'] },
  { id: 'periods', label: 'Periode', perms: ['application.override'] },
  { id: 'docs', label: 'Persyaratan Berkas', perms: ['application.override'] },
  { id: 'components', label: 'Komponen Seleksi', perms: ['application.override'] },
  { id: 'rereg', label: 'Persyaratan Daftar Ulang', perms: ['enrollment.manage', 'application.override'] },
] as const

export function AdminPage() {
  const { can } = useAuth()
  const tabs = TABS.filter((t) => can(...t.perms))
  const [tab, setTab] = useState<string>(tabs[0]?.id ?? '')

  return (
    <>
      <h1>Data Master</h1>
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? '' : 'secondary'} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === 'years' && <ResourceManager title="Tahun Ajaran" endpoint="/admission/academic-years" fields={YEAR} hint="Hanya satu tahun ajaran yang boleh aktif; mengaktifkan satu menonaktifkan yang lain." />}
      {tab === 'periods' && <ResourceManager title="Periode Pendaftaran" endpoint="/admission/periods" fields={PERIOD} hint="Waktu ditampilkan dalam zona waktu browser Anda. Tanggal pengumuman tidak boleh sebelum penutupan." />}
      {tab === 'docs' && <ResourceManager title="Persyaratan Berkas" endpoint="/admission/document-requirements" fields={DOC_REQ} hint="Tanpa periode = berlaku untuk semua periode. Persyaratan yang sudah dipakai hanya dinonaktifkan saat dihapus." />}
      {tab === 'components' && <ResourceManager title="Komponen Seleksi" endpoint="/selection/components" fields={COMPONENT} hint="Total bobot komponen aktif per periode tidak boleh melebihi 100%." />}
      {tab === 'rereg' && <ResourceManager title="Persyaratan Daftar Ulang" endpoint="/enrollment/requirements" fields={REREG} />}
    </>
  )
}
