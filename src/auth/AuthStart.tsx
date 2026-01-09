import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce'
import { savePkceState, clearAuth } from './authStorage'

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI

export default function AuthStart() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const next = searchParams.get('next') || '/app'

  useEffect(() => {
    async function startAuth() {
      // Validate environment variables
      if (!COGNITO_DOMAIN || !CLIENT_ID || !REDIRECT_URI) {
        const missing = []
        if (!COGNITO_DOMAIN) missing.push('VITE_COGNITO_DOMAIN')
        if (!CLIENT_ID) missing.push('VITE_COGNITO_CLIENT_ID')
        if (!REDIRECT_URI) missing.push('VITE_COGNITO_REDIRECT_URI')
        setError(`Faltan variables de entorno: ${missing.join(', ')}`)
        console.error('Missing Cognito environment variables:', missing)
        return
      }

      try {
        // Clear any existing auth state before starting new flow
        // This ensures we start fresh
        clearAuth()

        // Generate PKCE parameters
        const verifier = await generateCodeVerifier()
        const challenge = await generateCodeChallenge(verifier)
        const state = generateState()

        // Save PKCE state to sessionStorage
        savePkceState(verifier, state, next)

        // Build Cognito authorization URL with PKCE
        // Using /oauth2/authorize endpoint (required for PKCE)
        // Scope uses + as separator (URLSearchParams will encode it correctly)
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          scope: 'email openid', // URLSearchParams will encode spaces as +
          code_challenge: challenge,
          code_challenge_method: 'S256',
          state: state,
        })

        const authUrl = `https://${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`

        // Log for debugging
        console.log('Redirecting to Cognito with PKCE:', {
          domain: COGNITO_DOMAIN,
          clientId: CLIENT_ID?.substring(0, 10) + '...',
          redirectUri: REDIRECT_URI,
          authUrl: authUrl,
        })

        // Small delay to ensure state is saved before redirect
        await new Promise(resolve => setTimeout(resolve, 50))

        // Redirect to Cognito immediately
        window.location.href = authUrl
      } catch (error) {
        console.error('Failed to start auth flow:', error)
        setError(error instanceof Error ? error.message : 'Error desconocido al iniciar autenticación')
      }
    }

    startAuth()
  }, [next, navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-club text-textMain">
        <div className="card p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold mb-4 text-red-500">Error de Configuración</h2>
          <p className="text-sm mb-6">{error}</p>
          <div className="text-xs text-textMain/70 mb-6 space-y-2 text-left">
            <p><strong>Verifica en tu .env:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>VITE_COGNITO_DOMAIN</li>
              <li>VITE_COGNITO_CLIENT_ID</li>
              <li>VITE_COGNITO_REDIRECT_URI</li>
            </ul>
            <p className="mt-4"><strong>En Cognito, verifica:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>El redirect_uri debe coincidir EXACTAMENTE</li>
              <li>Authorization code grant está habilitado</li>
              <li>PKCE está habilitado (si aplica)</li>
            </ul>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p>Redirigiendo a inicio de sesión...</p>
      </div>
    </div>
  )
}

