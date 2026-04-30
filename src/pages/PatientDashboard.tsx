import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { STATUS_LABELS } from '../lib/constants'
import type { AppointmentStatus } from '../types'

interface AppointmentRow {
  id: string
  doctor_id: string
  requested_date: string
  requested_time: string
  status: AppointmentStatus
  patient_notes: string | null
  created_at: string
  doctor: { full_name: string; phone: string | null } | null
  specialty?: string
  doctor_phone2?: string | null
}

export default function PatientDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchAppointments()
  }, [user])

  async function fetchAppointments() {
    setLoading(true)

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        doctor_id,
        requested_date,
        requested_time,
        status,
        patient_notes,
        created_at,
        doctor:profiles!appointments_doctor_id_fkey(full_name, phone)
      `)
      .eq('patient_id', user!.id)
      .order('requested_date', { ascending: false })

    if (error || !data) {
      console.error('Error al obtener turnos:', error)
      setLoading(false)
      return
    }

    const rows = data as unknown as AppointmentRow[]

    const doctorIds = [...new Set(rows.map((r) => r.doctor_id))]

    const [{ data: specialties }, { data: doctorPhones }] = await Promise.all([
      supabase.from('doctor_specialties').select('doctor_id, specialty').in('doctor_id', doctorIds),
      supabase.from('doctor_profiles').select('id, phone2').in('id', doctorIds),
    ])

    const specialtyMap: Record<string, string> = {}
    for (const s of specialties ?? []) {
      if (!specialtyMap[s.doctor_id]) specialtyMap[s.doctor_id] = s.specialty
    }

    const phone2Map: Record<string, string | null> = {}
    for (const dp of doctorPhones ?? []) {
      phone2Map[dp.id] = dp.phone2 ?? null
    }

    setAppointments(rows.map((r) => ({
      ...r,
      specialty: specialtyMap[r.doctor_id],
      doctor_phone2: phone2Map[r.doctor_id] ?? null,
    })))
    setLoading(false)
  }

  const pending = appointments.filter((a) => a.status === 'pending')
  const accepted = appointments.filter((a) => a.status === 'accepted')
  const past = appointments.filter((a) => a.status === 'rejected')

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mis turnos</h1>
          <p className="text-gray-500 mt-1">Hola, {profile?.full_name}</p>
        </div>
        <Link to="/buscar" className="btn-primary text-sm">
          Buscar médico
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🏥</p>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Todavía no tenés turnos</h2>
          <p className="text-gray-500 mb-6">Buscá un médico y pedí tu primer turno.</p>
          <Link to="/buscar" className="btn-primary">
            Buscar médico
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <Section title="Pendientes de confirmación" appointments={pending} navigate={navigate} />
          )}
          {accepted.length > 0 && (
            <Section title="Confirmadas" appointments={accepted} navigate={navigate} />
          )}
          {past.length > 0 && (
            <Section title="Rechazadas" appointments={past} navigate={navigate} />
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  appointments,
  navigate,
}: {
  title: string
  appointments: AppointmentRow[]
  navigate: (path: string) => void
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">{title}</h2>
      <div className="space-y-4">
        {appointments.map((appt) => (
          <PatientAppointmentCard key={appt.id} appointment={appt} navigate={navigate} />
        ))}
      </div>
    </div>
  )
}

function PatientAppointmentCard({
  appointment,
  navigate,
}: {
  appointment: AppointmentRow
  navigate: (path: string) => void
}) {
  const date = new Date(appointment.requested_date + 'T12:00:00')
  const dateStr = date.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = appointment.requested_time.slice(0, 5)

  const statusClass =
    appointment.status === 'pending'
      ? 'badge-pending'
      : appointment.status === 'accepted'
      ? 'badge-accepted'
      : 'badge-rejected'

  return (
    <div className="card">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={statusClass}>{STATUS_LABELS[appointment.status]}</span>
          </div>
          <h3 className="font-semibold text-gray-900">{appointment.doctor?.full_name ?? 'Médico'}</h3>
          {appointment.specialty && (
            <p className="text-primary-600 text-sm">{appointment.specialty}</p>
          )}
          <p className="text-gray-600 text-sm mt-2 capitalize">
            📅 {dateStr} a las {timeStr}
          </p>
          {appointment.status === 'accepted' && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg space-y-1">
              <p className="text-green-800 text-sm font-medium">Turno confirmado</p>
              {appointment.doctor?.phone ? (
                <>
                  <p className="text-green-700 text-sm">📞 {appointment.doctor.phone}</p>
                  {appointment.doctor_phone2 && (
                    <p className="text-green-700 text-sm">📞 {appointment.doctor_phone2}</p>
                  )}
                </>
              ) : (
                <p className="text-green-700 text-sm">El médico se va a contactar con vos a la brevedad.</p>
              )}
            </div>
          )}
          {appointment.patient_notes && (
            <p className="text-gray-500 text-sm mt-2">
              <span className="font-medium">Motivo:</span> {appointment.patient_notes}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate(`/perfil/${appointment.doctor_id}`)}
          className="btn-ghost text-sm flex-shrink-0"
        >
          Ver perfil
        </button>
      </div>
    </div>
  )
}
