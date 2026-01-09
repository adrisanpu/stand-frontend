import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/api'
import { clearAuth } from './authStorage'

// Backend returns plan as: "FREE", "EVENT_24H", "ENTERPRISE"
export type BackendPlan = 'FREE' | 'EVENT_24H' | 'ENTERPRISE'
// Frontend uses normalized lowercase plans
export type FrontendPlan = 'free' | 'event' | 'enterprise'

export interface BackendUser {
  userId: string
  email?: string
  plan: BackendPlan
  activeUntil?: string | null
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

export interface User {
  id: string
  email?: string
  plan: FrontendPlan
  activeUntil?: string | null
  createdAt?: string
  updatedAt?: string
  [key: string]: unknown
}

interface UseCurrentUserReturn {
  user: User | null
  plan: FrontendPlan | null
  loading: boolean
  error: Error | null
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const navigate = useNavigate()
  const hasFetched = useRef(false)

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasFetched.current) return
    hasFetched.current = true

    async function fetchUser() {
      try {
        setLoading(true)
        setError(null)

        // API client automatically uses ID token (backend needs 'sub' claim)
        // Backend always returns { user: {...} }
        const data = await api.get<{ user: BackendUser }>('/users')

        if (!data.user) {
          throw new Error('Invalid user data received')
        }

        // Normalize backend user to frontend format
        const backendUser = data.user
        
        // Normalize plan: "FREE" -> "free", "EVENT_24H" -> "event", "ENTERPRISE" -> "enterprise"
        const normalizedPlan: FrontendPlan = 
          backendUser.plan === 'FREE' ? 'free' :
          backendUser.plan === 'EVENT_24H' ? 'event' :
          backendUser.plan === 'ENTERPRISE' ? 'enterprise' :
          'free' // default fallback

        const frontendUser: User = {
          id: backendUser.userId,
          email: backendUser.email,
          plan: normalizedPlan,
          activeUntil: backendUser.activeUntil,
          createdAt: backendUser.createdAt,
          updatedAt: backendUser.updatedAt,
        }

        setUser(frontendUser)
      } catch (err: any) {
        // Handle 401 - unauthorized
        if (err.status === 401 || err.message?.includes('401') || err.message?.includes('Unauthorized')) {
          clearAuth()
          navigate('/login', { replace: true })
          return
        }

        // Handle network/CORS errors - don't redirect, just set error
        if ((err as any).isNetworkError || err.message?.includes('CORS') || err.message?.includes('Failed to fetch') || err.message?.includes('Network error')) {
          console.error('Network/CORS error fetching user:', err)
          setError(new Error('Network error: Check CORS configuration or API availability'))
        } else {
          setError(err instanceof Error ? err : new Error('Failed to fetch user'))
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [navigate])

  return {
    user,
    plan: user?.plan || null,
    loading,
    error,
  }
}

