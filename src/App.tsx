import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import AppShell from './core/shell/AppShell'
import Login from './pages/Login'
import AuthStart from './auth/AuthStart'
import AuthCallback from './auth/AuthCallback'
import Logout from './auth/Logout'
import BillingSuccess from './pages/BillingSuccess'
import BillingCancel from './pages/BillingCancel'
import BillingCheckout from './pages/BillingCheckout'
import InputDebugOverlay from './core/input/InputDebugOverlay'
import ParticipantShell from './core/participant/ParticipantShell'
import PublicDisplayShell from './core/display/PublicDisplayShell'
import ValidatorShell from './core/validator/ValidatorShell'

function RootRedirect() {
  const { isAuthenticated } = useAuth()
  // Always redirect to login if not authenticated
  // This ensures we don't try to access protected routes without auth
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to="/home" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/start" element={<AuthStart />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/logout" element={<Logout />} />
      <Route path="/billing/checkout" element={<BillingCheckout />} />
      <Route
        path="/billing/success"
        element={
          <ProtectedRoute>
            <BillingSuccess />
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing/cancel"
        element={
          <ProtectedRoute>
            <BillingCancel />
          </ProtectedRoute>
        }
      />
      <Route path="/play/:gameId" element={<ParticipantShell />} />
      <Route path="/display/:gameId" element={<PublicDisplayShell />} />
      <Route path="/redeem/:gameId" element={<ValidatorShell />} />
      <Route
        path="/home/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<RootRedirect />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <InputDebugOverlay />
      </AuthProvider>
    </BrowserRouter>
  )
}
