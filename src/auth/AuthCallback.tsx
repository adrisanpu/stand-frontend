import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import {
  loadPkceVerifier,
  loadPkceState,
  loadNextPath,
  saveTokens,
  clearPkceState,
  loadTokens,
} from './authStorage'
import { api } from '../api/api'
import { ThemeProvider } from '../core/theme'

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export default function AuthCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const hasProcessed = useRef(false)

  useEffect(() => {
    // Prevent double execution in React StrictMode
    if (hasProcessed.current) return
    hasProcessed.current = true

    async function handleCallback() {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const errorParam = searchParams.get('error')

      // Check for OAuth error
      if (errorParam) {
        const errorDesc = searchParams.get('error_description') || ''
        const fullError = errorDesc 
          ? `${errorParam}: ${errorDesc}` 
          : errorParam
        setError(`Error de autenticación: ${fullError}`)
        console.error('OAuth error from Cognito:', {
          error: errorParam,
          description: errorDesc,
          state: state,
        })
        return
      }

      // Validate required parameters
      if (!code) {
        setError('Faltan parámetros de autenticación')
        return
      }

      // Validate state (CSRF protection)
      const savedState = loadPkceState()
      if (state && savedState && state !== savedState) {
        setError('Estado de seguridad inválido')
        console.error('State mismatch:', { received: state, saved: savedState })
        return
      }

      // Get PKCE verifier
      const verifier = loadPkceVerifier()
      if (!verifier) {
        setError('No se encontró el verificador PKCE')
        return
      }

      // Get next path
      const next = loadNextPath() || '/home'

      try {
        // Exchange code for tokens with PKCE
        const tokenUrl = `https://${COGNITO_DOMAIN}/oauth2/token`
        
        // Ensure redirect_uri matches exactly (including protocol, port, path)
        const redirectUri = REDIRECT_URI!
        
        const tokenBody = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: CLIENT_ID!,
          code: code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        })

        console.log('Exchanging code for tokens:', {
          tokenUrl,
          clientId: CLIENT_ID?.substring(0, 10) + '...',
          redirectUri: redirectUri,
          codeLength: code.length,
        })

        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenBody,
        })

        if (!tokenResponse.ok) {
          let errorData: any
          try {
            errorData = await tokenResponse.json()
          } catch {
            errorData = await tokenResponse.text()
          }
          
          const errorMessage = typeof errorData === 'string' 
            ? errorData 
            : errorData.error_description || errorData.error || JSON.stringify(errorData)
          
          console.error('Token exchange error:', {
            status: tokenResponse.status,
            statusText: tokenResponse.statusText,
            error: errorData,
            url: tokenUrl,
            redirectUri: redirectUri,
            requestBody: Object.fromEntries(tokenBody),
          })
          
          // Clear state on error
          clearPkceState()
          
          // Provide more helpful error message
          if (errorData?.error === 'invalid_grant') {
            throw new Error(
              `invalid_grant: El código de autorización es inválido o expiró. ` +
              `Verifica que el redirect_uri coincida exactamente: ${redirectUri}`
            )
          }
          
          throw new Error(`Token exchange failed (${tokenResponse.status}): ${errorMessage}`)
        }

        const tokenData = await tokenResponse.json()
        const { access_token, id_token, expires_in } = tokenData

        if (!access_token || !id_token) {
          throw new Error('Tokens no recibidos')
        }

        // Calculate expiration time
        const expiresAt = Math.floor(Date.now() / 1000) + expires_in

        // Save tokens
        saveTokens({
          accessToken: access_token,
          idToken: id_token,
          expiresAt,
        })

        // Update auth context
        setAuth(access_token)

        // Clear PKCE state
        clearPkceState()

        // Call backend bootstrap endpoint (non-blocking)
        // Only call if API_BASE_URL is configured
        if (API_BASE_URL) {
          // Verify token is saved before making API call
          const savedTokens = loadTokens()
          if (savedTokens?.idToken) {
            console.log('Calling bootstrap endpoint with ID token:', {
              apiBaseUrl: API_BASE_URL,
              tokenPreview: savedTokens.idToken.substring(0, 30) + '...',
            })
            // Don't await - let it run in background
            // API client automatically uses ID token
            api.post('/users', {}).catch((err) => {
              // Log only, don't block navigation
              console.error('Bootstrap call failed (non-blocking):', err)
            })
          } else {
            console.warn('Bootstrap skipped: ID token not found in storage')
          }
        }

        // Redirect to next path immediately
        navigate(next, { replace: true })
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err instanceof Error ? err.message : 'Error desconocido')
        hasProcessed.current = false // Allow retry on error
      }
    }

    handleCallback()
  }, [searchParams, navigate, setAuth])

  if (error) {
    return (
      <ThemeProvider game={null}>
        <div className="min-h-screen flex items-center justify-center bg-club text-textMain px-6">
          <div className="card w-full max-w-md p-8 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Volver a inicio de sesión
            </button>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider game={null}>
      <div className="min-h-screen flex items-center justify-center bg-club text-textMain px-6">
        <div className="card w-full max-w-md p-8 text-center">
          <p className="text-textMain">Completando autenticación...</p>
        </div>
      </div>
    </ThemeProvider>
  )
}

