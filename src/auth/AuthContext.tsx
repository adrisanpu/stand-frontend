import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadTokens, clearAuth, isTokenExpired } from './authStorage'

interface AuthContextType {
  isAuthenticated: boolean
  isInitializing: boolean
  accessToken: string | null
  login: (nextPath?: string) => void
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

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const tokens = loadTokens()
    if (tokens) {
      if (!isTokenExpired(tokens.expiresAt)) {
        setIsAuthenticated(true)
        setAccessToken(tokens.accessToken)
      } else {
        // Clear expired tokens
        console.log('Tokens expired, clearing auth')
        clearAuth()
      }
    } else {
      // No tokens found, ensure clean state
      setIsAuthenticated(false)
      setAccessToken(null)
    }
    setIsInitializing(false)
  }, [])

  const login = useCallback((nextPath: string = '/home') => {
    navigate(`/auth/start?next=${encodeURIComponent(nextPath)}`)
  }, [navigate])

  const logout = useCallback(() => {
    clearAuth()
    setIsAuthenticated(false)
    setAccessToken(null)
    navigate('/logout')
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
        login,
        logout,
        setAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
