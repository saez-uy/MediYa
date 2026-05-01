import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import ChangePasswordForm from '../components/ChangePasswordForm'

export default function PatientProfile() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { setError('El teléfono es obligatorio.'); return }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ phone: phone.trim() })
        .eq('id', user!.id)
      if (error) throw error
      setSaved(true)
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-8">
      <div>
        <button onClick={() => navigate('/dashboard/paciente')} className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1 mb-4">
          ← Volver a mis turnos
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Mi perfil</h1>
      </div>

      {/* Datos básicos */}
      <div className="card space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">Información personal</h2>
        <div>
          <label className="label">Nombre</label>
          <input type="text" className="input bg-gray-50" value={profile?.full_name ?? ''} disabled />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input bg-gray-50" value={user?.email ?? ''} disabled />
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Teléfono *</label>
            <input
              type="tel"
              className="input"
              placeholder="099 123 456"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSaved(false) }}
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">✓ Datos actualizados.</div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      <ChangePasswordForm />
    </div>
  )
}
