import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<UserRole | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleRoleSelect(r: UserRole) {
    setRole(r)
    setStep(2)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) return
    setError('')
    setLoading(true)
    try {
      await signUp({ email, password, full_name: fullName, phone, role })
      if (role === 'doctor') navigate('/medico/configurar')
      else navigate('/buscar')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-gray-500 mt-2">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Ingresá
            </Link>
          </p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-center text-gray-600 mb-6 font-medium">¿Cómo vas a usar MediYa?</p>
            <button
              onClick={() => handleRoleSelect('patient')}
              className="card w-full text-left hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
                  🏥
                </div>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-primary-700">Soy paciente</p>
                  <p className="text-gray-500 text-sm">Quiero encontrar y contactar médicos</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => handleRoleSelect('doctor')}
              className="card w-full text-left hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-2xl">
                  👨‍⚕️
                </div>
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-primary-700">Soy médico</p>
                  <p className="text-gray-500 text-sm">Quiero ofrecer mis servicios a pacientes</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {step === 2 && role && (
          <div className="card">
            <button
              onClick={() => setStep(1)}
              className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1 mb-5"
            >
              ← Volver
            </button>

            <div className="flex items-center gap-3 mb-6 p-3 bg-primary-50 rounded-lg">
              <span className="text-2xl">{role === 'doctor' ? '👨‍⚕️' : '🏥'}</span>
              <div>
                <p className="font-medium text-primary-800">
                  {role === 'doctor' ? 'Registrarme como médico' : 'Registrarme como paciente'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Nombre completo</label>
                <input
                  type="text"
                  className="input"
                  placeholder={role === 'doctor' ? 'Dr. Juan Pérez' : 'María García'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label">Teléfono *</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="099 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Contraseña</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
