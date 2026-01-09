import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAuth } from './authStorage'

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const LOGOUT_URI = import.meta.env.VITE_COGNITO_LOGOUT_URI

export default function Logout() {
  const navigate = useNavigate()

  useEffect(() => {
    // Clear local auth state
    clearAuth()

    // Build Cognito logout URL
    if (COGNITO_DOMAIN && CLIENT_ID && LOGOUT_URI) {
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        logout_uri: LOGOUT_URI,
      })
      const logoutUrl = `https://${COGNITO_DOMAIN}/logout?${params.toString()}`
      
      // Redirect to Cognito logout
      window.location.href = logoutUrl
    } else {
      // If no Cognito config, just redirect to login
      navigate('/login', { replace: true })
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p>Cerrando sesión...</p>
      </div>
    </div>
  )
}

