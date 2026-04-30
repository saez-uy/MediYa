import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Navbar() {
  const { user, profile, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-xl font-bold text-primary-700">MediYa <span className="text-xs font-normal text-gray-400">v2.1</span></span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          <Link to="/buscar" className="btn-ghost text-sm">
            Buscar médicos
          </Link>
          {!loading && !user && (
            <>
              <Link to="/login" className="btn-ghost text-sm">
                Ingresar
              </Link>
              <Link to="/registro" className="btn-primary text-sm">
                Registrarse
              </Link>
            </>
          )}
          {!loading && user && profile?.role === 'doctor' && (
            <>
              <Link to="/dashboard/medico" className="btn-ghost text-sm">
                Mi agenda
              </Link>
              <Link to="/medico/configurar" className="btn-ghost text-sm">
                Mi perfil
              </Link>
              <button onClick={handleSignOut} className="btn-ghost text-sm">
                Salir
              </button>
            </>
          )}
          {!loading && user && profile?.role === 'patient' && (
            <>
              <Link to="/dashboard/paciente" className="btn-ghost text-sm">
                Mis turnos
              </Link>
              <button onClick={handleSignOut} className="btn-ghost text-sm">
                Salir
              </button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <div className="w-5 h-0.5 bg-gray-600 mb-1" />
          <div className="w-5 h-0.5 bg-gray-600 mb-1" />
          <div className="w-5 h-0.5 bg-gray-600" />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 flex flex-col gap-2">
          <Link to="/buscar" className="btn-ghost text-sm text-left" onClick={() => setMenuOpen(false)}>
            Buscar médicos
          </Link>
          {!loading && !user && (
            <>
              <Link to="/login" className="btn-ghost text-sm text-left" onClick={() => setMenuOpen(false)}>
                Ingresar
              </Link>
              <Link to="/registro" className="btn-primary text-sm" onClick={() => setMenuOpen(false)}>
                Registrarse
              </Link>
            </>
          )}
          {!loading && user && profile?.role === 'doctor' && (
            <>
              <Link to="/dashboard/medico" className="btn-ghost text-sm text-left" onClick={() => setMenuOpen(false)}>
                Mi agenda
              </Link>
              <Link to="/medico/configurar" className="btn-ghost text-sm text-left" onClick={() => setMenuOpen(false)}>
                Mi perfil
              </Link>
              <button onClick={() => { handleSignOut(); setMenuOpen(false) }} className="btn-ghost text-sm text-left">
                Salir
              </button>
            </>
          )}
          {!loading && user && profile?.role === 'patient' && (
            <>
              <Link to="/dashboard/paciente" className="btn-ghost text-sm text-left" onClick={() => setMenuOpen(false)}>
                Mis turnos
              </Link>
              <button onClick={() => { handleSignOut(); setMenuOpen(false) }} className="btn-ghost text-sm text-left">
                Salir
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
