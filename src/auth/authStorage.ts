/**
 * Session storage for auth tokens (idToken used by api.ts).
 */

const STORAGE_KEY_TOKENS = 'stand_tokens'

export interface AuthTokens {
  accessToken: string
  idToken: string
  expiresAt: number
}

export function saveTokens(tokens: AuthTokens): void {
  sessionStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens))
}

export function loadTokens(): AuthTokens | null {
  const tokensJson = sessionStorage.getItem(STORAGE_KEY_TOKENS)
  if (!tokensJson) return null

  try {
    const tokens = JSON.parse(tokensJson) as AuthTokens
    if (!tokens.accessToken || !tokens.idToken || !tokens.expiresAt) return null
    return tokens
  } catch {
    return null
  }
}

export function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt * 1000
}

export function clearAuth(): void {
  sessionStorage.removeItem(STORAGE_KEY_TOKENS)
}

export function getAccessToken(): string | null {
  return loadTokens()?.accessToken || null
}

export function getIdToken(): string | null {
  return loadTokens()?.idToken || null
}
