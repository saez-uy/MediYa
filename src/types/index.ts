export type UserRole = 'doctor' | 'patient'
export type AppointmentStatus = 'pending' | 'accepted' | 'rejected'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone: string | null
  created_at: string
}

export interface DoctorProfile {
  id: string
  specialty: string
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

export interface DoctorSchedule {
  id: string
  doctor_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

export interface Appointment {
  id: string
  doctor_id: string
  patient_id: string
  requested_date: string
  requested_time: string
  status: AppointmentStatus
  patient_notes: string | null
  doctor_notes: string | null
  created_at: string
}

export interface DoctorWithDetails {
  id: string
  specialty: string
  bio: string | null
  consultation_fee: number | null
  is_active: boolean
  profile: Profile
  zones: DoctorZone[]
  schedules: DoctorSchedule[]
}

export interface AppointmentWithDoctor extends Appointment {
  doctor_profile: {
    specialty: string
    profile: { full_name: string; phone: string | null }
  } | null
}

export interface AppointmentWithPatient extends Appointment {
  patient: { full_name: string; phone: string | null } | null
}
