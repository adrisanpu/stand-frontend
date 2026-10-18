import { useState, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import { fetchUserMedia } from '../../api/userMedia'
import { useOperatorLanguage } from './operatorLanguage'
import AppShell from './AppShell'

vi.mock('../../hooks/useOrientation', () => ({ useOrientation: () => true }))
vi.mock('../../auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null, loading: false, plan: 'free' }),
}))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }))
vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
vi.mock('../../api/userMedia', async (original) => ({
  ...await original<typeof import('../../api/userMedia')>(),
  fetchUserMedia: vi.fn(),
}))
vi.mock('../theme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useStandLogo: () => '/stand.png',
}))
vi.mock('../../games', () => ({
  games: [],
  getGameById: () => ({
    id: 'EMPAREJA2', name: 'EMPAREJA2', assets: { logo: '/images/empareja2-logo.png' },
    GameScreen: function StatefulGame() {
      const { t } = useOperatorLanguage()
      const [attempts, setAttempts] = useState(0)
      return <button onClick={() => setAttempts(attempts + 1)}>{t('Intentos', 'Attempts')}: {attempts}</button>
    },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('gameId', 'ABC123')
  localStorage.setItem('gameName', 'MI_EVENTO')
  localStorage.setItem('gameType', 'EMPAREJA2')
  vi.mocked(api.get).mockResolvedValue({
    ok: true, playerCount: 12, validatedCount: 0,
    game: { gameType: 'EMPAREJA2', playMode: 'mobile', joinChannel: 'web' },
  })
  vi.mocked(fetchUserMedia).mockResolvedValue({
    ok: true,
    logo: { items: [], selectedId: null, selected: null, defaults: {} },
  })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('places ES/EN beside close and translates the home without refetching or changing event data', async () => {
  render(<AppShell />)
  await screen.findByText('12')
  expect(screen.getByRole('heading', { name: 'ESCANEA PARA JUGAR.' })).toHaveAttribute('lang', 'es')
  expect(screen.getByText('ESCANEA')).toHaveClass('text-red-500')
  expect(screen.getByText('Jugadores')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Configuración' }))
  const selector = screen.getByRole('combobox', { name: 'Idioma' })
  expect(selector).toHaveValue('es')
  expect(selector.nextElementSibling).toBe(screen.getByRole('button', { name: 'Cerrar configuración' }))
  const requests = vi.mocked(api.get).mock.calls.length
  fireEvent.change(selector, { target: { value: 'en' } })
  expect(screen.getByText('Players')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'SCAN TO PLAY.' })).toHaveAttribute('lang', 'en')
  expect(screen.getByText('SCAN')).toHaveClass('text-red-500')
  expect(screen.getByText('12')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Settings' }).closest('[lang]')).toHaveAttribute('lang', 'en')
  expect(api.get).toHaveBeenCalledTimes(requests)
  expect(localStorage.getItem('gameId')).toBe('ABC123')
  expect(localStorage.getItem('gameName')).toBe('MI_EVENTO')
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en')
  fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'es' } })
  expect(screen.getByText('Jugadores')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'ESCANEA PARA JUGAR.' })).toBeInTheDocument()
})

it('normalizes legacy master access and preserves the mobile Web home while switching language', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true, playerCount: 12,
    game: { gameType: 'EMPAREJA2', playMode: 'master', joinChannel: 'web' },
  })
  render(<AppShell />)
  await screen.findByLabelText('QR de acceso al juego')
  const qr = screen.getByRole('img', { name: 'Escanea para unirte al juego' })
  expect(qr.getAttribute('src')).toContain(encodeURIComponent(`${window.location.origin}/play/ABC123`))
  fireEvent.click(screen.getByRole('button', { name: 'Configuración' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
  expect(screen.getByRole('heading', { name: 'SCAN TO PLAY.' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Scan to join the game' })).toBe(qr)
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
  expect(screen.getByRole('heading', { name: 'SCAN TO PLAY.' })).toBeInTheDocument()
})
