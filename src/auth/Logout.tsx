import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAuth } from './authStorage'

/** Legacy route: clear session and land on in-app login. */
export default function Logout() {
  const navigate = useNavigate()

  useEffect(() => {
    clearAuth()
    navigate('/login', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p>Cerrando sesión...</p>
      </div>
    </div>
  )
}
