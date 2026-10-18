import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import T1merGameScreen from '../../games/t1mer/GameScreen'

vi.mock('../../api/api', () => ({ api: { post: vi.fn() } }))
vi.mock('../input/useGameInput', () => ({ useGameInput: () => {} }))
vi.mock('../input/useWebOsPointerPrimary', () => ({ useWebOsPointerPrimary: () => {} }))
vi.mock('./GameLandscapeLeftColumn', () => ({ default: () => <aside /> }))

beforeEach(() => {
  vi.mocked(api.post).mockReset()
  vi.mocked(api.post).mockResolvedValueOnce({ valid: true, playerId: 'player', username: 'Rosa' })
    .mockResolvedValue({ ok: true, rank: 1 })
})
afterEach(cleanup)

it.each(['portrait', 'landscape'] as const)('keeps T1MER participant play on Web access (%s)', (orientation) => {
  const props = { gameId: 'GAME', orientation, logoElement: <div />, sidebarElement: <div />, topX: 99, prizeLabel: 'Legacy' }
  render(<T1merGameScreen {...props} playMode="mobile" joinChannel="web" />)
  expect(screen.getByRole('heading', { name: 'Participación desde el móvil' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Abrir enlace participante' })).toHaveAttribute('href', `${window.location.origin}/play/GAME`)
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
})

it('does not expose legacy master gameplay for a T1MER game', () => {
  render(<T1merGameScreen gameId="GAME" playMode="mobile" joinChannel="web" topX={3} prizeLabel="Legacy" />)
  expect(screen.getByRole('heading', { name: 'Participación desde el móvil' })).toBeInTheDocument()
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
})
