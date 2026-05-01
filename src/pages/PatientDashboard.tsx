import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { STATUS_LABELS } from '../lib/constants'
import { StarPicker, StarDisplay } from '../components/StarRating'
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

interface ReviewEntry {
  rating: number
  comment: string | null
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
  const [reviewMap, setReviewMap] = useState<Record<string, ReviewEntry>>({})

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

    if (error || !data) { setLoading(false); return }

    const rows = data as unknown as AppointmentRow[]
    const doctorIds = [...new Set(rows.map((r) => r.doctor_id))]
    const acceptedIds = rows.filter((r) => r.status === 'accepted').map((r) => r.id)

    const [{ data: specialties }, { data: reviews }] = await Promise.all([
      supabase.from('doctor_specialties').select('doctor_id, specialty').in('doctor_id', doctorIds),
      acceptedIds.length > 0
        ? supabase.from('doctor_reviews').select('appointment_id, rating, comment').in('appointment_id', acceptedIds)
        : Promise.resolve({ data: [] }),
    ])

    const specialtyMap: Record<string, string> = {}
    for (const s of specialties ?? []) {
      if (!specialtyMap[s.doctor_id]) specialtyMap[s.doctor_id] = s.specialty
    }

    const rMap: Record<string, ReviewEntry> = {}
    for (const r of (reviews as { appointment_id: string; rating: number; comment: string | null }[] | null) ?? []) {
      rMap[r.appointment_id] = { rating: r.rating, comment: r.comment }
    }

    setAppointments(rows.map((r) => ({ ...r, specialty: specialtyMap[r.doctor_id] })))
    setReviewMap(rMap)
    setLoading(false)
  }

  async function handleCancel(appt: AppointmentRow) {
    if (!canCancelAppointment(appt.requested_date, appt.requested_time)) return
    if (!window.confirm('¿Seguro que querés cancelar este turno?')) return
    setCancellingId(appt.id)
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appt.id)
    if (error) { alert('Error al cancelar. Intentá de nuevo.') }
    else { setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, status: 'cancelled' } : a))) }
    setCancellingId(null)
  }

  function handleReviewSaved(appointmentId: string, entry: ReviewEntry) {
    setReviewMap((prev) => ({ ...prev, [appointmentId]: entry }))
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
        <Link to="/buscar" className="btn-primary text-sm">Buscar médico</Link>
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
          <Link to="/buscar" className="btn-primary">Buscar médico</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {pendingPayment.length > 0 && <Section title="Pago pendiente" appointments={pendingPayment} navigate={navigate} onCancel={handleCancel} cancellingId={cancellingId} reviewMap={reviewMap} onReviewSaved={handleReviewSaved} patientId={user!.id} />}
          {pending.length > 0 && <Section title="Pendientes de confirmación" appointments={pending} navigate={navigate} onCancel={handleCancel} cancellingId={cancellingId} reviewMap={reviewMap} onReviewSaved={handleReviewSaved} patientId={user!.id} />}
          {accepted.length > 0 && <Section title="Confirmadas" appointments={accepted} navigate={navigate} onCancel={handleCancel} cancellingId={cancellingId} reviewMap={reviewMap} onReviewSaved={handleReviewSaved} patientId={user!.id} />}
          {past.length > 0 && <Section title="Historial" appointments={past} navigate={navigate} onCancel={handleCancel} cancellingId={cancellingId} reviewMap={reviewMap} onReviewSaved={handleReviewSaved} patientId={user!.id} />}
        </div>
      )}
    </div>
  )
}

function Section({ title, appointments, navigate, onCancel, cancellingId, reviewMap, onReviewSaved, patientId }: {
  title: string; appointments: AppointmentRow[]; navigate: (path: string) => void
  onCancel: (appt: AppointmentRow) => void; cancellingId: string | null
  reviewMap: Record<string, ReviewEntry>; onReviewSaved: (id: string, e: ReviewEntry) => void; patientId: string
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-700 mb-4">{title}</h2>
      <div className="space-y-4">
        {appointments.map((appt) => (
          <PatientAppointmentCard key={appt.id} appointment={appt} navigate={navigate}
            onCancel={onCancel} cancelling={cancellingId === appt.id}
            existingReview={reviewMap[appt.id]} onReviewSaved={onReviewSaved} patientId={patientId} />
        ))}
      </div>
    </div>
  )
}

function PatientAppointmentCard({ appointment, navigate, onCancel, cancelling, existingReview, onReviewSaved, patientId }: {
  appointment: AppointmentRow; navigate: (path: string) => void
  onCancel: (appt: AppointmentRow) => void; cancelling: boolean
  existingReview: ReviewEntry | undefined; onReviewSaved: (id: string, e: ReviewEntry) => void; patientId: string
}) {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')

  const date = new Date(appointment.requested_date + 'T12:00:00')
  const dateStr = date.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = appointment.requested_time.slice(0, 5)
  const isActive = appointment.status === 'pending' || appointment.status === 'accepted'
  const isPendingPayment = appointment.status === 'pending_payment'
  const showCancel = isActive && canCancelAppointment(appointment.requested_date, appointment.requested_time)

  const statusClass =
    appointment.status === 'pending' ? 'badge-pending'
    : appointment.status === 'accepted' ? 'badge-accepted'
    : 'badge-rejected'

  async function handleSubmitReview() {
    if (reviewRating === 0) { setReviewError('Seleccioná una calificación.'); return }
    setSubmitting(true)
    setReviewError('')
    const { error } = await supabase.from('doctor_reviews').insert({
      doctor_id: appointment.doctor_id,
      patient_id: patientId,
      appointment_id: appointment.id,
      rating: reviewRating,
      comment: reviewComment.trim() || null,
    })
    if (error) {
      setReviewError('Error al guardar la reseña. Intentá de nuevo.')
    } else {
      onReviewSaved(appointment.id, { rating: reviewRating, comment: reviewComment.trim() || null })
      setShowReviewForm(false)
    }
    setSubmitting(false)
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={statusClass}>{STATUS_LABELS[appointment.status]}</span>
          </div>
          <h3 className="font-semibold text-gray-900">{appointment.doctor?.full_name ?? 'Médico'}</h3>
          {appointment.specialty && <p className="text-primary-600 text-sm">{appointment.specialty}</p>}
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

          {appointment.status === 'rejected' && appointment.doctor_notes && (
            <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm"><span className="font-medium">Motivo de rechazo:</span> {appointment.doctor_notes}</p>
            </div>
          )}

          {appointment.patient_notes && (
            <p className="text-gray-500 text-sm mt-2">
              <span className="font-medium">Motivo:</span> {appointment.patient_notes}
            </p>
          )}

          {/* Review section — only for accepted appointments */}
          {appointment.status === 'accepted' && (
            <div className="mt-3">
              {existingReview ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-1">
                  <p className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">Tu reseña</p>
                  <StarDisplay avg={existingReview.rating} count={1} size="sm" />
                  {existingReview.comment && <p className="text-yellow-700 text-sm italic">"{existingReview.comment}"</p>}
                </div>
              ) : showReviewForm ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  <p className="text-sm font-medium text-gray-700">Calificá tu experiencia</p>
                  <StarPicker value={reviewRating} onChange={setReviewRating} />
                  <textarea
                    className="input resize-none text-sm"
                    rows={2}
                    placeholder="Comentario opcional..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />
                  {reviewError && <p className="text-red-600 text-xs">{reviewError}</p>}
                  <div className="flex gap-2">
                    <button onClick={handleSubmitReview} disabled={submitting}
                      className="btn-primary text-sm py-2 px-4">
                      {submitting ? 'Guardando...' : 'Publicar reseña'}
                    </button>
                    <button onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewComment(''); setReviewError('') }}
                      className="btn-ghost text-sm py-2 px-4">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowReviewForm(true)}
                  className="text-sm text-primary-600 hover:underline font-medium">
                  ⭐ Dejar reseña
                </button>
              )}
            </div>
          )}

          {isPendingPayment && <p className="mt-3 text-xs text-amber-600 font-medium">⏳ Esperando confirmación del pago.</p>}
          {!isPendingPayment && showCancel && (
            <button onClick={() => onCancel(appointment)} disabled={cancelling}
              className="mt-3 text-sm text-red-600 hover:text-red-800 hover:underline disabled:opacity-50">
              {cancelling ? 'Cancelando...' : 'Cancelar turno'}
            </button>
          )}
          {!isPendingPayment && isActive && !showCancel && (
            <p className="mt-3 text-xs text-gray-400">No se puede cancelar con menos de 24 hs de anticipación.</p>
          )}
        </div>
        <button onClick={() => navigate(`/perfil/${appointment.doctor_id}`)} className="btn-ghost text-sm flex-shrink-0">
          Ver perfil
        </button>
      </div>
    </div>
  )
}
