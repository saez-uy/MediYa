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
  modality: 'presencial' | 'videollamada' | null
  patient_notes: string | null
  doctor_notes: string | null
  created_at: string
  doctor: { full_name: string } | null
  specialty?: string
}

function canCancelAppointment(date: string, time: string): boolean {
  const appointmentDateTime = new Date(`${date}T${time}`)
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return appointmentDateTime > cutoff
}

export default function PatientDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

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
        modality,
        patient_notes,
        doctor_notes,
        created_at,
        doctor:profiles!appointments_doctor_id_fkey(full_name)
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

    const { data: specialties } = await supabase
      .from('doctor_specialties')
      .select('doctor_id, specialty')
      .in('doctor_id', doctorIds)

    const specialtyMap: Record<string, string> = {}
    for (const s of specialties ?? []) {
      if (!specialtyMap[s.doctor_id]) specialtyMap[s.doctor_id] = s.specialty
    }

    setAppointments(rows.map((r) => ({
      ...r,
      specialty: specialtyMap[r.doctor_id],
    })))
    setLoading(false)
  }

  async function handleCancel(appt: AppointmentRow) {
    if (!canCancelAppointment(appt.requested_date, appt.requested_time)) return
    const confirmed = window.confirm('¿Seguro que querés cancelar este turno?')
    if (!confirmed) return

    setCancellingId(appt.id)
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appt.id)

    if (error) {
      alert('Error al cancelar. Intentá de nuevo.')
    } else {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appt.id ? { ...a, status: 'cancelled' } : a))
      )
    }
    setCancellingId(null)
  }

  const pendingPayment = appointments.filter((a) => a.status === 'pending_payment')
  const pending = appointments.filter((a) => a.status === 'pending')
  const accepted = appointments.filter((a) => a.status === 'accepted')
  const past = appointments.filter((a) => a.status === 'rejected' || a.status === 'cancelled')

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
          {pendingPayment.length > 0 && (
            <Section
              title="Pago pendiente"
              appointments={pendingPayment}
              navigate={navigate}
              onCancel={handleCancel}
              cancellingId={cancellingId}
            />
          )}
          {pending.length > 0 && (
            <Section
              title="Pendientes de confirmación"
              appointments={pending}
              navigate={navigate}
              onCancel={handleCancel}
              cancellingId={cancellingId}
            />
          )}
          {accepted.length > 0 && (
            <Section
              title="Confirmadas"
              appointments={accepted}
              navigate={navigate}
              onCancel={handleCancel}
              cancellingId={cancellingId}
            />
          )}
          {past.length > 0 && (
            <Section
              title="Historial"
              appointments={past}
              navigate={navigate}
              onCancel={handleCancel}
              cancellingId={cancellingId}
            />
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
  onCancel,
  cancellingId,
}: {
  title: string
  appointments: AppointmentRow[]
  navigate: (path: string) => void
  onCancel: (appt: AppointmentRow) => void
  cancellingId: string | null
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">{title}</h2>
      <div className="space-y-4">
        {appointments.map((appt) => (
          <PatientAppointmentCard
            key={appt.id}
            appointment={appt}
            navigate={navigate}
            onCancel={onCancel}
            cancelling={cancellingId === appt.id}
          />
        ))}
      </div>
    </div>
  )
}

function PatientAppointmentCard({
  appointment,
  navigate,
  onCancel,
  cancelling,
}: {
  appointment: AppointmentRow
  navigate: (path: string) => void
  onCancel: (appt: AppointmentRow) => void
  cancelling: boolean
}) {
  const date = new Date(appointment.requested_date + 'T12:00:00')
  const dateStr = date.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = appointment.requested_time.slice(0, 5)

  const isActive = appointment.status === 'pending' || appointment.status === 'accepted'
  const isPendingPayment = appointment.status === 'pending_payment'
  const showCancel = isActive && canCancelAppointment(appointment.requested_date, appointment.requested_time)

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
            {appointment.modality && (
              <span className="ml-2 text-xs text-gray-400">
                {appointment.modality === 'presencial' ? '· 🏥 Presencial' : '· 💻 Videollamada'}
              </span>
            )}
          </p>
          {appointment.status === 'accepted' && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm font-medium">Turno confirmado</p>
              <p className="text-green-700 text-sm">El médico se va a contactar con vos a la brevedad.</p>
            </div>
          )}
          {appointment.patient_notes && (
            <p className="text-gray-500 text-sm mt-2">
              <span className="font-medium">Motivo:</span> {appointment.patient_notes}
            </p>
          )}
          {appointment.status === 'rejected' && appointment.doctor_notes && (
            <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm"><span className="font-medium">Motivo de rechazo:</span> {appointment.doctor_notes}</p>
            </div>
          )}
          {isPendingPayment && (
            <p className="mt-3 text-xs text-amber-600 font-medium">
              ⏳ Esperando confirmación del pago.
            </p>
          )}
          {!isPendingPayment && showCancel && (
            <button
              onClick={() => onCancel(appointment)}
              disabled={cancelling}
              className="mt-3 text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
            >
              {cancelling ? 'Cancelando...' : 'Cancelar turno'}
            </button>
          )}
          {!isPendingPayment && isActive && !showCancel && (
            <p className="mt-3 text-xs text-gray-400">
              No se puede cancelar con menos de 24 hs de anticipación.
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
