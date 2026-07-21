import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import AppShell from './core/shell/AppShell'
import Login from './pages/Login'
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
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <Navigate to="/home" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
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
