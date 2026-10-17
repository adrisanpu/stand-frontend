import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import type { GamePrize } from '../prizes'
import Players from './Players'
import Ranking from './Ranking'
import RaffleData from './RaffleData'
import { HOME_TITLE_TEXT, HOME_BODY_TEXT } from '../ui/homeTypography'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ plan: 'event' }) }))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(api.get).mockResolvedValue({
    ok: true, playerCount: 5, validatedCount: 2, raffleWinners: [],
    results: [{ rank: 1, username: 'Player', timer: 10 }],
    settings: { empareja2: { maxValidations: 99 } },
  })
})
afterEach(cleanup)

const validation: GamePrize = { name: 'Entrada VIP', limit: 4, imageUrl: '/validation.png' }
const ranking: GamePrize = { name: 'Copa', limit: 3, topX: 2, imageUrl: '/ranking.png' }
const raffle: GamePrize = { name: 'Camiseta', limit: 8, imageUrl: '/raffle.png' }

it.each([true, false])('shares title and body sizes across all home panels (compact=%s)', async (compact) => {
  render(<>
    <Players gameName="Event" gameType="EMPAREJA2" compact={compact} prize={validation} />
    <Ranking gameId="GAME" compact={compact} prize={ranking} />
    <RaffleData gameId="GAME" gameName="Event" compact={compact} prize={raffle} />
  </>)
  const count = await screen.findByText('5')
  const players = screen.getByText('Jugadores')
  const rankingTitle = await screen.findByRole('heading', { name: 'Ranking' })
  const raffleTitle = await screen.findByRole('heading', { name: 'Sorteo' })
  for (const element of [count, players, rankingTitle, raffleTitle]) {
    expect(element).toHaveClass(...HOME_TITLE_TEXT.split(' '))
  }
  for (const text of ['PREMIO: Entrada VIP', 'PREMIO TOP 2: Copa', 'PREMIO: Camiseta',
    '2/4', '1/3', '0/8', '10.000s', 'No hay ganadores aún']) {
    expect(await screen.findByText(text)).toHaveClass(...HOME_BODY_TEXT.split(' '))
  }
  expect(screen.getByText('Player').parentElement).toHaveClass(...HOME_BODY_TEXT.split(' '))
  expect(count).toHaveClass('text-[var(--color-primary)]')
  expect(players).toHaveClass('text-textMain')
  expect(screen.getByText('No hay ganadores aún')).toHaveClass('text-textSub')
})

it('shows the correct slot image beside each single custom name and server limit', async () => {
  render(<>
    <Players gameName="Event" gameType="EMPAREJA2" prize={validation} prizeLabel="Old validation" maxPrizeValidationLimit={99} />
    <Ranking gameId="GAME" prize={ranking} prizeLabel="Old ranking" topX={99} maxPrizeRanking={99} />
    <RaffleData gameId="GAME" gameName="Event" prize={raffle} prizeLabel="Old raffle" maxPrizeRaffle={99} />
  </>)
  for (const prize of [validation, ranking, raffle]) {
    const image = await screen.findByRole('img', { name: prize.name })
    expect(image).toHaveAttribute('src', prize.imageUrl)
    expect(image).toHaveClass('object-contain')
    expect(screen.getAllByText(new RegExp(prize.name))).toHaveLength(1)
  }
  expect(screen.getByText('2/4')).toBeInTheDocument()
  expect(screen.getByText('1/3')).toBeInTheDocument()
  expect(screen.getByText('0/8')).toBeInTheDocument()
  expect(screen.getByText('PREMIO TOP 2: Copa')).toBeInTheDocument()
  expect(screen.queryByText(/Old/)).not.toBeInTheDocument()
})

it('preserves legacy text-only prizes without creating images', async () => {
  render(<>
    <Players gameName="Event" prizeLabel="Entrada" />
    <Ranking gameId="GAME" prizeLabel="Trofeo" topX={3} />
    <RaffleData gameId="GAME" gameName="Event" prizeLabel="Bolsa" />
  </>)
  expect(await screen.findByText('PREMIO: Entrada')).toBeInTheDocument()
  expect(await screen.findByText('PREMIO TOP 3: Trofeo')).toBeInTheDocument()
  expect(await screen.findByText('PREMIO: Bolsa')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it.each([true, false])('keeps authoritative null limits unlimited despite legacy API and cached limits (countersOnly=%s)', async (countersOnly) => {
  localStorage.setItem('EMPAREJA2_settings_GAME', JSON.stringify({ maxPrizeValidation: 77, maxValidations: 66 }))
  render(<>
    <Players gameName="Event" gameId="GAME" gameType="EMPAREJA2" countersOnly={countersOnly}
      prize={{ ...validation, limit: null }} maxPrizeValidationLimit={88} />
    <Ranking gameId="GAME" prize={{ ...ranking, limit: null }} maxPrizeRanking={88} />
    <RaffleData gameId="GAME" gameName="Event" prize={{ ...raffle, limit: null }} maxPrizeRaffle={88} />
  </>)
  expect(await screen.findByText('PREMIO: Entrada VIP')).toBeInTheDocument()
  expect(await screen.findByText('PREMIO TOP 2: Copa')).toBeInTheDocument()
  expect(await screen.findByText('PREMIO: Camiseta')).toBeInTheDocument()
  expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument()
})

it('removes an image immediately without resurrecting cached signed URLs', async () => {
  localStorage.setItem('SEMAFORO_settings_GAME', JSON.stringify({ prizeCatalog: { validation } }))
  const { rerender } = render(<Players gameName="Event" prize={validation} />)
  expect(await screen.findByRole('img', { name: 'Entrada VIP' })).toHaveAttribute('src', '/validation.png')
  rerender(<Players gameName="Event" prize={{ ...validation, imageKey: null, imageUrl: null }} />)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.getByText('PREMIO: Entrada VIP')).toBeInTheDocument()
  rerender(<Players gameName="Event" prize={{ name: '', limit: null }} />)
  expect(screen.queryByText(/PREMIO:/)).not.toBeInTheDocument()
})

it.each([true, false])('overlaps the raffle card without hiding winner controls (compact=%s)', async (compact) => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true,
    game: { gameType: 'EMPAREJA2' },
    raffleWinners: [
      { playerId: 1, instagramUsername: 'Alice', prizeDelivered: true },
      { playerId: 2, instagramUsername: 'Bob', prizeDelivered: false },
    ],
  })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
  render(<RaffleData gameId="GAME" gameName="Event" compact={compact} prize={raffle} />)
  const label = await screen.findByText('PREMIO: Camiseta')
  expect(screen.getByRole('heading', { name: 'Sorteo' })).toHaveClass(
    'text-xl', 'sm:text-2xl',
  )
  const sticker = label.parentElement?.parentElement
  expect(sticker?.nextElementSibling).toHaveClass('card', compact ? 'p-2' : 'p-3')
  expect(sticker?.nextElementSibling).not.toHaveClass('pt-10')
  expect(screen.getByText('2/8')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Ganadores/ }))
  expect(screen.getByRole('listbox')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ganadores/ })).toHaveClass(...HOME_BODY_TEXT.split(' '))
  expect(screen.getByText('Bob')).toHaveClass(...HOME_BODY_TEXT.split(' '))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Premio entregado para Bob' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/v1/game', {
    gameId: 'GAME',
    settings: { prizeDelivered: { gameType: 'EMPAREJA2', playerId: 2, delivered: true } },
  }))
  expect(screen.getByText('2/8')).toBeInTheDocument()
})
