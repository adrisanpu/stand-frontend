import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ThemeProvider } from '../core/theme'

const STORAGE_KEY_LOGO = 'app_custom_logo'

export default function Login() {
  const { login } = useAuth()
  const [customLogo, setCustomLogo] = useState<string | null>(null)

  // Load custom logo from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOGO)
    if (saved) {
      setCustomLogo(saved)
    }
  }, [])

  const handleLogin = () => {
    login('/app')
  }

  return (
    <ThemeProvider game={null}>
      <div className="min-h-screen flex items-center justify-center bg-club text-textMain px-6">
        <div className="card w-full max-w-md p-8">
        {/* Header with Logo */}
        <div className="flex flex-col items-center mb-8">
          {/* Custom logo or Stand Letters Logo */}
          {customLogo ? (
            <img 
              src={customLogo} 
              alt="Logo personalizado" 
              className="h-20 w-auto object-contain"
            />
          ) : (
            <img 
              src="/logo_stand_letters.png" 
              alt="Stand" 
              className="h-20 w-auto object-contain"
              onError={(e) => {
                // Fallback to stand-logo.png if logo_stand_letters.png doesn't exist
                const target = e.target as HTMLImageElement
                if (target.src !== `${window.location.origin}/stand-logo.png`) {
                  target.src = '/stand-logo.png'
                }
              }}
            />
          )}
        </div>

        {/* Login Content */}
        <div className="space-y-6 text-center">
          <div>
            <h1 className="text-xl font-semibold text-textMain mb-2">Iniciar Sesión</h1>
            <p className="text-sm text-textSub">No necesitas tarjeta</p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-all duration-200 hover:border-white/20 font-medium text-textMain"
          >
            Continuar
          </button>
        </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

