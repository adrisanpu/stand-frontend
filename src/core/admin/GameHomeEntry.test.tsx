import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { api } from '../../api/api'
import type { OperatorGame } from '../../api/operatorGames'
import GameHomeEntry from './GameHomeEntry'

vi.mock('../../api/api', () => ({ api: { get: vi.fn() } }))
vi.mock('../shell/AppShell', () => ({
  default: ({ initialGame, onReturnToAdmin }: { initialGame?: OperatorGame; onReturnToAdmin: () => void }) =>
    <div><p>Home: {initialGame?.gameId ?? 'legacy'}</p><button onClick={onReturnToAdmin}>Volver</button></div>,
}))
const game = { gameId: 'NEW', gameName: 'NEW_EVENT', gameType: 'STACK' }
function mount(path = '/home?gameId=NEW') {
  render(<MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/home" element={<GameHomeEntry />} />
      <Route path="/admin/games" element={<p>Mis partidas</p>} />
    </Routes>
  </MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(api.get).mockResolvedValue({ ok: true, game })
})
afterEach(cleanup)

it('verifies owner access and identity before mounting the selected home', async () => {
  localStorage.setItem('gameId', 'OLD')
  mount()
  expect(screen.queryByText('Home: NEW')).not.toBeInTheDocument()
  expect(await screen.findByText('Home: NEW')).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=NEW')
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByText('Mis partidas')).toBeInTheDocument()
})

it('never mounts the stale home on forbidden access and allows retry', async () => {
  localStorage.setItem('gameId', 'OLD')
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Forbidden')).mockResolvedValue({ ok: true, game })
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo abrir')
  expect(screen.queryByText(/^Home:/)).not.toBeInTheDocument()
  expect(localStorage.getItem('gameId')).toBe('OLD')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Home: NEW')).toBeInTheDocument()
})

it('does not mount an unexpected identity returned by the backend', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: { ...game, gameId: 'OTHER' } })
  mount()
  await screen.findByRole('alert')
  expect(screen.queryByText(/^Home:/)).not.toBeInTheDocument()
})

it('preserves direct legacy home links without an extra game lookup', () => {
  mount('/home')
  expect(screen.getByText('Home: legacy')).toBeInTheDocument()
  expect(api.get).not.toHaveBeenCalled()
})
