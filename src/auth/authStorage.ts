/**
 * Session storage utilities for auth tokens and PKCE state
 */

const STORAGE_KEY_TOKENS = 'stand_tokens'
const STORAGE_KEYS = {
  PKCE_VERIFIER: 'auth_pkce_verifier',
  PKCE_STATE: 'auth_pkce_state',
  NEXT_PATH: 'auth_next_path',
} as const

export interface AuthTokens {
  accessToken: string
  idToken: string
  expiresAt: number
}

/**
 * Save tokens to sessionStorage under "stand_tokens"
 */
export function saveTokens(tokens: AuthTokens): void {
  sessionStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens))
}

/**
 * Load tokens from sessionStorage
 */
export function loadTokens(): AuthTokens | null {
  const tokensJson = sessionStorage.getItem(STORAGE_KEY_TOKENS)
  if (!tokensJson) {
    return null
  }

  try {
    const tokens = JSON.parse(tokensJson) as AuthTokens
    if (!tokens.accessToken || !tokens.idToken || !tokens.expiresAt) {
      return null
    }
    return tokens
  } catch {
    return null
  }
}

/**
 * Check if tokens are expired
 */
export function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt * 1000
}

/**
 * Clear all auth data from sessionStorage
 */
export function clearAuth(): void {
  sessionStorage.removeItem(STORAGE_KEY_TOKENS)
  sessionStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER)
  sessionStorage.removeItem(STORAGE_KEYS.PKCE_STATE)
  sessionStorage.removeItem(STORAGE_KEYS.NEXT_PATH)
}

/**
 * Save PKCE state (verifier, state, next path)
 */
export function savePkceState(verifier: string, state: string, next: string): void {
  sessionStorage.setItem(STORAGE_KEYS.PKCE_VERIFIER, verifier)
  sessionStorage.setItem(STORAGE_KEYS.PKCE_STATE, state)
  sessionStorage.setItem(STORAGE_KEYS.NEXT_PATH, next)
}

/**
 * Load PKCE verifier
 */
export function loadPkceVerifier(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.PKCE_VERIFIER)
}

/**
 * Load PKCE state
 */
export function loadPkceState(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.PKCE_STATE)
}

/**
 * Load next path
 */
export function loadNextPath(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.NEXT_PATH)
}

/**
 * Clear PKCE state
 */
export function clearPkceState(): void {
  sessionStorage.removeItem(STORAGE_KEYS.PKCE_VERIFIER)
  sessionStorage.removeItem(STORAGE_KEYS.PKCE_STATE)
  sessionStorage.removeItem(STORAGE_KEYS.NEXT_PATH)
}

/**
 * Get access token from sessionStorage
 */
export function getAccessToken(): string | null {
  const tokens = loadTokens()
  return tokens?.accessToken || null
}

/**
 * Get ID token from sessionStorage
 */
export function getIdToken(): string | null {
  const tokens = loadTokens()
  return tokens?.idToken || null
}

