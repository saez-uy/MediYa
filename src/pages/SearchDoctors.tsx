import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SPECIALTIES, DEPARTMENTS, ZONES } from '../lib/constants'
import type { DoctorWithDetails } from '../types'
import DoctorCard from '../components/DoctorCard'

export default function SearchDoctors() {
  const [doctors, setDoctors] = useState<DoctorWithDetails[]>([])
  const [filtered, setFiltered] = useState<DoctorWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const [specialty, setSpecialty] = useState('')
  const [department, setDepartment] = useState('')
  const [zone, setZone] = useState('')

  useEffect(() => {
    fetchDoctors()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [doctors, specialty, department, zone])

  async function fetchDoctors() {
    setLoading(true)
    const { data, error } = await supabase
      .from('doctor_profiles')
      .select(`
        id,
        specialty,
        bio,
        consultation_fee,
        is_active,
        profile:profiles!inner(id, full_name, phone, role, created_at),
        zones:doctor_zones(*),
        schedules:doctor_schedules(*)
      `)
      .eq('is_active', true)

    if (!error && data) {
      setDoctors(data as unknown as DoctorWithDetails[])
    }
    setLoading(false)
  }

  function applyFilters() {
    let result = [...doctors]

    if (specialty) {
      result = result.filter((d) => d.specialty === specialty)
    }

    if (department) {
      result = result.filter((d) => d.zones.some((z) => z.department === department))
    }

    if (zone) {
      result = result.filter((d) => d.zones.some((z) => z.zone === zone))
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
  }

  const hasFilters = specialty || department || zone

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Buscar médicos</h1>
        <p className="text-gray-500 mt-1">Encontrá el especialista que necesitás en tu zona.</p>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Especialidad</label>
            <select
              className="input"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
            >
              <option value="">Todas las especialidades</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Departamento</label>
            <select
              className="input"
              value={department}
              onChange={(e) => handleDepartmentChange(e.target.value)}
            >
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
