// Decimal values are serialized as strings by the API; timestamps are ISO-8601 UTC.
export interface User {
  id: string
  name: string
  email: string | null
  phone: string | null
  is_active: boolean
  roles: string[]
  permissions: string[]
}

export interface LoginResponse {
  token: string
  token_type: 'Bearer'
  user: User
}

export interface AdmissionPeriod {
  id: string
  academic_year_id: string
  name: string
  code: string
  registration_start: string
  registration_end: string
  announcement_at: string | null
  quota: number | null
  is_active: boolean
}

export interface Availability {
  period_id: string
  status: 'OPEN' | 'BEFORE_OPENING' | 'CLOSED' | 'PERIOD_INACTIVE' | 'ACADEMIC_YEAR_INACTIVE'
  is_open: boolean
  reason: string | null
}

export interface Applicant {
  id: string
  full_name: string
  gender: string
  birth_place: string
  birth_date: string
  address: string
  nisn: string | null
  nik: string | null
  religion: string | null
}

export interface Guardian {
  id: string
  relationship: 'FATHER' | 'MOTHER' | 'GUARDIAN'
  full_name: string
  phone: string | null
  is_primary_contact: boolean
}

export interface StatusHistory {
  id: string
  from_status: string | null
  to_status: string
  reason: string | null
  created_at: string
}

export interface Application {
  id: string
  applicant_id: string
  applicant_name: string
  admission_period_id: string
  period_name: string
  registration_number: string | null
  status: string
  submitted_at?: string | null
  verified_at?: string | null
  assessed_at?: string | null
  decided_at?: string | null
  enrolled_at?: string | null
  created_at?: string
  updated_at?: string
  current_step: number
  completion_percentage: number
  status_histories: StatusHistory[]
}

export interface DocumentRequirement {
  id: string
  name: string
  code: string
  is_required: boolean
  allowed_mime_types: string[]
  max_file_size_bytes: number
}

export interface ApplicationDocument {
  id: string
  requirement_id: string
  requirement_name: string
  original_filename: string
  status: 'PENDING' | 'VALID' | 'INVALID' | 'REVISION_REQUIRED'
  version: number
  verification_note: string | null
}

export interface AnnouncementResult {
  is_published: boolean
  message?: string
  registration_number: string
  applicant_name_masked?: string
  admission_period_name?: string
  decision?: 'ACCEPTED' | 'WAITLISTED' | 'REJECTED'
  next_steps?: string[]
}

export interface QueueItemDocument {
  requirement_id: string
  requirement_name: string
  requirement_code: string | null
  is_required: boolean
  is_uploaded: boolean
  document_id: string | null
  status: 'VALID' | 'PENDING' | 'REVISION_REQUIRED' | 'INVALID' | 'NOT_UPLOADED'
  original_filename: string | null
  file_size: number | null
  verification_note: string | null
  uploaded_at: string | null
  verified_at: string | null
}

export interface QueueItem {
  id: string
  applicant_id: string
  applicant_name: string
  period_id: string
  period_name: string
  period_start?: string | null
  period_end?: string | null
  registration_number: string | null
  status: string
  submitted_at: string | null
  created_at?: string | null
  assigned_verifier_id: string | null
  assigned_verifier_name: string | null
  document_counts: {
    total: number
    uploaded?: number
    pending: number
    valid: number
    invalid: number
    revision_required: number
    not_uploaded?: number
  }
  documents?: QueueItemDocument[]
}

export interface SelectionComponent {
  id: string
  admission_period_id: string
  period_name?: string
  name: string
  code: string
  description?: string | null
  weight: string
  max_score: string
  minimum_score?: string | null
  sort_order?: number
  is_active?: boolean
}

export interface ApplicationScore {
  id: string
  application_id: string
  registration_number: string | null
  applicant_name: string
  submitted_at?: string | null
  raw_score: string
  final_score: string
  rank: number | null
  assessments: { id: string; component_id: string; component_name: string; score: string; weighted_score: string | null }[]
}

export interface Decision {
  id: string
  decision: 'ACCEPTED' | 'WAITLISTED' | 'REJECTED'
  final_score: string | null
  rank: number | null
  reason: string | null
  published_at: string | null
}

export interface WaitingListEntry {
  id: string
  application_id: string
  registration_number: string | null
  applicant_name: string
  position: number
  score: string
  status: string
  promoted_at?: string | null
  created_at?: string | null
}

export interface ReRegistrationItem {
  id: string
  requirement_name: string
  is_required: boolean
  status: 'PENDING' | 'COMPLETED' | 'WAIVED'
  notes: string | null
}

export interface ReRegistration {
  id: string
  application_id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  items: ReRegistrationItem[]
}

export interface AnnouncementDetail {
  is_published: boolean
  message?: string
  decision?: 'ACCEPTED' | 'WAITLISTED' | 'REJECTED'
  final_score?: string | null
  rank?: number | null
  next_steps?: string[]
}

export interface StaffMember {
  id: string
  name: string
  roles: string[]
}

export interface AssessmentSchedule {
  id: string
  application_id: string
  registration_number: string | null
  applicant_name: string
  component_id: string
  component_name: string
  scheduled_at: string
  location: string | null
  room: string | null
  notes: string | null
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'REJECTED' | 'REFUNDED'
export type InvoiceStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'EXPIRED' | 'CANCELLED'

export interface Payment {
  id: string
  invoice_id: string
  invoice_number: string | null
  application_id: string | null
  registration_number: string | null
  applicant_name: string | null
  amount: string
  method: string
  reference_number: string | null
  status: PaymentStatus
  paid_at: string | null
  has_proof: boolean
  proof_filename: string | null
  verified_at: string | null
  verified_by_name: string | null
  verification_note: string | null
  created_at: string
}

export interface Invoice {
  id: string
  application_id: string
  invoice_number: string
  type: string
  amount: string
  paid_amount: string
  balance: string
  due_date: string | null
  status: InvoiceStatus
  description: string | null
  payments: Payment[]
  created_at: string
}

export interface PaymentPage {
  data: Payment[]
  meta: { page: number; per_page: number; total: number }
}

export interface Student {
  id: string
  student_number: string
  nisn: string | null
  full_name: string
  gender: string
  birth_place: string
  birth_date: string
  status: 'ACTIVE' | 'INACTIVE'
  enrollment: { id: string; status: 'ACTIVE' | 'CANCELLED'; enrolled_at: string; enrolled_by_name: string | null; notes: string | null }
  application_id: string
  registration_number: string
  admission_period_name: string | null
  academic_year_name: string | null
  created_at: string
}

export interface StudentPage {
  data: Student[]
  meta: { page: number; per_page: number; total: number }
}

export interface EnrollmentCandidate {
  application_id: string
  registration_number: string
  applicant_name: string
  nisn: string | null
  admission_period_name: string | null
  status: string
}

export interface ReportSummary {
  total: number
  by_status: Record<string, number>
  funnel: { key: string; label: string; total: number }[]
  work_queue: {
    awaiting_verification: number
    revision_required: number
    awaiting_decision: number
    re_registration_in_progress: number
    awaiting_enrollment: number
  }
  periods: {
    id: string
    name: string
    academic_year_name: string | null
    quota: number | null
    applications: number
    accepted: number
    enrolled: number
    remaining_quota: number | null
  }[]
  top_schools: { value: string; total: number }[]
  top_cities: { value: string; total: number }[]
  finance: { pending_payments: number; outstanding_invoices: number; paid_invoices: number; verified_amount: string } | null
}

export type MplsAttendanceStatus = 'PRESENT' | 'SICK' | 'PERMITTED' | 'ABSENT'

export interface MplsGroup {
  id: string
  academic_year_id: string
  academic_year_name: string | null
  name: string
  code: string
  capacity: number | null
  participant_count: number
  mentor_name: string | null
  description: string | null
}

export interface MplsEvent {
  id: string
  academic_year_id: string
  group_id: string | null
  group_name: string | null
  title: string
  description: string | null
  start_at: string
  end_at: string
  location: string | null
  is_mandatory: boolean
}

export interface MplsParticipant {
  id: string
  student_id: string
  student_number: string
  full_name: string
  group_id: string
  group_name: string
  group_code: string
  mentor_name: string | null
  status: 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN'
  joined_at: string
  completed_at: string | null
  attendance: { present: number; sick: number; permitted: number; absent: number }
  qr_token?: string
}

export interface MplsParticipantPage {
  data: MplsParticipant[]
  meta: { page: number; per_page: number; total: number }
}

export interface MplsAttendance {
  id: string
  event_id: string
  participant_id: string
  full_name: string | null
  status: MplsAttendanceStatus
  checked_at: string | null
  checked_by_name: string | null
  notes: string | null
}

export interface MplsRoster {
  event: MplsEvent
  rows: { participant_id: string; student_number: string; full_name: string; group_name: string; attendance: MplsAttendance | null }[]
}

export interface MplsPortal {
  participant: MplsParticipant
  events: (MplsEvent & { attendance_status: MplsAttendanceStatus | null })[]
}

export interface SchoolInfo {
  name: string | null
  address: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  office_hours: string | null
}

export interface SystemRole {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
}

export interface ManagedUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  is_active: boolean
  last_login: string | null
  created_at: string
  roles: { id: string; code: string; name: string }[]
}

export interface ManagedUserPage {
  data: ManagedUser[]
  meta: { page: number; per_page: number; total: number }
}

export interface AuditLogEntry {
  id: string
  action: string
  resource_type: string
  resource_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  reason: string | null
  user: { id: string; name: string } | null
  ip_address: string | null
  request_id: string | null
  created_at: string
}

export interface AuditLogPage {
  data: AuditLogEntry[]
  meta: { page: number; per_page: number; total: number }
}

export interface AdminDashboardData {
  health: {
    database: 'ok' | 'error'
    cache: 'ok' | 'error'
    environment: string
    php_version: string
    laravel_version: string
    queue: {
      pending_jobs: number
      failed_jobs: number
    }
    notifications: {
      sent_24h: number
      failed_24h: number
    }
    storage: {
      total_documents: number
      total_bytes: number
    }
  }
  alerts: {
    level: 'danger' | 'warning' | 'info'
    title: string
    message: string
  }[]
  governance: {
    total_users: number
    active_users: number
    inactive_users: number
    roles: {
      code: string
      name: string
      active_users_count: number
    }[]
  }
  academic_year: string | null
  periods: {
    id: string
    name: string
    code: string
    quota: number | null
    applications_count: number
    fill_percentage: number | null
    registration_start: string
    registration_end: string
    announcement_at?: string | null
    is_open: boolean
    is_active: boolean
  }[]
  recent_audits: {
    id: string
    action: string
    resource_type: string
    user_name: string
    reason: string | null
    ip_address: string | null
    created_at: string
  }[]
}


