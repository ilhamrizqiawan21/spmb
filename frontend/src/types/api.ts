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

export interface QueueItem {
  id: string
  applicant_id: string
  applicant_name: string
  period_id: string
  period_name: string
  registration_number: string | null
  status: string
  assigned_verifier_id: string | null
  assigned_verifier_name: string | null
  document_counts: { total: number; pending: number; valid: number; invalid: number; revision_required: number }
}

export interface SelectionComponent {
  id: string
  admission_period_id: string
  name: string
  code: string
  weight: string
  max_score: string
}

export interface ApplicationScore {
  id: string
  application_id: string
  registration_number: string | null
  applicant_name: string
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
