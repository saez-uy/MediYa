import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

interface DoctorRow {
  id: string
  is_active: boolean
  admin_enabled: boolean
  caja_profesional: string | null
  documento: string | null
  profile: { full_name: string; phone: string | null; created_at: string }
}

export default function Admin() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_authed') === '1')
  const [doctors, setDoctors] = useState<DoctorRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [filterName, setFilterName] = useState('')
  const [filterCI, setFilterCI] = useState('')
  const [filterCaja, setFilterCaja] = useState('')
  const [filterPago, setFilterPago] = useState('')

  const filtered = useMemo(() => {
    return doctors.filter((d) => {
      if (filterName && !d.profile.full_name.toLowerCase().includes(filterName.toLowerCase())) return false
      if (filterCI && !(d.documento ?? '').toLowerCase().includes(filterCI.toLowerCase())) return false
      if (filterCaja && !(d.caja_profesional ?? '').toLowerCase().includes(filterCaja.toLowerCase())) return false
      if (filterPago === 'pagado' && !d.is_active) return false
      if (filterPago === 'pendiente' && d.is_active) return false
      return true
    })
  }, [doctors, filterName, filterCI, filterCaja, filterPago])

  const hasFilters = filterName || filterCI || filterCaja || filterPago

  function clearFilters() {
    setFilterName('')
    setFilterCI('')
    setFilterCaja('')
    setFilterPago('')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLoginError('')
    try {
      const { data, error } = await supabase.functions.invoke('admin-action', {
        body: { password, action: 'list' },
      })
      if (error || data?.error) {
        setLoginError(data?.error ?? 'Error al conectar.')
        return
      }
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
    const { data } = await supabase.functions.invoke('admin-action', {
      body: { password: pw, action: 'list' },
    })
    setDoctors(data?.doctors ?? [])
    setLoading(false)
  }

  async function handleToggle(doctor: DoctorRow) {
    setTogglingId(doctor.id)
    const pw = sessionStorage.getItem('admin_pw') ?? ''
    const newVal = !doctor.admin_enabled
    const { data } = await supabase.functions.invoke('admin-action', {
      body: { password: pw, action: 'toggle', doctor_id: doctor.id, admin_enabled: newVal },
    })
    if (data?.ok) {
      setDoctors((prev) =>
        prev.map((d) => (d.id === doctor.id ? { ...d, admin_enabled: newVal } : d))
      )
    }
    setTogglingId(null)
  }

  function handleLogout() {
    sessionStorage.removeItem('admin_authed')
    sessionStorage.removeItem('admin_pw')
    setAuthed(false)
    setDoctors([])
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
            <input
              type="password"
              className="input"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de administración</h1>
          <p className="text-gray-500 mt-1">
            {filtered.length} de {doctors.length} médico{doctors.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadDoctors} className="btn-secondary text-sm" disabled={loading}>
            {loading ? 'Actualizando...' : '🔄 Actualizar'}
          </button>
          <button onClick={handleLogout} className="btn-ghost text-sm">
            Salir
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Nombre</label>
            <input
              type="text"
              className="input"
              placeholder="Buscar por nombre..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">CI</label>
            <input
              type="text"
              className="input"
              placeholder="Buscar por CI..."
              value={filterCI}
              onChange={(e) => setFilterCI(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Caja Profesional</label>
            <input
              type="text"
              className="input"
              placeholder="Buscar por nro. caja..."
              value={filterCaja}
              onChange={(e) => setFilterCaja(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Estado de pago</label>
            <select
              className="input"
              value={filterPago}
              onChange={(e) => setFilterPago(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="mt-3">
            <button onClick={clearFilters} className="text-sm text-primary-600 hover:underline">
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {loading && doctors.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {hasFilters ? 'Ningún médico coincide con los filtros.' : 'No hay médicos registrados.'}
        </div>
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
              {filtered.map((doc) => (
                <tr key={doc.id} className={`hover:bg-gray-50 transition-colors ${!doc.admin_enabled ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {doc.profile.full_name}
                    <div className="text-xs text-gray-400 font-normal">
                      {new Date(doc.profile.created_at).toLocaleDateString('es-UY')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.documento ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{doc.caja_profesional ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{doc.profile.phone ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-center">
                    {doc.is_active ? (
                      <span className="inline-block bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">Pagado</span>
                    ) : (
                      <span className="inline-block bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(doc)}
                      disabled={togglingId === doc.id}
                      className="relative inline-flex items-center"
                      title={doc.admin_enabled ? 'Deshabilitar' : 'Habilitar'}
                    >
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
    </div>
  )
}
