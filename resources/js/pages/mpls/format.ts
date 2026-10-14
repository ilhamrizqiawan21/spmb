import type { MplsAttendanceStatus } from '../../types/api'

export const ATTENDANCE_LABELS: Record<MplsAttendanceStatus, string> = {
  PRESENT: 'Hadir', SICK: 'Sakit', PERMITTED: 'Izin', ABSENT: 'Alpa',
}

export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
