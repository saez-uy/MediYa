import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { DAYS_OF_WEEK, URGENCY_FEE } from '../lib/constants'
import type { DoctorWithDetails } from '../types'
import { StarDisplay } from '../components/StarRating'

interface DoctorReview {
  rating: number
  comment: string | null
  created_at: string
  patient: { full_name: string } | null
}

export default function DoctorPublicProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [doctor, setDoctor] = useState<DoctorWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [reviews, setReviews] = useState<DoctorReview[]>([])
  const [slotDuration, setSlotDuration] = useState(30)
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set())

  // Normal booking state
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [modality, setModality] = useState<'presencial' | 'videollamada'>('presencial')
  const [availableModality, setAvailableModality] = useState<'presencial' | 'videollamada' | 'ambas' | null>(null)
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')
  const [bookSuccess, setBookSuccess] = useState(false)

  // Booked slot tracking
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set())
  const [bookedTodaySlots, setBookedTodaySlots] = useState<Set<string>>(new Set())

  // Urgency booking state
  const [urgencyTime, setUrgencyTime] = useState('')
  const [urgencyModality, setUrgencyModality] = useState<'presencial' | 'videollamada'>('presencial')
  const [urgencyNotes, setUrgencyNotes] = useState('')
  const [urgencyBooking, setUrgencyBooking] = useState(false)
  const [urgencyError, setUrgencyError] = useState('')

  const todayStr = new Date().toISOString().split('T')[0]
  const tomorrowStr = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
  })()

  function jsToOurDay(jsDay: number) { return (jsDay + 6) % 7 }

  function getValidDates() {
    if (!doctor) return []
    const availableDays = new Set(
      doctor.zones.flatMap((z) => z.schedules.map((s) => s.day_of_week))
    )
    if (availableDays.size === 0) return []
    const dates: { value: string; label: string }[] = []
    const base = new Date()
    for (let i = 1; i <= 60; i++) {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      if (availableDays.has(jsToOurDay(d.getDay())) && !blockedDates.has(dateStr)) {
        dates.push({
          value: dateStr,
          label: d.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' }),
        })
      }
    }
    return dates
  }

  function getTimeSlots(dateStr: string) {
    if (!doctor || !dateStr) return []
    const ourDay = jsToOurDay(new Date(dateStr + 'T12:00:00').getDay())
    const daySchedules = doctor.zones.flatMap((z) =>
      z.schedules.filter((s) => s.day_of_week === ourDay)
    )
    const slotMins = slotDuration
    const slots: string[] = []
    for (const sched of daySchedules) {
      const [sh, sm] = sched.start_time.slice(0, 5).split(':').map(Number)
      const [eh, em] = sched.end_time.slice(0, 5).split(':').map(Number)
      let cur = sh * 60 + sm
      const end = eh * 60 + em
      while (cur < end) {
        const slot = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`
        if (!slots.includes(slot)) slots.push(slot)
        cur += slotMins
      }
    }
    return slots.sort()
  }

  function getModalityForDate(dateStr: string): 'presencial' | 'videollamada' | 'ambas' | null {
    if (!doctor || !dateStr) return null
    const ourDay = jsToOurDay(new Date(dateStr + 'T12:00:00').getDay())
    const daySched = doctor.zones.flatMap((z) => z.schedules.filter((s) => s.day_of_week === ourDay))
    if (daySched.length === 0) return null
    const modalities = new Set(daySched.map((s) => s.modality))
    if (modalities.has('ambas')) return 'ambas'
    if (modalities.has('presencial') && modalities.has('videollamada')) return 'ambas'
    if (modalities.has('videollamada')) return 'videollamada'
    return 'presencial'
  }

  function getTodayAllSlots() {
    if (!doctor) return []
    if (blockedDates.has(todayStr)) return []
    const availableDays = new Set(doctor.zones.flatMap((z) => z.schedules.map((s) => s.day_of_week)))
    if (!availableDays.has(jsToOurDay(new Date().getDay()))) return []
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    return getTimeSlots(todayStr).filter((slot) => {
      const [h, m] = slot.split(':').map(Number)
      return h * 60 + m > currentMinutes
    })
  }

  async function loadBookedSlotsForDate(dateStr: string): Promise<Set<string>> {
    const { data } = await supabase
      .from('appointments')
      .select('requested_time')
      .eq('doctor_id', id!)
      .eq('requested_date', dateStr)
      .in('status', ['pending', 'accepted', 'pending_payment'])
    return new Set((data ?? []).map((r: { requested_time: string }) => r.requested_time.slice(0, 5)))
  }

  async function handleDateChange(newDate: string) {
    setDate(newDate)
    setTime('')
    const m = getModalityForDate(newDate)
    setAvailableModality(m)
    setModality(m === 'videollamada' ? 'videollamada' : 'presencial')

    const booked = await loadBookedSlotsForDate(newDate)
    setBookedSlots(booked)
    const available = getTimeSlots(newDate).filter((s) => !booked.has(s))
    setTime(available.length > 0 ? available[0] : '')
  }

  useEffect(() => {
    if (id) fetchDoctor()
  }, [id])

  useEffect(() => {
    if (!doctor || !id) return
    loadBookedSlotsForDate(todayStr).then((booked) => {
      setBookedTodaySlots(booked)
      const slots = getTodayAllSlots().filter((s) => !booked.has(s))
      if (slots.length > 0) {
        setUrgencyTime(slots[0])
        const m = getModalityForDate(todayStr)
        setUrgencyModality(m === 'videollamada' ? 'videollamada' : 'presencial')
      }
    })
  }, [doctor])

  async function fetchDoctor() {
    const { data, error } = await supabase
      .from('doctor_profiles')
      .select(`
        id,
        bio,
        service_fees,
        is_active,
        accepts_same_day,
        profile:profiles!inner(id, full_name, phone, role, created_at),
        specialties:doctor_specialties(specialty),
        zones:doctor_zones(id, department, zone, schedules:doctor_zone_schedules(*))
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setDoctor(data as unknown as DoctorWithDetails)

    // Load slot duration separately so a missing column never breaks the main fetch
    const { data: dpExtra } = await supabase
      .from('doctor_profiles')
      .select('slot_duration_minutes')
      .eq('id', id)
      .single()
    if (dpExtra?.slot_duration_minutes) setSlotDuration(dpExtra.slot_duration_minutes)

    // Load blocked dates
    const { data: blocked } = await supabase
      .from('doctor_blocked_dates')
      .select('date')
      .eq('doctor_id', id)
    setBlockedDates(new Set((blocked ?? []).map((b: { date: string }) => b.date)))

    const { data: reviewData } = await supabase
      .from('doctor_reviews')
      .select('rating, comment, created_at, patient:profiles!doctor_reviews_patient_id_fkey(full_name)')
      .eq('doctor_id', id)
      .order('created_at', { ascending: false })

    setReviews((reviewData as unknown as DoctorReview[]) ?? [])
    setLoading(false)
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    setBookError('')
    setBooking(true)
    try {
      // Pre-check: verify slot is still free (handles race conditions)
      const freshBooked = await loadBookedSlotsForDate(date)
      if (freshBooked.has(time)) {
        setBookedSlots(freshBooked)
        const available = getTimeSlots(date).filter((s) => !freshBooked.has(s))
        setTime(available.length > 0 ? available[0] : '')
        setBookError('Ese horario ya fue reservado. Por favor elegí otro.')
        setBooking(false)
        return
      }

      const { error } = await supabase.from('appointments').insert({
        doctor_id: id,
        patient_id: user.id,
        requested_date: date,
        requested_time: time,
        modality,
        patient_notes: notes || null,
      })
      if (error) throw error
      setBookSuccess(true)
    } catch (err) {
      setBookError(err instanceof Error ? err.message : 'Error al solicitar el turno.')
    } finally {
      setBooking(false)
    }
  }

  async function handleUrgencyBook(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    setUrgencyError('')
    setUrgencyBooking(true)
    try {
      // Pre-check urgency slot
      const freshBooked = await loadBookedSlotsForDate(todayStr)
      if (freshBooked.has(urgencyTime)) {
        setBookedTodaySlots(freshBooked)
        const available = getTodayAllSlots().filter((s) => !freshBooked.has(s))
        setUrgencyTime(available.length > 0 ? available[0] : '')
        setUrgencyError('Ese horario ya fue reservado. Por favor elegí otro.')
        setUrgencyBooking(false)
        return
      }

      const { data, error } = await supabase.functions.invoke('create-urgency-payment', {
        body: {
          doctor_id: id,
          patient_id: user.id,
          date: todayStr,
          time: urgencyTime,
          notes: urgencyNotes || null,
          modality: urgencyModality,
          payer_email: user.email,
        },
      })
      if (error || data?.error) throw new Error(data?.error ?? 'Error al procesar el pago.')
      window.location.href = data.checkout_url
    } catch (err) {
      setUrgencyError(err instanceof Error ? err.message : 'Error al procesar el pago.')
      setUrgencyBooking(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (notFound || !doctor) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">😕</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Médico no encontrado</h1>
        <p className="text-gray-500 mb-6">El perfil que buscás no existe o fue desactivado.</p>
        <button onClick={() => navigate('/buscar')} className="btn-primary">Buscar otros médicos</button>
      </div>
    )
  }

  const initials = doctor.profile.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const isOwnProfile = user?.id === id
  const isPatient = profile?.role === 'patient' || !user

  const availableTodaySlots = getTodayAllSlots().filter((s) => !bookedTodaySlots.has(s))
  const todayModality = getModalityForDate(todayStr)

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm mb-6 flex items-center gap-1">
        ← Volver
      </button>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: doctor info */}
        <div className="md:col-span-2 space-y-6">
          {/* Header */}
          <div className="card flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-primary-700 font-bold text-2xl">{initials}</span>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{doctor.profile.full_name}</h1>
              {doctor.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {doctor.specialties.map((s) => (
                    <span key={s.specialty} className="bg-primary-100 text-primary-700 text-xs px-2.5 py-1 rounded-full font-medium">
                      {s.specialty}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                <p className="text-gray-500 text-sm">🕐 {slotDuration} min por turno</p>
              </div>
              {doctor.service_fees && (
                <div className="mt-2 p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">💰 Costos</p>
                  <p className="text-gray-700 text-sm whitespace-pre-line">{doctor.service_fees}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {doctor.bio && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-3">Sobre el médico</h2>
              <p className="text-gray-600 leading-relaxed">{doctor.bio}</p>
            </div>
          )}

          {/* Zones with schedules */}
          {doctor.zones.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Zonas y horarios de atención</h2>
              <div className="space-y-4">
                {doctor.zones.map((z) => (
                  <div key={z.id} className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2.5">
                      <span className="text-sm font-medium text-gray-700">
                        📍 {z.zone !== z.department ? `${z.zone}, ${z.department}` : z.department}
                      </span>
                    </div>
                    {z.schedules.length > 0 ? (
                      <div className="divide-y divide-gray-50">
                        {z.schedules
                          .sort((a, b) => a.day_of_week - b.day_of_week)
                          .map((s) => (
                            <div key={s.id} className="flex items-center justify-between px-4 py-2">
                              <span className="text-sm text-gray-700">{DAYS_OF_WEEK[s.day_of_week]}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                  {s.modality === 'presencial' ? '🏥' : s.modality === 'videollamada' ? '💻' : '🏥💻'}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="px-4 py-2 text-sm text-gray-400">Consultar disponibilidad</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Reviews */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Reseñas de pacientes</h2>
            {reviews.length === 0 ? (
              <p className="text-gray-400 text-sm">Este médico aún no tiene reseñas.</p>
            ) : (
              <>
                {(() => {
                  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                  return (
                    <div className="mb-4 pb-4 border-b border-gray-100">
                      <StarDisplay avg={avg} count={reviews.length} size="md" />
                    </div>
                  )
                })()}
                <div className="space-y-4">
                  {reviews.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-700">
                          {r.patient?.full_name ?? 'Paciente'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(r.created_at).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <StarDisplay avg={r.rating} count={1} size="sm" />
                      {r.comment && <p className="text-gray-600 text-sm italic">"{r.comment}"</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: booking forms */}
        <div className="space-y-4">
          {isOwnProfile ? (
            <div className="card text-center">
              <p className="text-gray-500 text-sm mb-4">Este es tu perfil público.</p>
              <button onClick={() => navigate('/medico/configurar')} className="btn-primary w-full">
                Editar perfil
              </button>
            </div>
          ) : profile?.role === 'doctor' ? (
            <div className="card text-center">
              <p className="text-gray-500 text-sm">Solo los pacientes pueden solicitar turnos.</p>
            </div>
          ) : bookSuccess ? (
            <div className="card text-center">
              <p className="text-3xl mb-3">✅</p>
              <h3 className="font-semibold text-gray-900 mb-2">¡Turno solicitado!</h3>
              <p className="text-gray-500 text-sm mb-4">
                El médico revisará tu solicitud y la confirmará a la brevedad.
              </p>
              <button onClick={() => navigate('/dashboard/paciente')} className="btn-primary w-full">
                Ver mis turnos
              </button>
            </div>
          ) : (
            <>
              {/* ⚡ Urgency: today's booking */}
              {isPatient && availableTodaySlots.length > 0 && doctor.accepts_same_day && (
                <div className="card border-2 border-amber-300 bg-amber-50 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">⚡</span>
                      <h2 className="font-semibold text-amber-900">Turno urgente para hoy</h2>
                    </div>
                    <p className="text-amber-700 text-xs">
                      Requiere un pago adicional de <strong>$ {URGENCY_FEE} UYU</strong> para reservar el mismo día.
                    </p>
                  </div>

                  {!user && (
                    <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-sm text-yellow-800">
                      <button onClick={() => navigate('/login')} className="font-medium hover:underline">Ingresá</button>{' '}
                      o{' '}
                      <button onClick={() => navigate('/registro')} className="font-medium hover:underline">registrate</button>{' '}
                      para reservar.
                    </div>
                  )}

                  <form onSubmit={handleUrgencyBook} className="space-y-3">
                    <div>
                      <label className="label">Hora</label>
                      <select
                        className="input"
                        value={urgencyTime}
                        onChange={(e) => setUrgencyTime(e.target.value)}
                        required
                        disabled={!user}
                      >
                        {availableTodaySlots.map((t) => (
                          <option key={t} value={t}>{t} hs</option>
                        ))}
                      </select>
                    </div>

                    {todayModality && (
                      <div>
                        <label className="label">Tipo de consulta</label>
                        {todayModality === 'ambas' ? (
                          <div className="grid grid-cols-2 gap-2">
                            {(['presencial', 'videollamada'] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setUrgencyModality(m)}
                                disabled={!user}
                                className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                                  urgencyModality === m
                                    ? 'border-amber-500 bg-amber-100 text-amber-800'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                {m === 'presencial' ? '🏥 Presencial' : '💻 Videollamada'}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="py-2 px-3 rounded-lg border text-sm font-medium border-amber-200 bg-amber-100 text-amber-800">
                            {todayModality === 'presencial' ? '🏥 Presencial' : '💻 Videollamada'}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="label">Motivo (opcional)</label>
                      <textarea
                        className="input resize-none"
                        rows={2}
                        placeholder="Describí brevemente el motivo..."
                        value={urgencyNotes}
                        onChange={(e) => setUrgencyNotes(e.target.value)}
                        disabled={!user}
                      />
                    </div>

                    {urgencyError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                        {urgencyError}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                      disabled={urgencyBooking || !user}
                    >
                      {urgencyBooking ? 'Procesando...' : `💳 Pagar $ ${URGENCY_FEE} y reservar`}
                    </button>
                  </form>
                </div>
              )}

              {/* Normal booking form */}
              <div className="card">
                <h2 className="font-semibold text-gray-800 mb-4">Solicitar turno</h2>
                {!user && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    <button onClick={() => navigate('/login')} className="font-medium hover:underline">Ingresá</button>{' '}
                    o{' '}
                    <button onClick={() => navigate('/registro')} className="font-medium hover:underline">registrate</button>{' '}
                    para solicitar un turno.
                  </div>
                )}
                <form onSubmit={handleBook} className="space-y-4">
                  {(() => {
                    const validDates = getValidDates()
                    const allTimeSlots = getTimeSlots(date)
                    const availableTimeSlots = allTimeSlots.filter((s) => !bookedSlots.has(s))
                    const hasSchedule = validDates.length > 0
                    const noSlotsLeft = hasSchedule && date && allTimeSlots.length > 0 && availableTimeSlots.length === 0
                    return (
                      <>
                        <div>
                          <label className="label">Fecha deseada</label>
                          {hasSchedule ? (
                            <select
                              className="input"
                              value={date}
                              onChange={(e) => handleDateChange(e.target.value)}
                              required
                              disabled={!user}
                            >
                              <option value="">Seleccioná una fecha...</option>
                              {validDates.map((d) => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="date"
                              className="input"
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              min={tomorrowStr}
                              required
                              disabled={!user}
                            />
                          )}
                        </div>
                        <div>
                          <label className="label">Hora</label>
                          {hasSchedule && date ? (
                            noSlotsLeft ? (
                              <p className="text-sm text-red-500 py-2">
                                Sin horarios disponibles para ese día. Elegí otra fecha.
                              </p>
                            ) : availableTimeSlots.length > 0 ? (
                              <select
                                className="input"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                required
                                disabled={!user}
                              >
                                {availableTimeSlots.map((t) => (
                                  <option key={t} value={t}>{t} hs</option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-sm text-gray-400 py-2">Sin horarios para ese día.</p>
                            )
                          ) : (
                            <input
                              type="time"
                              className="input"
                              value={time}
                              onChange={(e) => setTime(e.target.value)}
                              required={!hasSchedule}
                              disabled={!user || (hasSchedule && !date)}
                            />
                          )}
                        </div>
                      </>
                    )
                  })()}

                  {availableModality && (
                    <div>
                      <label className="label">Tipo de consulta</label>
                      {availableModality === 'ambas' ? (
                        <div className="grid grid-cols-2 gap-2">
                          {(['presencial', 'videollamada'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setModality(m)}
                              className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                                modality === m
                                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
                              }`}
                            >
                              {m === 'presencial' ? '🏥 Presencial' : '💻 Videollamada'}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="py-2.5 px-3 rounded-lg border text-sm font-medium border-primary-200 bg-primary-50 text-primary-700">
                          {availableModality === 'presencial' ? '🏥 Presencial' : '💻 Videollamada'}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="label">Motivo de consulta (opcional)</label>
                    <textarea
                      className="input resize-none"
                      rows={3}
                      placeholder="Describí brevemente el motivo..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={!user}
                    />
                  </div>

                  {bookError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                      {bookError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn-primary w-full"
                    disabled={booking || !user}
                  >
                    {booking ? 'Enviando...' : 'Solicitar turno'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
