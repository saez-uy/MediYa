import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { SPECIALTIES, DAYS_OF_WEEK, ZONES, DEPARTMENTS } from '../lib/constants'

interface ScheduleRow {
  day_of_week: number
  enabled: boolean
  start_time: string
  end_time: string
}

interface SelectedZone {
  department: string
  zone: string
}

export default function DoctorSetup() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [specialty, setSpecialty] = useState('')
  const [bio, setBio] = useState('')
  const [fee, setFee] = useState('')
  const [selectedZones, setSelectedZones] = useState<SelectedZone[]>([])
  const [openDept, setOpenDept] = useState<string | null>('Montevideo')
  const [schedules, setSchedules] = useState<ScheduleRow[]>(
    DAYS_OF_WEEK.map((_, i) => ({ day_of_week: i, enabled: false, start_time: '09:00', end_time: '17:00' }))
  )
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    loadExistingProfile()
  }, [user])

  async function loadExistingProfile() {
    setFetching(true)
    const { data: dp } = await supabase.from('doctor_profiles').select('*').eq('id', user!.id).single()
    if (dp) {
      setSpecialty(dp.specialty || '')
      setBio(dp.bio || '')
      setFee(dp.consultation_fee ? String(dp.consultation_fee) : '')
    }

    const { data: zones } = await supabase.from('doctor_zones').select('*').eq('doctor_id', user!.id)
    if (zones) {
      setSelectedZones(zones.map((z: { department: string; zone: string }) => ({ department: z.department, zone: z.zone })))
    }

    const { data: scheds } = await supabase.from('doctor_schedules').select('*').eq('doctor_id', user!.id)
    if (scheds && scheds.length > 0) {
      setSchedules((prev) =>
        prev.map((row) => {
          const match = scheds.find((s: { day_of_week: number }) => s.day_of_week === row.day_of_week)
          if (match) return { ...row, enabled: true, start_time: match.start_time.slice(0, 5), end_time: match.end_time.slice(0, 5) }
          return row
        })
      )
    }
    setFetching(false)
  }

  function toggleZone(department: string, zone: string) {
    setSelectedZones((prev) => {
      const exists = prev.some((z) => z.department === department && z.zone === zone)
      if (exists) return prev.filter((z) => !(z.department === department && z.zone === zone))
      return [...prev, { department, zone }]
    })
  }

  function toggleDeptAll(department: string) {
    const deptZones = ZONES[department].map((zone) => ({ department, zone }))
    const allSelected = deptZones.every((dz) =>
      selectedZones.some((z) => z.department === dz.department && z.zone === dz.zone)
    )
    if (allSelected) {
      setSelectedZones((prev) => prev.filter((z) => z.department !== department))
    } else {
      setSelectedZones((prev) => {
        const withoutDept = prev.filter((z) => z.department !== department)
        return [...withoutDept, ...deptZones]
      })
    }
  }

  function updateSchedule(dayIndex: number, field: keyof ScheduleRow, value: string | boolean) {
    setSchedules((prev) => prev.map((row, i) => (i === dayIndex ? { ...row, [field]: value } : row)))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!specialty) { setError('Seleccioná una especialidad.'); return }
    if (selectedZones.length === 0) { setError('Seleccioná al menos una zona de trabajo.'); return }
    setError('')
    setLoading(true)

    try {
      const { error: dpError } = await supabase.from('doctor_profiles').upsert({
        id: user!.id,
        specialty,
        bio: bio || null,
        consultation_fee: fee ? parseInt(fee) : null,
        is_active: true,
      })
      if (dpError) throw dpError

      await supabase.from('doctor_zones').delete().eq('doctor_id', user!.id)
      if (selectedZones.length > 0) {
        const { error: zError } = await supabase.from('doctor_zones').insert(
          selectedZones.map((z) => ({ doctor_id: user!.id, department: z.department, zone: z.zone }))
        )
        if (zError) throw zError
      }

      await supabase.from('doctor_schedules').delete().eq('doctor_id', user!.id)
      const enabledSchedules = schedules.filter((s) => s.enabled && s.start_time && s.end_time)
      if (enabledSchedules.length > 0) {
        const { error: sError } = await supabase.from('doctor_schedules').insert(
          enabledSchedules.map((s) => ({
            doctor_id: user!.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
          }))
        )
        if (sError) throw sError
      }

      setSaved(true)
      setTimeout(() => navigate('/dashboard/medico'), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Mi perfil médico</h1>
        <p className="text-gray-500 mt-1">Completá tu información para que los pacientes puedan encontrarte.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* Basic info */}
        <div className="card space-y-5">
          <h2 className="text-lg font-semibold text-gray-800">Información básica</h2>

          <div>
            <label className="label">Especialidad *</label>
            <select className="input" value={specialty} onChange={(e) => setSpecialty(e.target.value)} required>
              <option value="">Seleccioná tu especialidad</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Bio / Presentación</label>
            <textarea
              className="input resize-none"
              rows={4}
              placeholder="Contale a los pacientes sobre tu experiencia, formación y enfoque..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Costo de consulta ($ uruguayos)</label>
            <input
              type="number"
              className="input"
              placeholder="Ej: 1500"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              min={0}
            />
          </div>
        </div>

        {/* Zones */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Zonas donde trabajo *</h2>
            {selectedZones.length > 0 && (
              <span className="text-primary-600 text-sm font-medium">{selectedZones.length} zona{selectedZones.length !== 1 ? 's' : ''} seleccionada{selectedZones.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Selected tags */}
          {selectedZones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedZones.map((z) => (
                <span
                  key={`${z.department}-${z.zone}`}
                  className="bg-primary-100 text-primary-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5"
                >
                  {z.zone !== z.department ? `${z.zone}, ${z.department}` : z.department}
                  <button
                    type="button"
                    onClick={() => toggleZone(z.department, z.zone)}
                    className="hover:text-primary-900"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Department accordion */}
          <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-200">
            {DEPARTMENTS.map((dept) => {
              const deptZones = ZONES[dept]
              const selectedInDept = selectedZones.filter((z) => z.department === dept).length
              const isOpen = openDept === dept

              return (
                <div key={dept}>
                  <button
                    type="button"
                    onClick={() => setOpenDept(isOpen ? null : dept)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                  >
                    <span className="font-medium text-gray-800">
                      {dept}
                      {selectedInDept > 0 && (
                        <span className="ml-2 text-primary-600 text-sm">({selectedInDept})</span>
                      )}
                    </span>
                    <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => toggleDeptAll(dept)}
                        className="text-primary-600 text-xs font-medium mb-3 hover:underline"
                      >
                        {deptZones.every((z) => selectedZones.some((s) => s.department === dept && s.zone === z))
                          ? 'Deseleccionar todo'
                          : 'Seleccionar todo'}
                      </button>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {deptZones.map((zone) => {
                          const checked = selectedZones.some((z) => z.department === dept && z.zone === zone)
                          return (
                            <label key={zone} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleZone(dept, zone)}
                                className="accent-primary-600 w-4 h-4"
                              />
                              <span className="text-sm text-gray-700">{zone}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Schedule */}
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Horarios de atención</h2>
          <p className="text-gray-500 text-sm">Indicá los días y horarios en que estás disponible normalmente.</p>
          <div className="space-y-3">
            {schedules.map((row, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${row.enabled ? 'bg-primary-50' : 'bg-gray-50'}`}>
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => updateSchedule(i, 'enabled', e.target.checked)}
                  className="accent-primary-600 w-4 h-4 flex-shrink-0"
                />
                <span className={`w-24 text-sm font-medium flex-shrink-0 ${row.enabled ? 'text-primary-700' : 'text-gray-400'}`}>
                  {DAYS_OF_WEEK[i]}
                </span>
                {row.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      className="input py-1.5 text-sm"
                      value={row.start_time}
                      onChange={(e) => updateSchedule(i, 'start_time', e.target.value)}
                    />
                    <span className="text-gray-400 flex-shrink-0">a</span>
                    <input
                      type="time"
                      className="input py-1.5 text-sm"
                      value={row.end_time}
                      onChange={(e) => updateSchedule(i, 'end_time', e.target.value)}
                    />
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">No disponible</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            ¡Perfil guardado! Redirigiendo a tu agenda...
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/dashboard/medico')} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar perfil'}
          </button>
        </div>
      </form>
    </div>
  )
}
