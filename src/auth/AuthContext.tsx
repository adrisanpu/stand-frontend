import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadTokens, clearAuth, isTokenExpired } from './authStorage'

interface AuthContextType {
  isAuthenticated: boolean
  isInitializing: boolean
  accessToken: string | null
  logout: () => void
  setAuth: (token: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const tokens = loadTokens()
    if (tokens) {
      if (!isTokenExpired(tokens.expiresAt)) {
        setIsAuthenticated(true)
        setAccessToken(tokens.accessToken)
      } else {
        clearAuth()
      }
    } else {
      setIsAuthenticated(false)
      setAccessToken(null)
    }
    setIsInitializing(false)
  }, [])

  const logout = useCallback(() => {
    clearAuth()
    setIsAuthenticated(false)
    setAccessToken(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const setAuth = useCallback((token: string) => {
    setIsAuthenticated(true)
    setAccessToken(token)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isInitializing,
        accessToken,
        logout,
        setAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
