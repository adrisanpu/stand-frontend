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
        <div className="min-h-screen flex items-center justify-center bg-club text-textMain px-6">
          <div className="card w-full max-w-md p-8 text-center space-y-4">
            <p className="text-red-500">{error}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('/home')}
                className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)]"
              >
                Ir al inicio
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)]"
              >
                Volver a iniciar sesión
              </button>
            </div>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider game={null}>
      <div className="min-h-screen flex items-center justify-center bg-club text-textMain px-6">
        <div className="card w-full max-w-md p-8 text-center">
          <p className="text-textMain">
            {status === 'redirecting' ? 'Redirigiendo al pago...' : 'Completando...'}
          </p>
        </div>
      </div>
    </ThemeProvider>
  )
}
