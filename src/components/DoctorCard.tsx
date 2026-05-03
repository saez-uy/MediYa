import { Link } from 'react-router-dom'
import type { DoctorWithDetails } from '../types'
import { DAYS_OF_WEEK } from '../lib/constants'
import { StarDisplay } from './StarRating'

interface Props {
  doctor: DoctorWithDetails
  rating?: { avg: number; count: number }
}

export default function DoctorCard({ doctor, rating }: Props) {
  const initials = doctor.profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const allDayIndices = [...new Set(doctor.zones.flatMap((z) => z.schedules.map((s) => s.day_of_week)))].sort((a, b) => a - b)
  const activeDays = allDayIndices.map((d) => DAYS_OF_WEEK[d].slice(0, 3)).join(', ')
  const topZones = doctor.zones.slice(0, 3)
  const extraZones = doctor.zones.length - 3

  return (
    <div className="card flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <span className="text-primary-700 font-bold text-lg">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{doctor.profile.full_name}</h3>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {doctor.specialties.slice(0, 2).map((s) => (
              <span key={s.specialty} className="text-primary-600 text-xs font-medium">{s.specialty}</span>
            ))}
            {doctor.specialties.length > 2 && (
              <span className="text-gray-400 text-xs">+{doctor.specialties.length - 2} más</span>
            )}
          </div>
          {/* Rating */}
          <div className="mt-1">
            {rating && rating.count > 0
              ? <StarDisplay avg={rating.avg} count={rating.count} size="sm" />
              : <span className="text-xs text-gray-400">Sin calificaciones</span>
            }
          </div>
          {doctor.service_fees && (
            <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">💰 {doctor.service_fees.split('\n')[0]}</p>
          )}
        </div>
      </div>

      {topZones.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topZones.map((z) => (
            <span key={z.id} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
              {z.zone !== z.department ? `${z.zone}, ${z.department}` : z.department}
            </span>
          ))}
          {extraZones > 0 && (
            <span className="bg-gray-100 text-gray-500 text-xs px-2.5 py-1 rounded-full">+{extraZones} más</span>
          )}
        </div>
      )}

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
