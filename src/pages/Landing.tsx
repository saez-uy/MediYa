import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Landing() {
  const { user, profile } = useAuth()

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-700 to-primary-500 text-white">
        <div className="max-w-5xl mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Tu médico,<br />
            <span className="text-primary-200">a domicilio</span>
          </h1>
          <p className="text-lg md:text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
            Conectamos pacientes con médicos de confianza en Uruguay.
            Encontrá el especialista que necesitás, en tu barrio, cuando lo necesitás.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/buscar"
              className="bg-white text-primary-700 font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-50 transition-colors text-lg"
            >
              Buscar médico
            </Link>
            {!user && (
              <Link
                to="/registro"
                className="border-2 border-white text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-600 transition-colors text-lg"
              >
                Soy médico
              </Link>
            )}
            {user && profile?.role === 'doctor' && (
              <Link
                to="/dashboard/medico"
                className="border-2 border-white text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-600 transition-colors text-lg"
              >
                Ver mi agenda
              </Link>
            )}
            {user && profile?.role === 'patient' && (
              <Link
                to="/dashboard/paciente"
                className="border-2 border-white text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-primary-600 transition-colors text-lg"
              >
                Mis turnos
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">¿Cómo funciona?</h2>
          <p className="text-gray-500 text-center mb-14 max-w-xl mx-auto">
            En pocos pasos conectamos al paciente con el médico ideal.
          </p>
          <div className="grid md:grid-cols-3 gap-10">
            <Step
              number="1"
              title="Buscá tu médico"
              description="Filtrá por especialidad y zona. Encontrá al profesional que mejor se adapte a tu situación."
            />
            <Step
              number="2"
              title="Pedí un turno"
              description="Seleccioná la fecha y hora que mejor te convenga y enviá tu solicitud directamente al médico."
            />
            <Step
              number="3"
              title="El médico te confirma"
              description="El médico revisa tu solicitud, la acepta y se ponen en contacto para coordinar la consulta."
            />
          </div>
        </div>
      </section>

      {/* For doctors */}
      <section className="py-20 bg-primary-50">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">¿Sos médico?</h2>
            <p className="text-gray-600 mb-6 text-lg">
              Creá tu perfil, indicá tu especialidad, las zonas donde trabajás y tu horario disponible.
              Los pacientes de tu zona van a poder encontrarte y solicitar consulta directamente.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                'Sin cuotas ni comisiones',
                'Manejás tu propia agenda',
                'Solo contactos de tu zona',
                'Plataforma 100% gratuita',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-gray-700">
                  <span className="w-5 h-5 bg-primary-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">✓</span>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            {!user && (
              <Link to="/registro" className="btn-primary">
                Registrarme como médico
              </Link>
            )}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            {['Medicina General', 'Pediatría', 'Cardiología', 'Dermatología', 'Neurología', 'Psicología'].map(
              (spec) => (
                <div key={spec} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <p className="text-gray-700 font-medium text-sm">{spec}</p>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Contacto</h2>
          <p className="text-gray-500 mb-10">
            ¿Tenés alguna consulta o necesitás ayuda? Escribinos o llamanos.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <a
              href="mailto:saez-uy@gmail.com"
              className="flex items-center justify-center gap-3 bg-primary-50 border border-primary-100 rounded-xl px-8 py-5 hover:bg-primary-100 transition-colors group"
            >
              <span className="text-2xl">✉️</span>
              <div className="text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Email</p>
                <p className="text-primary-700 font-semibold group-hover:underline">saez-uy@gmail.com</p>
              </div>
            </a>
            <a
              href="tel:099987987"
              className="flex items-center justify-center gap-3 bg-primary-50 border border-primary-100 rounded-xl px-8 py-5 hover:bg-primary-100 transition-colors group"
            >
              <span className="text-2xl">📞</span>
              <div className="text-left">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Teléfono</p>
                <p className="text-primary-700 font-semibold group-hover:underline">099 987 987</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 text-center">
        <p className="text-lg font-semibold text-white mb-1">MediYa</p>
        <p className="text-sm">Médicos a tu alcance en Uruguay</p>
      </footer>
    </div>
  )
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-full bg-primary-600 text-white text-xl font-bold flex items-center justify-center mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500">{description}</p>
    </div>
  )
}
