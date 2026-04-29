import { useNavigate } from 'react-router-dom'

export default function PaymentError() {
  const navigate = useNavigate()
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="card max-w-md w-full text-center py-10">
        <p className="text-5xl mb-4">❌</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">El pago no se completó</h1>
        <p className="text-gray-500 mb-6">Podés intentarlo de nuevo cuando quieras.</p>
        <button onClick={() => navigate('/medico/configurar')} className="btn-primary">
          Volver e intentar de nuevo
        </button>
      </div>
    </div>
  )
}
