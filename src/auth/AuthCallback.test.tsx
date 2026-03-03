import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AuthCallback from './AuthCallback'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockSetAuth = vi.fn()
vi.mock('./AuthContext', () => ({
  useAuth: () => ({ setAuth: mockSetAuth }),
}))

const mockLoadPkceVerifier = vi.fn()
const mockLoadPkceState = vi.fn()
const mockLoadNextPath = vi.fn()
const mockSaveTokens = vi.fn()
const mockClearPkceState = vi.fn()
const mockLoadTokens = vi.fn()

vi.mock('./authStorage', () => ({
  loadPkceVerifier: () => mockLoadPkceVerifier(),
  loadPkceState: () => mockLoadPkceState(),
  loadNextPath: () => mockLoadNextPath(),
  saveTokens: (...args: unknown[]) => mockSaveTokens(...args),
  clearPkceState: () => mockClearPkceState(),
  loadTokens: () => mockLoadTokens(),
}))

vi.mock('../api/api', () => ({
  api: { post: vi.fn().mockResolvedValue({}) },
}))

vi.mock('../core/theme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCallback(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/callback${search}`]}>
      <AuthCallback />
    </MemoryRouter>
  )
}

function mockFetch(ok: boolean, body: object) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadPkceState.mockReturnValue('state123')
    mockLoadPkceVerifier.mockReturnValue('verifier_abc')
    mockLoadNextPath.mockReturnValue('/home')
    mockLoadTokens.mockReturnValue({ idToken: 'id.tok.en' })
    // Default: env vars are undefined so COGNITO_DOMAIN etc. may be undefined.
    // fetch is mocked per test.
  })

  it('shows loading state initially', () => {
    mockFetch(true, { access_token: 'at', id_token: 'it', expires_in: 3600 })
    renderCallback('?code=AUTH_CODE&state=state123')
    expect(screen.getByText(/Completando autenticación/i)).toBeInTheDocument()
  })

  it('shows error when OAuth error param is present', async () => {
    renderCallback('?error=access_denied&error_description=User+cancelled')
    await waitFor(() =>
      expect(screen.getByText(/access_denied/i)).toBeInTheDocument()
    )
  })

  it('shows error when code is missing', async () => {
    renderCallback('?state=state123')
    await waitFor(() =>
      expect(screen.getByText(/Faltan parámetros/i)).toBeInTheDocument()
    )
  })

  it('shows error on state mismatch', async () => {
    mockLoadPkceState.mockReturnValue('expected_state')
    renderCallback('?code=CODE&state=wrong_state')
    await waitFor(() =>
      expect(screen.getByText(/Estado de seguridad inválido/i)).toBeInTheDocument()
    )
  })

  it('shows error when PKCE verifier is missing', async () => {
    mockLoadPkceVerifier.mockReturnValue(null)
    renderCallback('?code=CODE&state=state123')
    await waitFor(() =>
      expect(screen.getByText(/verificador PKCE/i)).toBeInTheDocument()
    )
  })

  it('shows error on token exchange failure', async () => {
    mockFetch(false, { error: 'invalid_grant', error_description: 'Code expired' })
    renderCallback('?code=CODE&state=state123')
    await waitFor(() =>
      expect(screen.getByText(/invalid_grant/i)).toBeInTheDocument()
    )
  })

  it('calls saveTokens and setAuth on success', async () => {
    mockFetch(true, { access_token: 'at', id_token: 'it', expires_in: 3600 })
    renderCallback('?code=CODE&state=state123')
    await waitFor(() => expect(mockSaveTokens).toHaveBeenCalled())
    expect(mockSetAuth).toHaveBeenCalledWith('at')
  })

  it('shows retry button on error', async () => {
    renderCallback('?error=server_error')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /inicio de sesión/i })).toBeInTheDocument()
    )
  })
})
