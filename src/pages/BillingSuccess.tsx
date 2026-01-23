import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../auth/useCurrentUser'
import { api } from '../api/api'
import type { BackendUser } from '../auth/useCurrentUser'
import { ThemeProvider } from '../core/theme'

export default function BillingSuccess() {
  const navigate = useNavigate()
  const { plan: initialPlan, loading: initialLoading } = useCurrentUser()
  const [refreshing, setRefreshing] = useState(true)
  const [plan, setPlan] = useState<string | null>(initialPlan)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Refresh user data to get updated plan
    const refreshUser = async () => {
      try {
        setRefreshing(true)
        const data = await api.get<{ user: BackendUser }>('/v1/user/me')
        if (data.user) {
          // Normalize plan
          const normalizedPlan = 
            data.user.plan === 'FREE' ? 'free' :
            data.user.plan === 'EVENT_24H' ? 'event' :
            data.user.plan === 'ENTERPRISE' ? 'enterprise' :
            'free'
          setPlan(normalizedPlan)
        }
      } catch (err: any) {
        console.error('Error refreshing user:', err)
        setError(err instanceof Error ? err : new Error('Error al actualizar el plan'))
      } finally {
        setRefreshing(false)
      }
    }

    // Wait a bit for Stripe to process, then refresh
    const timer = setTimeout(() => {
      refreshUser()
    }, 1500)

    return () => clearTimeout(timer)
  }, [])

  const planLabels: Record<string, string> = {
    free: 'Gratis',
    event: 'Evento 24h',
    enterprise: 'Enterprise'
  }

  return (
    <ThemeProvider game={null}>
      <div className="min-h-screen flex items-center justify-center bg-club text-textMain px-6">
        <div className="card w-full max-w-md p-8 text-center">
        {refreshing || initialLoading ? (
          <>
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-green-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Procesando pago...</h1>
            <p className="text-textSub">Actualizando tu plan</p>
          </>
        ) : error ? (
          <>
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-red-400">Error</h1>
            <p className="text-textSub mb-6">{error.message}</p>
            <button
              onClick={() => navigate('/home')}
              className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              Volver a la aplicación
            </button>
          </>
        ) : (
          <>
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">¡Pago exitoso!</h1>
            <p className="text-textSub mb-6">
              Tu plan ha sido actualizado a: <span className="font-semibold text-textMain">{planLabels[plan || 'free'] || plan?.toUpperCase()}</span>
            </p>
            <button
              onClick={() => navigate('/home')}
              className="w-full p-3 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors font-medium"
            >
              Continuar
            </button>
          </>
        )}
        </div>
      </div>
    </ThemeProvider>
  )
}

