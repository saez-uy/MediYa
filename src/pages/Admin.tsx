import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_LABELS } from '../lib/constants'

interface DoctorRow {
  id: string
  is_active: boolean
  admin_enabled: boolean
  caja_profesional: string | null
  documento: string | null
  mp_subscription_id: string | null
  profile: { full_name: string; phone: string | null; created_at: string }
}

interface AppointmentRow {
  id: string
  requested_date: string
  requested_time: string
  status: string
  modality: string | null
  created_at: string
  patient: { full_name: string } | null
  doctor: { full_name: string } | null
}

type AdminTab = 'doctors' | 'appointments' | 'payments'

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_authed') === '1')
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AdminTab>('doctors')

  // Doctor filters
  const [filterName, setFilterName] = useState('')
  const [filterCI, setFilterCI] = useState('')
  const [filterCaja, setFilterCaja] = useState('')
  const [filterPago, setFilterPago] = useState('')

  // Appointment filters
  const [filterApptStatus, setFilterApptStatus] = useState('')
  const [filterApptDoctor, setFilterApptDoctor] = useState('')

  const filteredDoctors = useMemo(() => doctors.filter((d) => {
    if (filterName && !d.profile.full_name.toLowerCase().includes(filterName.toLowerCase())) return false
    if (filterCI && !(d.documento ?? '').toLowerCase().includes(filterCI.toLowerCase())) return false
    if (filterCaja && !(d.caja_profesional ?? '').toLowerCase().includes(filterCaja.toLowerCase())) return false
    if (filterPago === 'pagado' && !d.is_active) return false
    if (filterPago === 'pendiente' && d.is_active) return false
    return true
  }), [doctors, filterName, filterCI, filterCaja, filterPago])

  const filteredAppointments = useMemo(() => appointments.filter((a) => {
    if (filterApptStatus && a.status !== filterApptStatus) return false
    if (filterApptDoctor && !(a.doctor?.full_name ?? '').toLowerCase().includes(filterApptDoctor.toLowerCase())) return false
    return true
  }), [appointments, filterApptStatus, filterApptDoctor])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLoginError('')
    try {
      const { data, error } = await supabase.functions.invoke('admin-action', {
        body: { password, action: 'list' },
      })
      if (error || data?.error) { setLoginError(data?.error ?? 'Error al conectar.'); return }
      sessionStorage.setItem('admin_authed', '1')
      sessionStorage.setItem('admin_pw', password)
      setAuthed(true)
      setDoctors(data.doctors ?? [])
    } catch {
      setLoginError('Error al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  async function loadDoctors() {
    setLoading(true)
    const pw = sessionStorage.getItem('admin_pw') ?? ''
    const { data } = await supabase.functions.invoke('admin-action', { body: { password: pw, action: 'list' } })
    setDoctors(data?.doctors ?? [])
    setLoading(false)
  }

  async function loadAppointments() {
    setLoading(true)
    const pw = sessionStorage.getItem('admin_pw') ?? ''
    const { data } = await supabase.functions.invoke('admin-action', { body: { password: pw, action: 'list_appointments' } })
    setAppointments(data?.appointments ?? [])
    setLoading(false)
  }

  async function handleTabChange(tab: AdminTab) {
    setActiveTab(tab)
    if (tab === 'appointments' && appointments.length === 0) await loadAppointments()
  }

  async function handleToggle(doctor: DoctorRow) {
    setTogglingId(doctor.id)
    const pw = sessionStorage.getItem('admin_pw') ?? ''
    const newVal = !doctor.admin_enabled
    const { data } = await supabase.functions.invoke('admin-action', {
      body: { password: pw, action: 'toggle', doctor_id: doctor.id, admin_enabled: newVal },
    })
    if (data?.ok) setDoctors((prev) => prev.map((d) => d.id === doctor.id ? { ...d, admin_enabled: newVal } : d))
    setTogglingId(null)
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_authed')
    sessionStorage.removeItem('admin_pw')
    setAuthed(false)
    setDoctors([])
    setAppointments([])
    setPassword('')
  }

  if (!authed) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="card max-w-sm w-full space-y-6">
          <div className="text-center">
            <p className="text-3xl mb-2">🔐</p>
            <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
            <p className="text-gray-500 text-sm mt-1">Ingresá la contraseña para continuar.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" className="input" placeholder="Contraseña" value={password}
              onChange={(e) => setPassword(e.target.value)} required autoFocus />
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{loginError}</div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'doctors', label: '👨‍⚕️ Médicos' },
    { key: 'appointments', label: '📅 Turnos' },
    { key: 'payments', label: '💳 Pagos' },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Panel de administración</h1>
        <div className="flex gap-3">
          <button onClick={() => activeTab === 'appointments' ? loadAppointments() : loadDoctors()}
            className="btn-secondary text-sm" disabled={loading}>
            {loading ? 'Actualizando...' : '🔄 Actualizar'}
          </button>
          <button onClick={handleLogout} className="btn-ghost text-sm">Salir</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DOCTORS TAB ── */}
      {activeTab === 'doctors' && (
        <>
          <p className="text-gray-500 text-sm mb-4">{filteredDoctors.length} de {doctors.length} médico{doctors.length !== 1 ? 's' : ''}</p>
          <div className="card mb-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Nombre</label>
                <input type="text" className="input" placeholder="Buscar por nombre..." value={filterName} onChange={(e) => setFilterName(e.target.value)} />
              </div>
              <div>
                <label className="label">CI</label>
                <input type="text" className="input" placeholder="Buscar por CI..." value={filterCI} onChange={(e) => setFilterCI(e.target.value)} />
              </div>
              <div>
                <label className="label">Caja Profesional</label>
                <input type="text" className="input" placeholder="Buscar por nro. caja..." value={filterCaja} onChange={(e) => setFilterCaja(e.target.value)} />
              </div>
              <div>
                <label className="label">Estado de pago</label>
                <select className="input" value={filterPago} onChange={(e) => setFilterPago(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                </select>
              </div>
            </div>
            {(filterName || filterCI || filterCaja || filterPago) && (
              <div className="mt-3">
                <button onClick={() => { setFilterName(''); setFilterCI(''); setFilterCaja(''); setFilterPago('') }}
                  className="text-sm text-primary-600 hover:underline">Limpiar filtros</button>
              </div>
            )}
          </div>

          {loading && doctors.length === 0 ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>
          ) : filteredDoctors.length === 0 ? (
            <div className="text-center py-20 text-gray-500">No hay médicos registrados.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-700">Nombre</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">CI</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Caja Prof.</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Teléfono</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">Pago</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">Habilitado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDoctors.map((doc) => (
                    <tr key={doc.id} className={`hover:bg-gray-50 transition-colors ${!doc.admin_enabled ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {doc.profile.full_name}
                        <div className="text-xs text-gray-400 font-normal">{new Date(doc.profile.created_at).toLocaleDateString('es-UY')}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{doc.documento ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-600">{doc.caja_profesional ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-600">{doc.profile.phone ?? <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">
                        {doc.is_active
                          ? <span className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">Pagado</span>
                          : <span className="inline-block bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">Pendiente</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggle(doc)} disabled={togglingId === doc.id}
                          className="relative inline-flex items-center" title={doc.admin_enabled ? 'Deshabilitar' : 'Habilitar'}>
                          <div className={`w-11 h-6 rounded-full transition-colors ${doc.admin_enabled ? 'bg-primary-600' : 'bg-gray-300'} ${togglingId === doc.id ? 'opacity-50' : ''}`}>
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${doc.admin_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                          </div>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── APPOINTMENTS TAB ── */}
      {activeTab === 'appointments' && (
        <>
          <p className="text-gray-500 text-sm mb-4">{filteredAppointments.length} de {appointments.length} turno{appointments.length !== 1 ? 's' : ''}</p>
          <div className="card mb-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Médico</label>
                <input type="text" className="input" placeholder="Buscar por nombre de médico..."
                  value={filterApptDoctor} onChange={(e) => setFilterApptDoctor(e.target.value)} />
              </div>
              <div>
                <label className="label">Estado</label>
                <select className="input" value={filterApptStatus} onChange={(e) => setFilterApptStatus(e.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="pending">Pendiente</option>
                  <option value="accepted">Confirmado</option>
                  <option value="rejected">Rechazado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="pending_payment">Pago pendiente</option>
                </select>
              </div>
            </div>
            {(filterApptStatus || filterApptDoctor) && (
              <div className="mt-3">
                <button onClick={() => { setFilterApptStatus(''); setFilterApptDoctor('') }}
                  className="text-sm text-primary-600 hover:underline">Limpiar filtros</button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-20 text-gray-500">No hay turnos registrados.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <th className="px-4 py-3 font-semibold text-gray-700">Paciente</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Médico</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Hora</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Modalidad</th>
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAppointments.map((appt) => {
                    const date = new Date(appt.requested_date + 'T12:00:00')
                    const dateStr = date.toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' })
                    const statusColors: Record<string, string> = {
                      pending: 'bg-yellow-100 text-yellow-700',
                      accepted: 'bg-green-100 text-green-700',
                      rejected: 'bg-red-100 text-red-700',
                      cancelled: 'bg-gray-100 text-gray-600',
                      pending_payment: 'bg-amber-100 text-amber-700',
                    }
                    return (
                      <tr key={appt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{appt.patient?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{appt.doctor?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{dateStr}</td>
                        <td className="px-4 py-3 text-gray-600">{appt.requested_time.slice(0, 5)} hs</td>
                        <td className="px-4 py-3 text-gray-600">
                          {appt.modality === 'videollamada' ? '💻 Video' : appt.modality === 'presencial' ? '🏥 Presencial' : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[appt.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STATUS_LABELS[appt.status] ?? appt.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── PAYMENTS TAB ── */}
      {activeTab === 'payments' && (
        <>
          <p className="text-gray-500 text-sm mb-4">
            {doctors.filter(d => d.is_active).length} suscripciones activas de {doctors.length} médicos
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-700">Médico</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">CI</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Caja Prof.</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">ID Suscripción MP</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Registro</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {doctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{doc.profile.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{doc.documento ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{doc.caja_profesional ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {doc.mp_subscription_id ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(doc.profile.created_at).toLocaleDateString('es-UY')}</td>
                    <td className="px-4 py-3 text-center">
                      {doc.is_active
                        ? <span className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">✓ Activa</span>
                        : <span className="inline-block bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">Pendiente</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
