import { Link } from 'react-router-dom'
import type { DoctorWithDetails } from '../types'
import { DAYS_OF_WEEK } from '../lib/constants'

interface Props {
  doctor: DoctorWithDetails
}

export default function DoctorCard({ doctor }: Props) {
  const initials = doctor.profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const activeDays = doctor.schedules.map((s) => DAYS_OF_WEEK[s.day_of_week].slice(0, 3)).join(', ')

  const topZones = doctor.zones.slice(0, 3)
  const extraZones = doctor.zones.length - 3

  return (
    <div className="card flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <span className="text-primary-700 font-bold text-lg">{initials}</span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{doctor.profile.full_name}</h3>
          <p className="text-primary-600 text-sm font-medium">{doctor.specialty}</p>
          {doctor.consultation_fee && (
            <p className="text-gray-500 text-sm">$ {doctor.consultation_fee.toLocaleString('es-UY')} la consulta</p>
          )}
        </div>
      </div>

      {/* Zones */}
      {topZones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topZones.map((z) => (
            <span
              key={z.id}
              className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full"
            >
              {z.zone !== z.department ? `${z.zone}, ${z.department}` : z.department}
            </span>
          ))}
          {extraZones > 0 && (
            <span className="bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-full">
              +{extraZones} más
            </span>
          )}
        </div>
      )}

      {/* Schedule */}
      {activeDays && (
        <p className="text-gray-500 text-sm flex items-center gap-1.5">
          <span>📅</span>
          <span>{activeDays}</span>
        </p>
      )}

      <Link to={`/perfil/${doctor.id}`} className="btn-primary text-sm text-center mt-auto">
        Ver perfil y reservar
      </Link>
    </div>
  )
}
