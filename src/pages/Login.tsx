import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ThemeProvider, useStandLogo } from '../core/theme'
import { STORAGE_KEY_LOGO } from '../core/storageKeys'

export default function Login() {
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('returnUrl')
  const { login } = useAuth()
  const [customLogo, setCustomLogo] = useState<string | null>(null)
  const standLogo = useStandLogo()

  // Load custom logo from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOGO)
    if (saved) {
      setCustomLogo(saved)
    }
  }, [])

  const handleLogin = () => {
    login(returnUrl || '/home')
  }

  return (
    <ThemeProvider game={null}>
      <div className="min-h-screen flex items-center justify-center bg-club text-textMain px-6">
        <div className="card w-full max-w-md p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* Logo */}
            {customLogo ? (
              <img 
                src={customLogo} 
                alt="Logo personalizado" 
                className="h-28 w-auto object-contain"
              />
            ) : (
              <img 
                src={standLogo} 
                alt="Stand" 
                className="h-28 w-auto object-contain"
                onError={(e) => {
                  // Fallback to stand-logo.png if logo doesn't exist
                  const target = e.target as HTMLImageElement
                  if (target.src !== `${window.location.origin}/images/stand-logo.png`) {
                    target.src = '/images/stand-logo.png'
                  }
                }}
              />
            )}
            
            {/* Button */}
            <button
              onClick={handleLogin}
              className="w-full p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-all duration-200 hover:border-white/20 font-medium text-textMain"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    </ThemeProvider>
  )
}

