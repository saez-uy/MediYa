import { useState } from 'react'
import { supabase } from '../lib/supabase'

function validatePassword(pw: string): string {
  if (pw.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
  if (!/\d/.test(pw)) return 'La contraseña debe incluir al menos un número.'
  return ''
}

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const pwError = validatePassword(next)
    if (pwError) { setError(pwError); return }
    if (next !== confirm) { setError('Las contraseñas no coinciden.'); return }

    setLoading(true)
    try {
      // Verificar contraseña actual re-autenticando
      const { data: { user } } = await supabase.auth.getUser()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: current,
      })
      if (signInError) throw new Error('La contraseña actual es incorrecta.')

      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) throw updateError

      setSuccess(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card space-y-5">
      <h2 className="text-lg font-semibold text-gray-800">Cambiar contraseña</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Contraseña actual</label>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        <div>
          <label className="label">Nueva contraseña</label>
          <input
            type="password"
            className="input"
            placeholder="Mínimo 6 caracteres con al menos 1 número"
            value={next}
            onChange={(e) => { setNext(e.target.value); setError(''); setSuccess(false) }}
            required
            autoComplete="new-password"
          />
          {next && (
            <div className="mt-1.5 flex gap-3 text-xs">
              <span className={next.length >= 6 ? 'text-green-600' : 'text-gray-400'}>
                {next.length >= 6 ? '✓' : '○'} 6 caracteres
              </span>
              <span className={/\d/.test(next) ? 'text-green-600' : 'text-gray-400'}>
                {/\d/.test(next) ? '✓' : '○'} 1 número
              </span>
            </div>
          )}
        </div>
        <div>
          <label className="label">Confirmar nueva contraseña</label>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); setSuccess(false) }}
            required
            autoComplete="new-password"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            ✓ Contraseña actualizada correctamente.
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  )
}
