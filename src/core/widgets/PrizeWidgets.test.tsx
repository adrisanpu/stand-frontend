import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Players from './Players'
import Ranking from './Ranking'
import RaffleData from './RaffleData'
import HomePrizes, { type HomePrize } from './HomePrizes'
import { HOME_TITLE_TEXT, HOME_BODY_TEXT } from '../ui/homeTypography'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ plan: 'event' }) }))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(api.get).mockReset()
  vi.mocked(api.get).mockResolvedValue({
    ok: true, playerCount: 5, validatedCount: 2, raffleWinners: [],
    results: [{ rank: 1, username: 'Player', timer: 10 }],
  })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const prizes: HomePrize[] = [
  { id: 'validation', slot: 'validation', heading: 'Premio', name: 'Entrada VIP', limit: 4, imageUrl: '/validation.png' },
  { id: 'ranking', slot: 'ranking', heading: 'Premio top 2', name: 'Copa', limit: 3, topX: 2 },
  { id: 'raffle', slot: 'raffle', heading: 'Sorteo', name: 'Camiseta', limit: null },
]

it.each([true, false])('shares title and body sizes and never shows prize stickers (compact=%s)', async (compact) => {
  render(<>
    <Players gameName="Event" gameType="EMPAREJA2" compact={compact} />
    <Ranking gameId="GAME" compact={compact} />
    <RaffleData gameId="GAME" gameName="Event" compact={compact} />
  </>)
  const count = await screen.findByText('5')
  const rankingTitle = await screen.findByRole('heading', { name: 'Ranking' })
  const raffleTitle = await screen.findByRole('heading', { name: 'Sorteo' })
  for (const element of [count, screen.getByText('Jugadores'), rankingTitle, raffleTitle]) {
    expect(element).toHaveClass(...HOME_TITLE_TEXT.split(' '))
  }
  expect(await screen.findByText('No hay ganadores aún')).toHaveClass(...HOME_BODY_TEXT.split(' '), 'text-textSub')
  expect(screen.queryByTestId('prize-sticker')).not.toBeInTheDocument()
})

it('shows raffle winners in a visible list with delivery controls', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true,
    game: { gameType: 'EMPAREJA2' },
    raffleWinners: [
      { playerId: 1, username: 'Alice', prizeDelivered: true },
      { playerId: 2, username: 'Bob', prizeDelivered: false },
    ],
  })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
  render(<RaffleData gameId="GAME" gameName="Event" compact />)
  expect(await screen.findByText('Ganadores (2)')).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Lista de ganadores' })).toBeVisible()
  expect(screen.queryByRole('button', { name: /Ganadores/ })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Premio entregado para Alice' })).toBeChecked()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Premio entregado para Bob' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/v1/game', {
    gameId: 'GAME',
    settings: { prizeDelivered: { gameType: 'EMPAREJA2', playerId: 2, delivered: true } },
  }))
})

it('rotates through every prize with its counters', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.mocked(api.get).mockImplementation(async (url: string) => url.startsWith('/v1/game/score')
    ? { ok: true, results: [{}, {}, {}, {}] }
    : { ok: true, validatedCount: 2, raffleWinners: [{}] })
  render(<HomePrizes prizes={prizes} gameId="GAME" gameName="Event" />)
  expect(await screen.findByText('Entrada VIP')).toBeInTheDocument()
  expect(await screen.findByText('2/4')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Entrada VIP' })).toHaveAttribute('src', '/validation.png')
  await act(async () => { vi.advanceTimersByTime(4000) })
  expect(screen.getByText('Copa')).toBeInTheDocument()
  expect(screen.getByText('3/3')).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/v1/game/score?gameId=GAME&limit=3')
  await act(async () => { vi.advanceTimersByTime(4000) })
  expect(screen.getByText('Camiseta')).toBeInTheDocument()
  expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
})

it('shows an empty state without polling when no prizes exist', () => {
  render(<HomePrizes prizes={[]} gameId="GAME" gameName="Event" />)
  expect(screen.getByText('Sin premios configurados')).toBeInTheDocument()
  expect(api.get).not.toHaveBeenCalled()
})
