import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import InactivityGuard from './components/InactivityGuard'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import DoctorSetup from './pages/DoctorSetup'
import SearchDoctors from './pages/SearchDoctors'
import DoctorPublicProfile from './pages/DoctorPublicProfile'
import DoctorDashboard from './pages/DoctorDashboard'
import PatientDashboard from './pages/PatientDashboard'
import PaymentSuccess from './pages/PaymentSuccess'
import PaymentError from './pages/PaymentError'
import PatientProfile from './pages/PatientProfile'
import Admin from './pages/Admin'

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    )
  }

  function getDashboardPath(role?: string) {
    if (role === 'doctor') return '/dashboard/medico'
    if (role === 'patient') return '/dashboard/paciente'
    return '/'
  }

  return (
    <InactivityGuard>
      <Navbar />
      <main className="min-h-screen pt-16">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/login"
            element={user && profile ? <Navigate to={getDashboardPath(profile.role)} replace /> : <Login />}
          />
          <Route
            path="/registro"
            element={user && profile ? <Navigate to={getDashboardPath(profile.role)} replace /> : <Register />}
          />
          <Route path="/buscar" element={<SearchDoctors />} />
          <Route path="/perfil/:id" element={<DoctorPublicProfile />} />
          <Route
            path="/medico/configurar"
            element={
              <ProtectedRoute role="doctor">
                <DoctorSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/medico"
            element={
              <ProtectedRoute role="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/paciente"
            element={
              <ProtectedRoute role="patient">
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil/paciente"
            element={
              <ProtectedRoute role="patient">
                <PatientProfile />
              </ProtectedRoute>
            }
          />
          <Route path="/pago/exito" element={<PaymentSuccess />} />
          <Route path="/pago/error" element={<PaymentError />} />
          <Route path="/pago/pendiente" element={<PaymentSuccess />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </InactivityGuard>
  )
}
