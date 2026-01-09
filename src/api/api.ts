/**
 * API client with automatic Bearer token attachment
 */

import { getIdToken } from '../auth/authStorage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

interface ApiOptions extends RequestInit {
  token?: string | null
}

async function request<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options
  
  // Always use ID token for API Gateway requests (backend needs 'sub' claim)
  const authToken = getIdToken()

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  // Only add Authorization header for non-OPTIONS requests
  // OPTIONS (preflight) requests should not include Authorization
  // The browser sends OPTIONS automatically, and we shouldn't add auth to them
  if (authToken && fetchOptions.method !== 'OPTIONS') {
    headers['Authorization'] = `Bearer ${authToken}`
    console.log('API request with token:', {
      url,
      method: fetchOptions.method || 'GET',
      tokenPreview: authToken.substring(0, 20) + '...',
      tokenLength: authToken.length,
    })
  } else if (!authToken) {
    console.warn('API request without token:', { url, method: fetchOptions.method || 'GET' })
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    })
  } catch (networkError) {
    // Handle network errors (CORS, connection refused, etc.)
    const error = new Error(`Network error: ${networkError instanceof Error ? networkError.message : 'Failed to fetch'}`)
    ;(error as any).isNetworkError = true
    throw error
  }

  if (!response.ok) {
    let errorText: string
    try {
      const errorJson = await response.json()
      errorText = JSON.stringify(errorJson)
    } catch {
      errorText = await response.text()
    }
    
    // Log full request details for debugging
    console.error('API request failed:', {
      url,
      method: fetchOptions.method || 'GET',
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      hasToken: !!authToken,
      tokenPreview: authToken ? authToken.substring(0, 30) + '...' : null,
      requestHeaders: Object.keys(headers),
      responseHeaders: Object.fromEntries(response.headers.entries()),
    })
    
    // Include status code in error for 401 handling
    const error = new Error(`API error: ${response.status} ${errorText}`)
    ;(error as any).status = response.status
    throw error
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return response.json()
  }

  return response.text() as unknown as T
}

export const api = {
  get: <T>(endpoint: string, token?: string | null) =>
    request<T>(endpoint, { method: 'GET', token }),

  post: <T>(endpoint: string, data?: unknown, token?: string | null) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      token,
    }),

  put: <T>(endpoint: string, data?: unknown, token?: string | null) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      token,
    }),

  delete: <T>(endpoint: string, data?: unknown, token?: string | null) =>
    request<T>(endpoint, {
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
      token,
    }),
}

