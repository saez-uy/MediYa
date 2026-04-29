import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function PaymentSuccess() {
  const [status, setStatus] = useState<'checking' | 'active' | 'pending'>('checking')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const doctorId = params.get('external_reference')
  const paymentId = params.get('payment_id') ?? params.get('collection_id')

  useEffect(() => {
    if (!doctorId) { navigate('/'); return }
    activateAndCheck()
  }, [])

  async function activateAndCheck() {
    // If we have the payment_id from MP redirect, verify directly without waiting for webhook
    if (paymentId) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await supabase.functions.invoke('mp-webhook', {
          body: { payment_id: paymentId },
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
        })
      } catch {
        // Ignore errors - we still poll below
      }
    }

    // Poll until is_active = true (up to 15 seconds)
    let attempts = 0
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('doctor_profiles')
        .select('is_active')
        .eq('id', doctorId)
        .single()

      if (data?.is_active) {
        clearInterval(interval)
        setStatus('active')
        setTimeout(() => navigate('/dashboard/medico'), 2000)
        return
      }

      if (++attempts >= 8) {
        clearInterval(interval)
        setStatus('pending')
      }
    }, 2000)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center py-10">
        {status === 'checking' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Verificando pago...</h1>
            <p className="text-gray-500">Aguardá un momento mientras activamos tu cuenta.</p>
          </>
        )}
        {status === 'active' && (
          <>
            <p className="text-5xl mb-4">✅</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">¡Pago recibido!</h1>
            <p className="text-gray-500">Tu cuenta está activa. Redirigiendo a tu agenda...</p>
          </>
        )}
        {status === 'pending' && (
          <>
            <p className="text-5xl mb-4">⏳</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Pago en proceso</h1>
            <p className="text-gray-500 mb-6">
              Tu pago fue recibido y está siendo procesado. Tu cuenta se activará en breve.
              Podés acceder a tu agenda y esperar la confirmación.
            </p>
            <button onClick={() => navigate('/dashboard/medico')} className="btn-primary">
              Ir a mi agenda
            </button>
          </>
        )}
      </div>
    </div>
  )
}
