import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { DAYS_OF_WEEK } from '../lib/constants'
import type { DoctorWithDetails } from '../types'

export default function DoctorPublicProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [doctor, setDoctor] = useState<DoctorWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')
  const [bookSuccess, setBookSuccess] = useState(false)

  useEffect(() => {
    if (id) fetchDoctor()
  }, [id])

  async function fetchDoctor() {
    const { data, error } = await supabase
      .from('doctor_profiles')
      .select(`
        id,
        bio,
        consultation_fee,
        is_active,
        profile:profiles!inner(id, full_name, phone, role, created_at),
        specialties:doctor_specialties(specialty),
        zones:doctor_zones(id, department, zone, schedules:doctor_zone_schedules(*))
      `)
      .eq('id', id)
      .single()

    if (error || !data) {
      setNotFound(true)
    } else {
      setDoctor(data as unknown as DoctorWithDetails)
    }
    setLoading(false)
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    setBookError('')
    setBooking(true)
    try {
      const { error } = await supabase.from('appointments').insert({
        doctor_id: id,
        patient_id: user.id,
        requested_date: date,
        requested_time: time,
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

  const today = new Date().toISOString().split('T')[0]

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

  const initials = doctor.profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isOwnProfile = user?.id === id

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
              {doctor.consultation_fee && (
                <p className="text-gray-500 text-sm mt-1">
                  💰 $ {doctor.consultation_fee.toLocaleString('es-UY')} la consulta
                </p>
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
                              <span className="text-sm text-gray-500">{s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</span>
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
        </div>

        {/* Right: booking form */}
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
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4">Solicitar turno</h2>
              {!user && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <button onClick={() => navigate('/login')} className="font-medium hover:underline">
                    Ingresá
                  </button>{' '}
                  o{' '}
                  <button onClick={() => navigate('/registro')} className="font-medium hover:underline">
                    registrate
                  </button>{' '}
                  para solicitar un turno.
                </div>
              )}
              <form onSubmit={handleBook} className="space-y-4">
                <div>
                  <label className="label">Fecha deseada</label>
                  <input
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={today}
                    required
                    disabled={!user}
                  />
                </div>
                <div>
                  <label className="label">Hora aproximada</label>
                  <input
                    type="time"
                    className="input"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    disabled={!user}
                  />
                </div>
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
          )}
        </div>
      </div>
    </div>
  )
}
