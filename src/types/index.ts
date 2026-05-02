export type UserRole = 'doctor' | 'patient'
export type AppointmentStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'pending_payment'
export type Modality = 'presencial' | 'videollamada' | 'ambas'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone: string | null
  created_at: string
}

export interface DoctorProfile {
  id: string
  bio: string | null
  consultation_fee: number | null
  is_active: boolean
  created_at: string
}

export interface DoctorZone {
  id: string
  doctor_id: string
  department: string
  zone: string
}

export interface DoctorZoneSchedule {
  id: string
  zone_id: string
  day_of_week: number
  start_time: string
  end_time: string
  modality: Modality
}

export interface DoctorZoneWithSchedules extends DoctorZone {
  schedules: DoctorZoneSchedule[]
}

export interface Appointment {
  id: string
  doctor_id: string
  patient_id: string
  requested_date: string
  requested_time: string
  status: AppointmentStatus
  modality: Modality | null
  patient_notes: string | null
  doctor_notes: string | null
  created_at: string
}

export interface DoctorWithDetails {
  id: string
  bio: string | null
  consultation_fee: number | null
  is_active: boolean
  accepts_same_day: boolean
  slot_duration_minutes?: number
  profile: Profile
  specialties: { specialty: string }[]
  zones: DoctorZoneWithSchedules[]
}

export interface AppointmentWithPatient extends Appointment {
  patient: { full_name: string; phone: string | null } | null
}
