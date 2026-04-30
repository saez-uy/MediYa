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

function zoneKey(dept: string, zone: string) {
  return `${dept}|${zone}`
}

function defaultSchedule(): ScheduleRow[] {
  return DAYS_OF_WEEK.map((_, i) => ({ day_of_week: i, enabled: false, start_time: '09:00', end_time: '17:00' }))
}

export default function DoctorSetup() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [specialties, setSpecialties] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [fee, setFee] = useState('')
  const [selectedZones, setSelectedZones] = useState<SelectedZone[]>([])
  const [zoneSchedules, setZoneSchedules] = useState<Record<string, ScheduleRow[]>>({})
  const [openDept, setOpenDept] = useState<string | null>('Montevideo')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [needsPayment, setNeedsPayment] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')

  useEffect(() => {
    if (!user) return
    loadExistingProfile()
  }, [user])

  async function loadExistingProfile() {
    setFetching(true)

    const { data: dp } = await supabase.from('doctor_profiles').select('*').eq('id', user!.id).single()
    if (dp) {
      setBio(dp.bio || '')
      setFee(dp.consultation_fee ? String(dp.consultation_fee) : '')
      setIsActive(dp.is_active ?? false)
      if (dp.is_active === false) setNeedsPayment(true)
    }

    const { data: specs } = await supabase
      .from('doctor_specialties')
      .select('specialty')
      .eq('doctor_id', user!.id)
    if (specs) setSpecialties(specs.map((s: { specialty: string }) => s.specialty))

    const { data: zones } = await supabase
      .from('doctor_zones')
      .select('id, department, zone, doctor_zone_schedules(*)')
      .eq('doctor_id', user!.id)

    if (zones && zones.length > 0) {
      const newZones: SelectedZone[] = []
      const newSchedules: Record<string, ScheduleRow[]> = {}
      for (const z of zones) {
        newZones.push({ department: z.department, zone: z.zone })
        const key = zoneKey(z.department, z.zone)
        newSchedules[key] = DAYS_OF_WEEK.map((_, i) => {
          const match = (z.doctor_zone_schedules as { day_of_week: number; start_time: string; end_time: string }[])
            ?.find((s) => s.day_of_week === i)
          if (match) return { day_of_week: i, enabled: true, start_time: match.start_time.slice(0, 5), end_time: match.end_time.slice(0, 5) }
          return { day_of_week: i, enabled: false, start_time: '09:00', end_time: '17:00' }
        })
      }
      setSelectedZones(newZones)
      setZoneSchedules(newSchedules)
    }

    setFetching(false)
  }

  function toggleSpecialty(s: string) {
    setSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    )
  }

  function toggleZone(department: string, zone: string) {
    const key = zoneKey(department, zone)
    setSelectedZones((prev) => {
      const exists = prev.some((z) => z.department === department && z.zone === zone)
      if (exists) {
        setZoneSchedules((s) => { const n = { ...s }; delete n[key]; return n })
        return prev.filter((z) => !(z.department === department && z.zone === zone))
      }
      setZoneSchedules((s) => ({ ...s, [key]: defaultSchedule() }))
      return [...prev, { department, zone }]
    })
  }

  function toggleDeptAll(department: string) {
    const deptZones = ZONES[department].map((zone) => ({ department, zone }))
    const allSelected = deptZones.every((dz) =>
      selectedZones.some((z) => z.department === dz.department && z.zone === dz.zone)
    )
    if (allSelected) {
      deptZones.forEach((dz) => {
        const key = zoneKey(dz.department, dz.zone)
        setZoneSchedules((s) => { const n = { ...s }; delete n[key]; return n })
      })
      setSelectedZones((prev) => prev.filter((z) => z.department !== department))
    } else {
      const missing = deptZones.filter(
        (dz) => !selectedZones.some((z) => z.department === dz.department && z.zone === dz.zone)
      )
      missing.forEach((dz) => {
        const key = zoneKey(dz.department, dz.zone)
        setZoneSchedules((s) => ({ ...s, [key]: defaultSchedule() }))
      })
      setSelectedZones((prev) => {
        const withoutDept = prev.filter((z) => z.department !== department)
        return [...withoutDept, ...deptZones]
      })
    }
  }

  function updateZoneSchedule(key: string, dayIndex: number, field: keyof ScheduleRow, value: string | boolean) {
    setZoneSchedules((prev) => ({
      ...prev,
      [key]: prev[key].map((row, i) => (i === dayIndex ? { ...row, [field]: value } : row)),
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (specialties.length === 0) { setError('Seleccioná al menos una especialidad.'); return }
    if (selectedZones.length === 0) { setError('Seleccioná al menos una zona de trabajo.'); return }
    setError('')
    setLoading(true)

    try {
      const { error: dpError } = await supabase.from('doctor_profiles').upsert({
        id: user!.id,
        bio: bio || null,
        consultation_fee: fee ? parseInt(fee) : null,
        is_active: isActive,
      })
      if (dpError) throw dpError

      await supabase.from('doctor_specialties').delete().eq('doctor_id', user!.id)
      const { error: spError } = await supabase.from('doctor_specialties').insert(
        specialties.map((s) => ({ doctor_id: user!.id, specialty: s }))
      )
      if (spError) throw spError

      await supabase.from('doctor_zones').delete().eq('doctor_id', user!.id)
      const { data: newZones, error: zError } = await supabase
        .from('doctor_zones')
        .insert(selectedZones.map((z) => ({ doctor_id: user!.id, department: z.department, zone: z.zone })))
        .select('id, department, zone')
      if (zError) throw zError

      const scheduleRows: { zone_id: string; day_of_week: number; start_time: string; end_time: string }[] = []
      for (const z of newZones!) {
        const key = zoneKey(z.department, z.zone)
        const rows = (zoneSchedules[key] || []).filter((s) => s.enabled && s.start_time && s.end_time)
        for (const row of rows) {
          scheduleRows.push({ zone_id: z.id, day_of_week: row.day_of_week, start_time: row.start_time, end_time: row.end_time })
        }
      }
      if (scheduleRows.length > 0) {
        const { error: sError } = await supabase.from('doctor_zone_schedules').insert(scheduleRows)
        if (sError) throw sError
      }

      if (isActive) {
        setSaved(true)
        setTimeout(() => navigate('/dashboard/medico'), 1000)
      } else {
        setJustSaved(true)
        setNeedsPayment(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify() {
    setVerifying(true)
    setVerifyMsg('')
    setError('')
    try {
      const { data, error } = await supabase.functions.invoke('mp-webhook', {
        body: { verify_doctor: true },
      })
      if (error) throw error
      if (data?.status === 'approved') {
        setIsActive(true)
        setNeedsPayment(false)
        setSaved(true)
        setTimeout(() => navigate('/dashboard/medico'), 1500)
      } else {
        setVerifyMsg('Tu pago todavía no fue acreditado. Si ya pagaste, esperá unos minutos e intentá de nuevo.')
      }
    } catch {
      setVerifyMsg('Error al verificar. Intentá de nuevo.')
    } finally {
      setVerifying(false)
    }
  }

  async function handlePay() {
    setPaymentLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { doctor_id: user!.id },
      })
      if (error) throw error
      window.location.href = data.checkout_url
    } catch (err) {
      setError('Error al iniciar el pago. Intentá de nuevo.')
      setPaymentLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (needsPayment) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="card max-w-md w-full space-y-6">
          <div className="text-center">
            <p className="text-4xl mb-3">{justSaved ? '🎉' : '⚠️'}</p>
            <h2 className="text-2xl font-bold text-gray-900">
              {justSaved ? '¡Perfil guardado!' : 'Cuenta pendiente de activación'}
            </h2>
            <p className="text-gray-500 mt-2">
              {justSaved
                ? 'Un último paso para activar tu cuenta y empezar a recibir turnos.'
                : 'Completá el pago para aparecer en las búsquedas y recibir turnos.'}
            </p>
          </div>
          <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg border border-primary-200">
            <div>
              <p className="font-medium text-gray-900">Alta médico en MediYa</p>
              <p className="text-gray-500 text-sm">Acceso completo a la plataforma</p>
            </div>
            <p className="text-2xl font-bold text-primary-700">$ 500 <span className="text-sm font-normal text-gray-400">UYU</span></p>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
          {verifyMsg && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm">{verifyMsg}</div>
          )}
          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">¡Cuenta activada! Redirigiendo...</div>
          )}
          <button
            onClick={handlePay}
            disabled={paymentLoading || verifying}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {paymentLoading ? 'Redirigiendo...' : '💳 Pagar con MercadoPago'}
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying || paymentLoading}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            {verifying ? 'Verificando...' : '🔄 Ya pagué, verificar estado'}
          </button>
          <button
            onClick={() => setNeedsPayment(false)}
            className="btn-ghost w-full text-sm text-gray-500"
          >
            Volver a editar perfil
          </button>
        </div>
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

        {/* Specialties */}
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Especialidades *</h2>

          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="bg-primary-100 text-primary-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5"
                >
                  {s}
                  <button type="button" onClick={() => toggleSpecialty(s)} className="hover:text-primary-900">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
            {SPECIALTIES.map((s) => {
              const checked = specialties.includes(s)
              return (
                <label key={s} className="flex items-center gap-2 cursor-pointer py-1.5 px-1 rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSpecialty(s)}
                    className="accent-primary-600 w-4 h-4 flex-shrink-0"
                  />
                  <span className="text-sm text-gray-700">{s}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Zones */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Zonas donde trabajo *</h2>
            {selectedZones.length > 0 && (
              <span className="text-primary-600 text-sm font-medium">
                {selectedZones.length} zona{selectedZones.length !== 1 ? 's' : ''} seleccionada{selectedZones.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {selectedZones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedZones.map((z) => (
                <span
                  key={`${z.department}-${z.zone}`}
                  className="bg-primary-100 text-primary-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5"
                >
                  {z.zone !== z.department ? `${z.zone}, ${z.department}` : z.department}
                  <button type="button" onClick={() => toggleZone(z.department, z.zone)} className="hover:text-primary-900">×</button>
                </span>
              ))}
            </div>
          )}

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

        {/* Zone schedules */}
        {selectedZones.length > 0 && (
          <div className="card space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Horarios por zona</h2>
              <p className="text-gray-500 text-sm mt-1">Indicá en qué días y horarios atendés en cada zona.</p>
            </div>

            {selectedZones.map((z) => {
              const key = zoneKey(z.department, z.zone)
              const sched = zoneSchedules[key] || defaultSchedule()
              return (
                <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">
                      📍 {z.zone !== z.department ? `${z.zone}, ${z.department}` : z.department}
                    </span>
                  </div>
                  <div className="p-3 space-y-2">
                    {sched.map((row, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-2.5 rounded-lg ${row.enabled ? 'bg-primary-50' : 'bg-gray-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) => updateZoneSchedule(key, i, 'enabled', e.target.checked)}
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
                              onChange={(e) => updateZoneSchedule(key, i, 'start_time', e.target.value)}
                            />
                            <span className="text-gray-400 flex-shrink-0">a</span>
                            <input
                              type="time"
                              className="input py-1.5 text-sm"
                              value={row.end_time}
                              onChange={(e) => updateZoneSchedule(key, i, 'end_time', e.target.value)}
                            />
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">No disponible</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

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
