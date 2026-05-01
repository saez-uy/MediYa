import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { STATUS_LABELS } from '../lib/constants'
import type { AppointmentStatus } from '../types'

interface AppointmentRow {
  id: string
  requested_date: string
  requested_time: string
  status: AppointmentStatus
  modality: 'presencial' | 'videollamada' | null
  patient_notes: string | null
  doctor_notes: string | null
  created_at: string
  patient: { full_name: string; phone: string | null } | null
}

type FilterTab = 'all' | AppointmentStatus

export default function DoctorDashboard() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const [isActive, setIsActive] = useState<boolean | null>(null)
  const [adminEnabled, setAdminEnabled] = useState<boolean | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')

  useEffect(() => {
    if (user) {
      fetchAppointments()
      checkActive()
    }
  }, [user])

  async function checkActive() {
    const { data } = await supabase
      .from('doctor_profiles')
      .select('is_active, admin_enabled, mp_subscription_id')
      .eq('id', user!.id)
      .single()
    setIsActive(data?.is_active ?? false)
    setAdminEnabled(data?.admin_enabled ?? false)
    setSubscriptionId(data?.mp_subscription_id ?? null)
  }

  async function handlePay() {
    setPaymentLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { doctor_id: user!.id, payer_email: user!.email },
      })
      if (error) throw error
      window.location.href = data.checkout_url
    } catch {
      setPaymentLoading(false)
    }
  }

  async function handleVerify() {
    setVerifying(true)
    setVerifyMsg('')
    try {
      const { data, error } = await supabase.functions.invoke('mp-webhook', {
        body: { verify_doctor: true },
      })
      if (error) throw error
      if (data?.status === 'authorized') {
        setIsActive(true)
      } else {
        setVerifyMsg('Suscripción no autorizada todavía. Si ya completaste el pago, esperá unos minutos e intentá de nuevo.')
      }
    } catch {
      setVerifyMsg('Error al verificar. Intentá de nuevo.')
    } finally {
      setVerifying(false)
    }
  }

  async function fetchAppointments() {
    setLoading(true)
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        requested_date,
        requested_time,
        status,
        modality,
        patient_notes,
        doctor_notes,
        created_at,
        patient:profiles!appointments_patient_id_fkey(full_name, phone)
      `)
      .eq('doctor_id', user!.id)
      .order('requested_date', { ascending: true })

    if (!error && data) setAppointments(data as unknown as AppointmentRow[])
    setLoading(false)
  }

  async function updateStatus(appointmentId: string, status: AppointmentStatus) {
    setUpdating(appointmentId)
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', appointmentId)
      .eq('doctor_id', user!.id)

    if (!error) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status } : a))
      )
    }
    setUpdating(null)
  }

  const pending = appointments.filter((a) => a.status === 'pending')
  const accepted = appointments.filter((a) => a.status === 'accepted')
  const rejected = appointments.filter((a) => a.status === 'rejected')

  const displayed =
    tab === 'all'
      ? appointments
      : tab === 'pending'
      ? pending
      : tab === 'accepted'
      ? accepted
      : rejected

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Todas', count: appointments.length },
    { key: 'pending', label: 'Pendientes', count: pending.length },
    { key: 'accepted', label: 'Confirmadas', count: accepted.length },
    { key: 'rejected', label: 'Rechazadas', count: rejected.length },
  ]

  if (adminEnabled === false) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center space-y-6">
          <div>
            <p className="text-5xl mb-4">⏳</p>
            <h2 className="text-2xl font-bold text-gray-900">Cuenta en revisión</h2>
            <p className="text-gray-600 mt-3 leading-relaxed">
              Una vez finalizada la validación de sus datos, quedará su cuenta activada.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Si tenés alguna consulta escribinos a{' '}
              <a href="mailto:saez-uy@gmail.com" className="text-primary-600 hover:underline">
                saez-uy@gmail.com
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link to="/medico/configurar" className="btn-secondary text-sm">
              Ver mi perfil
            </Link>
            <button
              onClick={async () => { await signOut(); navigate('/') }}
              className="btn-ghost text-sm text-gray-500"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Banner suscripción activa */}
      {isActive === true && subscriptionId && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-4">
          <p className="text-green-800 text-sm font-medium">✅ Suscripción mensual activa</p>
          <a
            href={`https://www.mercadopago.com.uy/subscriptions`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-700 text-sm underline hover:text-green-900 whitespace-nowrap"
          >
            Administrar suscripción
          </a>
        </div>
      )}

      {/* Banner suscripción pendiente */}
      {isActive === false && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-xl flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-yellow-800">⚠️ Tu cuenta está pendiente de activación</p>
              <p className="text-yellow-700 text-sm mt-0.5">
                Suscribite para aparecer en las búsquedas y recibir turnos. $ 500 UYU/mes.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleVerify}
                disabled={verifying || paymentLoading}
                className="btn-secondary text-sm whitespace-nowrap"
              >
                {verifying ? 'Verificando...' : '🔄 Ya pagué'}
              </button>
              <button
                onClick={handlePay}
                disabled={paymentLoading || verifying}
                className="btn-primary text-sm whitespace-nowrap"
              >
                {paymentLoading ? 'Redirigiendo...' : '💳 Suscribirme'}
              </button>
            </div>
          </div>
          {verifyMsg && (
            <p className="text-yellow-800 text-sm bg-yellow-100 px-3 py-2 rounded-lg">{verifyMsg}</p>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mi agenda</h1>
          <p className="text-gray-500 mt-1">Hola, {profile?.full_name}</p>
        </div>
        <Link to="/medico/configurar" className="btn-secondary text-sm">
          Editar mi perfil
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <p className="text-3xl font-bold text-yellow-600">{pending.length}</p>
          <p className="text-sm text-gray-500 mt-1">Pendientes</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{accepted.length}</p>
          <p className="text-sm text-gray-500 mt-1">Confirmadas</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-600">{rejected.length}</p>
          <p className="text-sm text-gray-500 mt-1">Rechazadas</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Appointments list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p>No hay turnos {tab !== 'all' ? `en este estado` : 'todavía'}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onAccept={() => updateStatus(appt.id, 'accepted')}
              onReject={() => updateStatus(appt.id, 'rejected')}
              updating={updating === appt.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AppointmentCard({
  appointment,
  onAccept,
  onReject,
  updating,
}: {
  appointment: AppointmentRow
  onAccept: () => void
  onReject: () => void
  updating: boolean
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
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className={statusClass}>{STATUS_LABELS[appointment.status]}</span>
            <span className="text-gray-400 text-xs">
              Solicitado el {new Date(appointment.created_at).toLocaleDateString('es-UY')}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900">{appointment.patient?.full_name ?? 'Paciente'}</h3>
          {appointment.patient?.phone && appointment.status === 'accepted' && (
            <p className="text-primary-600 text-sm mt-0.5">📞 {appointment.patient.phone}</p>
          )}
          <p className="text-gray-600 text-sm mt-2 capitalize">
            📅 {dateStr} a las {timeStr}
            {appointment.modality && (
              <span className="ml-2 text-xs text-gray-400">
                {appointment.modality === 'presencial' ? '· 🏥 Presencial' : '· 💻 Videollamada'}
              </span>
            )}
          </p>
          {appointment.patient_notes && (
            <p className="text-gray-500 text-sm mt-2 bg-gray-50 p-2.5 rounded-lg">
              <span className="font-medium">Motivo:</span> {appointment.patient_notes}
            </p>
          )}
        </div>

        {appointment.status === 'pending' && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={onAccept}
              disabled={updating}
              className="btn-primary text-sm py-2 px-4"
            >
              Confirmar
            </button>
            <button
              onClick={onReject}
              disabled={updating}
              className="btn-danger text-sm py-2 px-4"
            >
              Rechazar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
