import { useNavigate } from 'react-router-dom'
import { ThemeProvider } from '../core/theme'

export default function BillingCancel() {
  const navigate = useNavigate()

  return (
    <ThemeProvider game={null}>
      <div className="min-h-screen flex items-center justify-center bg-club text-textMain px-6">
        <div className="card w-full max-w-md p-8 text-center">
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Pago cancelado</h1>
        <p className="text-textSub mb-6">
          No se ha realizado ningún cargo. Puedes intentar de nuevo cuando estés listo.
        </p>
        <button
          onClick={() => navigate('/home')}
          className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors font-medium"
        >
          Volver a la aplicación
        </button>
        </div>
      </div>
    </ThemeProvider>
  )
}

