import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { usePushNotifications } from '../hooks/usePushNotifications'
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
type ViewMode = 'list' | 'week'

function getWeekStart(offset: number): Date {
  const today = new Date()
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export default function DoctorDashboard() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  usePushNotifications()
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<FilterTab>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [updating, setUpdating] = useState<string | null>(null)
  const [isActive, setIsActive] = useState<boolean | null>(null)
  const [adminEnabled, setAdminEnabled] = useState<boolean | null>(null)
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
      .order('requested_time', { ascending: true })

    if (!error && data) setAppointments(data as unknown as AppointmentRow[])
    setLoading(false)
  }

  async function updateStatus(appointmentId: string, status: AppointmentStatus, doctorNotes?: string) {
    setUpdating(appointmentId)
    const payload: Record<string, unknown> = { status }
    if (doctorNotes !== undefined) payload.doctor_notes = doctorNotes || null
    const { error } = await supabase
      .from('appointments')
      .update(payload)
      .eq('id', appointmentId)
      .eq('doctor_id', user!.id)

    if (!error) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status, doctor_notes: doctorNotes ?? a.doctor_notes } : a))
      )
    }
    setUpdating(null)
  }

  const pending = appointments.filter((a) => a.status === 'pending')
  const accepted = appointments.filter((a) => a.status === 'accepted')
  const rejected = appointments.filter((a) => a.status === 'rejected')

  const displayed =
    tab === 'all' ? appointments
    : tab === 'pending' ? pending
    : tab === 'accepted' ? accepted
    : rejected

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Todas', count: appointments.length },
    { key: 'pending', label: 'Pendientes', count: pending.length },
    { key: 'accepted', label: 'Confirmadas', count: accepted.length },
    { key: 'rejected', label: 'Rechazadas', count: rejected.length },
  ]

  const weekStart = getWeekStart(weekOffset)
  const weekDays = getWeekDays(weekStart)
  const todayStr = toDateStr(new Date())
  const weekEnd = weekDays[6]
  const weekLabel = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} — ${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()]}`

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
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Banner suscripción activa */}
      {isActive === true && subscriptionId && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between gap-4">
          <p className="text-green-800 text-sm font-medium">✅ Suscripción mensual activa</p>
          <a
            href="https://www.mercadopago.com.uy/subscriptions"
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
              <button onClick={handleVerify} disabled={verifying || paymentLoading} className="btn-secondary text-sm whitespace-nowrap">
                {verifying ? 'Verificando...' : '🔄 Ya pagué'}
              </button>
              <button onClick={handlePay} disabled={paymentLoading || verifying} className="btn-primary text-sm whitespace-nowrap">
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
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              📅 Semana
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              ☰ Lista
            </button>
          </div>
          <Link to="/medico/configurar" className="btn-secondary text-sm">
            Editar mi perfil
          </Link>
        </div>
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

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : viewMode === 'week' ? (
        /* ── CALENDAR VIEW ── */
        <div>
          {/* Week navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg leading-none"
            >
              ‹
            </button>
            <div className="text-center">
              <p className="font-semibold text-gray-800 capitalize">{weekLabel}</p>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-primary-600 hover:underline mt-0.5"
                >
                  Ir a esta semana
                </button>
              )}
            </div>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 font-bold text-lg leading-none"
            >
              ›
            </button>
          </div>

          {/* Calendar grid — scrollable on mobile */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-2 min-w-[700px]">
              {weekDays.map((day, idx) => {
                const dateStr = toDateStr(day)
                const isToday = dateStr === todayStr
                const dayAppts = appointments
                  .filter((a) => a.requested_date === dateStr && a.status !== 'rejected' && a.status !== 'cancelled')
                  .sort((a, b) => a.requested_time.localeCompare(b.requested_time))

                return (
                  <div key={dateStr} className="flex flex-col gap-1.5">
                    {/* Day header */}
                    <div className={`text-center py-2 px-1 rounded-lg ${isToday ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <p className="text-xs font-medium">{DAY_NAMES[idx]}</p>
                      <p className={`text-lg font-bold leading-tight ${isToday ? 'text-white' : 'text-gray-800'}`}>
                        {day.getDate()}
                      </p>
                    </div>

                    {/* Appointment chips */}
                    <div className="flex flex-col gap-1 min-h-[80px]">
                      {dayAppts.length === 0 ? (
                        <div className="flex-1 border-2 border-dashed border-gray-100 rounded-lg" />
                      ) : (
                        dayAppts.map((appt) => (
                          <CalendarChip
                            key={appt.id}
                            appointment={appt}
                            expanded={expandedId === appt.id}
                            onToggle={() => setExpandedId(expandedId === appt.id ? null : appt.id)}
                            onAccept={() => updateStatus(appt.id, 'accepted')}
                            onReject={() => updateStatus(appt.id, 'rejected')}
                            updating={updating === appt.id}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Pendiente
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Confirmada
            </span>
          </div>
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div>
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

          {displayed.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">📭</p>
              <p>No hay turnos {tab !== 'all' ? 'en este estado' : 'todavía'}.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayed.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appointment={appt}
                  onAccept={() => updateStatus(appt.id, 'accepted')}
                  onReject={(reason) => updateStatus(appt.id, 'rejected', reason)}
                  updating={updating === appt.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Calendar chip (compact) ── */
function CalendarChip({
  appointment, expanded, onToggle, onAccept, onReject, updating,
}: {
  appointment: AppointmentRow; expanded: boolean; onToggle: () => void
  onAccept: () => void; onReject: (reason: string) => void; updating: boolean
}) {
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const timeStr = appointment.requested_time.slice(0, 5)
  const isPending = appointment.status === 'pending'
  const isAccepted = appointment.status === 'accepted'
  const chipBg = isPending ? 'bg-yellow-50 border-yellow-300' : isAccepted ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
  const timeBadge = isPending ? 'bg-yellow-400 text-white' : isAccepted ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'

  return (
    <div className={`rounded-lg border ${chipBg} overflow-hidden`}>
      <button onClick={onToggle} className="w-full text-left p-1.5 flex items-center gap-1.5">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${timeBadge} whitespace-nowrap`}>{timeStr}</span>
        <span className="text-xs text-gray-700 font-medium truncate leading-tight">
          {appointment.patient?.full_name?.split(' ')[0] ?? 'Paciente'}
        </span>
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-gray-200 pt-1.5">
          <p className="text-xs font-semibold text-gray-800">{appointment.patient?.full_name ?? 'Paciente'}</p>
          {isAccepted && appointment.patient?.phone && <p className="text-xs text-green-700">📞 {appointment.patient.phone}</p>}
          {appointment.modality && <p className="text-xs text-gray-500">{appointment.modality === 'presencial' ? '🏥 Presencial' : '💻 Videollamada'}</p>}
          {appointment.patient_notes && <p className="text-xs text-gray-500 italic">"{appointment.patient_notes}"</p>}
          {isPending && !showReject && (
            <div className="flex gap-1 pt-0.5">
              <button onClick={onAccept} disabled={updating} className="flex-1 text-xs bg-primary-600 text-white py-1 rounded font-medium hover:bg-primary-700 disabled:opacity-50">Confirmar</button>
              <button onClick={() => setShowReject(true)} disabled={updating} className="flex-1 text-xs bg-red-600 text-white py-1 rounded font-medium hover:bg-red-700 disabled:opacity-50">Rechazar</button>
            </div>
          )}
          {isPending && showReject && (
            <div className="space-y-1.5 pt-0.5">
              <textarea className="input text-xs resize-none" rows={2} placeholder="Motivo (opcional)..."
                value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <div className="flex gap-1">
                <button onClick={() => { onReject(rejectReason); setShowReject(false) }} disabled={updating}
                  className="flex-1 text-xs bg-red-600 text-white py-1 rounded font-medium hover:bg-red-700 disabled:opacity-50">
                  Confirmar rechazo
                </button>
                <button onClick={() => setShowReject(false)} className="flex-1 text-xs bg-gray-200 text-gray-700 py-1 rounded font-medium hover:bg-gray-300">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── List card ── */
function AppointmentCard({
  appointment, onAccept, onReject, updating,
}: {
  appointment: AppointmentRow; onAccept: () => void; onReject: (reason: string) => void; updating: boolean
}) {
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const date = new Date(appointment.requested_date + 'T12:00:00')
  const dateStr = date.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = appointment.requested_time.slice(0, 5)
  const statusClass = appointment.status === 'pending' ? 'badge-pending' : appointment.status === 'accepted' ? 'badge-accepted' : 'badge-rejected'

  return (
    <div className="card">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className={statusClass}>{STATUS_LABELS[appointment.status]}</span>
            <span className="text-gray-400 text-xs">Solicitado el {new Date(appointment.created_at).toLocaleDateString('es-UY')}</span>
          </div>
          <h3 className="font-semibold text-gray-900">{appointment.patient?.full_name ?? 'Paciente'}</h3>
          {appointment.status === 'accepted' && (
            <div className="mt-2 p-2.5 bg-green-50 border border-green-200 rounded-lg space-y-0.5">
              <p className="text-green-800 text-xs font-semibold uppercase tracking-wide">Contacto del paciente</p>
              {appointment.patient?.phone
                ? <p className="text-green-700 text-sm">📞 {appointment.patient.phone}</p>
                : <p className="text-green-600 text-sm">Sin teléfono registrado</p>}
            </div>
          )}
          <p className="text-gray-600 text-sm mt-2 capitalize">
            📅 {dateStr} a las {timeStr}
            {appointment.modality && <span className="ml-2 text-xs text-gray-400">{appointment.modality === 'presencial' ? '· 🏥 Presencial' : '· 💻 Videollamada'}</span>}
          </p>
          {appointment.patient_notes && (
            <p className="text-gray-500 text-sm mt-2 bg-gray-50 p-2.5 rounded-lg">
              <span className="font-medium">Motivo:</span> {appointment.patient_notes}
            </p>
          )}
          {showReject && (
            <div className="mt-3 space-y-2">
              <textarea className="input resize-none text-sm" rows={2} placeholder="Motivo de rechazo (opcional)..."
                value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <button onClick={() => { onReject(rejectReason); setShowReject(false) }} disabled={updating}
                  className="btn-danger text-sm py-2 px-4">
                  {updating ? 'Rechazando...' : 'Confirmar rechazo'}
                </button>
                <button onClick={() => setShowReject(false)} className="btn-ghost text-sm py-2 px-4">Cancelar</button>
              </div>
            </div>
          )}
        </div>
        {appointment.status === 'pending' && !showReject && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onAccept} disabled={updating} className="btn-primary text-sm py-2 px-4">Confirmar</button>
            <button onClick={() => setShowReject(true)} disabled={updating} className="btn-danger text-sm py-2 px-4">Rechazar</button>
          </div>
        )}
      </div>
    </div>
  )
}
