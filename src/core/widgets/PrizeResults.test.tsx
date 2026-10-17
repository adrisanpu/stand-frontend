import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import T1merGameScreen from '../../games/t1mer/GameScreen'
import type { PrizeCatalog } from '../prizes'

vi.mock('../../api/api', () => ({ api: { post: vi.fn() } }))
vi.mock('../theme', () => ({ useAvatarsEnabled: () => false }))
vi.mock('../input/useGameInput', () => ({ useGameInput: () => {} }))
vi.mock('../input/useWebOsPointerPrimary', () => ({ useWebOsPointerPrimary: () => {} }))
vi.mock('./GameLandscapeLeftColumn', () => ({ default: () => <aside /> }))

beforeEach(() => {
  vi.mocked(api.post).mockReset()
  vi.mocked(api.post).mockResolvedValueOnce({ valid: true, playerId: 'player', username: 'Rosa' })
    .mockResolvedValue({ ok: true, rank: 1 })
})
afterEach(cleanup)

it.each(['portrait', 'landscape'] as const)('shows only the ranking-slot image in T1MER results (%s)', async (orientation) => {
  const prizeCatalog: PrizeCatalog = {
    validation: { name: 'Entrada', limit: null, imageUrl: '/validation.png' },
    ranking: { name: 'Copa especial', limit: 3, topX: 2, imageUrl: '/ranking.png' },
    raffle: { name: 'Bolsa', limit: null, imageUrl: '/raffle.png' },
  }
  const props = { gameId: 'GAME', orientation, logoElement: <div />, sidebarElement: <div />, topX: 99, prizeLabel: 'Legacy' }
  const { rerender } = render(<T1merGameScreen {...props} playMode="master" joinChannel="web" prizeCatalog={prizeCatalog} />)
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'EMPEZAR' }))
  fireEvent.click(screen.getByRole('button', { name: 'DETENER' }))
  expect(await screen.findByRole('img', { name: 'Copa especial' })).toHaveAttribute('src', '/ranking.png')
  expect(screen.getByText('¡Premio por entrar en el top 2! Copa especial')).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'Entrada' })).not.toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'Bolsa' })).not.toBeInTheDocument()
  rerender(<T1merGameScreen {...props} playMode="master" joinChannel="web" prizeCatalog={{ ...prizeCatalog, ranking: { ...prizeCatalog.ranking!, imageUrl: null } }} />)
  expect(screen.queryByRole('img', { name: 'Copa especial' })).not.toBeInTheDocument()
  expect(screen.getByText('¡Premio por entrar en el top 2! Copa especial')).toBeInTheDocument()
  rerender(<T1merGameScreen {...props} playMode="master" joinChannel="web" prizeCatalog={{}} />)
  expect(screen.queryByText(/¡Premio/)).not.toBeInTheDocument()
})

it('keeps legacy T1MER prize announcements image-free', async () => {
  render(<T1merGameScreen gameId="GAME" playMode="master" joinChannel="web" topX={3} prizeLabel="Legacy" />)
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
  fireEvent.click(await screen.findByRole('button', { name: 'EMPEZAR' }))
  fireEvent.click(screen.getByRole('button', { name: 'DETENER' }))
  expect(await screen.findByText('¡Premio por entrar en el top 3! Legacy')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})
