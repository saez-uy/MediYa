import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SPECIALTIES, DEPARTMENTS, ZONES, DAYS_OF_WEEK } from '../lib/constants'
import type { DoctorWithDetails } from '../types'
import DoctorCard from '../components/DoctorCard'

const MODALITY_OPTIONS = [
  { value: '', label: 'Cualquier modalidad' },
  { value: 'presencial', label: '🏥 Presencial' },
  { value: 'videollamada', label: '💻 Videollamada' },
]

export default function SearchDoctors() {
  const [doctors, setDoctors] = useState<DoctorWithDetails[]>([])
  const [filtered, setFiltered] = useState<DoctorWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const [specialty, setSpecialty] = useState('')
  const [department, setDepartment] = useState('')
  const [zone, setZone] = useState('')
  const [modality, setModality] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('')

  useEffect(() => {
    fetchDoctors()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [doctors, specialty, department, zone, modality, dayOfWeek])

  async function fetchDoctors() {
    setLoading(true)
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
      .eq('is_active', true)
      .eq('admin_enabled', true)

    if (!error && data) {
      setDoctors(data as unknown as DoctorWithDetails[])
    }
    setLoading(false)
  }

  function doctorSupportsModality(doctor: DoctorWithDetails, filter: string): boolean {
    const schedules = doctor.zones.flatMap((z) => z.schedules)
    return schedules.some((s) => {
      const m = (s as unknown as { modality: string }).modality ?? 'presencial'
      return m === filter || m === 'ambas'
    })
  }

  function applyFilters() {
    let result = [...doctors]

    if (specialty) {
      result = result.filter((d) => d.specialties.some((s) => s.specialty === specialty))
    }

    if (department) {
      result = result.filter((d) => d.zones.some((z) => z.department === department))
    }

    if (zone) {
      result = result.filter((d) => d.zones.some((z) => z.zone === zone))
    }

    if (modality) {
      result = result.filter((d) => doctorSupportsModality(d, modality))
    }

    if (dayOfWeek !== '') {
      const day = parseInt(dayOfWeek)
      result = result.filter((d) =>
        d.zones.some((z) =>
          z.schedules.some((s) => (s as unknown as { day_of_week: number }).day_of_week === day)
        )
      )
    }

    setFiltered(result)
  }

  function handleDepartmentChange(dept: string) {
    setDepartment(dept)
    setZone('')
  }

  function clearFilters() {
    setSpecialty('')
    setDepartment('')
    setZone('')
    setModality('')
    setDayOfWeek('')
  }

  const hasFilters = specialty || department || zone || modality || dayOfWeek !== ''

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Buscar médicos</h1>
        <p className="text-gray-500 mt-1">Encontrá el especialista que necesitás en tu zona.</p>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label">Especialidad</label>
            <select className="input" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              <option value="">Todas las especialidades</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Departamento</label>
            <select className="input" value={department} onChange={(e) => handleDepartmentChange(e.target.value)}>
              <option value="">Todos los departamentos</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Zona / Barrio</label>
            <select
              className="input"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              disabled={!department}
            >
              <option value="">Todas las zonas</option>
              {department &&
                ZONES[department]?.map((z) => (
                  <option key={z} value={z}>{z}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Modalidad</label>
            <select className="input" value={modality} onChange={(e) => setModality(e.target.value)}>
              {MODALITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Disponible el</label>
            <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
              <option value="">Cualquier día</option>
              {DAYS_OF_WEEK.map((d, i) => (
                <option key={i} value={String(i)}>{d}</option>
              ))}
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-4 flex items-center gap-2">
            <button onClick={clearFilters} className="text-sm text-primary-600 hover:underline">
              Limpiar filtros
            </button>
            <span className="text-gray-400 text-sm">
              · {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-gray-500 text-lg">
            {hasFilters ? 'No hay médicos con esos filtros.' : 'Todavía no hay médicos registrados.'}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-4 btn-secondary text-sm">
              Ver todos los médicos
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  )
}
