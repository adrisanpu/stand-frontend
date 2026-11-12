import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { api } from '../api/api'
import { ThemeProvider } from '../core/theme'

type CheckoutResponse = {
  ok: boolean
  checkoutUrl?: string
  sessionId?: string
  alreadyActive?: boolean
  user?: { userId: string; plan: string; activeUntil?: string }
}

export default function BillingCheckout() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'redirecting' | 'done'>('idle')

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false

    async function startCheckout() {
      setStatus('redirecting')
      try {
        const data = await api.post<CheckoutResponse>('/v1/billing/checkout', {})
        if (cancelled) return
        if (data.alreadyActive) {
          setStatus('done')
          navigate('/home', { replace: true })
          return
        }
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl
          return
        }
        throw new Error('No se recibió URL de pago')
      } catch (err: unknown) {
        if (cancelled) return
        setStatus('done')
        const message = err instanceof Error ? err.message : 'Error al iniciar el pago. Por favor, intenta de nuevo.'
        setError(message)
        console.error('Checkout error:', err)
      }
    }

    startCheckout()
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) {
    return (
      <Navigate
        to={'/login?returnUrl=' + encodeURIComponent('/billing/checkout')}
        replace
      />
    )
  }

  if (error) {
    return (
      <ThemeProvider game={null}>
        <main className="auth-shell billing-shell">
          <div className="auth-card auth-status-card space-y-4 text-center">
            <p role="alert" className="text-red-700">{error}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/home')}
                className="auth-submit w-full p-3 font-semibold"
              >
                Ir al inicio
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full border border-[#C6D1CC] p-3 font-semibold text-[#152F3A] hover:bg-[#F0F3EF]"
              >
                Volver a iniciar sesión
              </button>
            </div>
          </div>
        </main>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider game={null}>
      <main className="auth-shell billing-shell">
        <div className="auth-card auth-status-card text-center">
          <p role="status" className="text-textMain">
            {status === 'redirecting' ? 'Redirigiendo al pago...' : 'Completando...'}
          </p>
        </div>
      </main>
    </ThemeProvider>
  )
}
