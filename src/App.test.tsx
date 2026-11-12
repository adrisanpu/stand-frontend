import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { signIn } from './auth/cognitoClient'
import App from './App'

const state = vi.hoisted(() => ({ authenticated: false, initializing: false }))
vi.mock('./auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    isAuthenticated: state.authenticated,
    isInitializing: state.initializing,
    setAuth: () => { state.authenticated = true },
  }),
}))
vi.mock('./auth/cognitoClient', async original => ({
  ...await original<typeof import('./auth/cognitoClient')>(),
  signIn: vi.fn(),
}))
vi.mock('./api/api', () => ({ api: { post: vi.fn().mockResolvedValue({}) } }))
vi.mock('./core/admin/AdminShell', () => ({ default: () => <p>ADMIN PAGE</p> }))
vi.mock('./core/admin/GameHomeEntry', () => ({ default: () => <p>OPERATIONAL HOME</p> }))
vi.mock('./core/input/InputDebugOverlay', () => ({ default: () => null }))
vi.mock('./core/participant/ParticipantShell', () => ({ default: () => <p>PUBLIC PLAYER</p> }))
vi.mock('./core/validator/ValidatorShell', () => ({ default: () => <p>PUBLIC REDEMPTION</p> }))
vi.mock('./pages/BillingCheckout', () => ({ default: () => <p>CHECKOUT</p> }))

beforeEach(() => {
  vi.clearAllMocks()
  state.authenticated = false
  state.initializing = false
  sessionStorage.clear()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  vi.mocked(signIn).mockResolvedValue({
    kind: 'tokens',
    tokens: { accessToken: 'access', idToken: 'id', expiresIn: 3600 },
  })
})
afterEach(cleanup)

it('sends authenticated root access to administration', async () => {
  state.authenticated = true
  render(<App />)
  expect(await screen.findByText('ADMIN PAGE')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/admin/games')
})

it.each(['/admin/games', '/admin/integrations', '/home?gameId=NEW'])('protects %s', async path => {
  window.history.replaceState({}, '', path)
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument()
  expect(screen.queryByText('ADMIN PAGE')).not.toBeInTheDocument()
  expect(screen.queryByText('OPERATIONAL HOME')).not.toBeInTheDocument()
})

it('opens administration after a normal sign-in', async () => {
  window.history.replaceState({}, '', '/login')
  render(<App />)
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.test' } })
  fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'test-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  expect(await screen.findByText('ADMIN PAGE')).toBeInTheDocument()
  expect(window.location.pathname).toBe('/admin/games')
})

it('preserves explicit checkout return URLs after sign-in', async () => {
  window.history.replaceState({}, '', '/login?returnUrl=%2Fbilling%2Fcheckout')
  render(<App />)
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.test' } })
  fireEvent.change(screen.getByPlaceholderText('Contraseña'), { target: { value: 'test-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
  expect(await screen.findByText('CHECKOUT')).toBeInTheDocument()
})

it.each([
  ['/play/NEW', 'PUBLIC PLAYER'],
  ['/redeem/NEW', 'PUBLIC REDEMPTION'],
])('keeps %s public', async (path, text) => {
  window.history.replaceState({}, '', path)
  render(<App />)
  expect(await screen.findByText(text)).toBeInTheDocument()
})
