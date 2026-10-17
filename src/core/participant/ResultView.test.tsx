import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { publicApi, type PlayerResponse } from '../../api/publicApi'
import { savePlayerSession } from './playerSession'
import ResultView from './ResultView'

vi.mock('../../api/publicApi', () => ({ publicApi: { getPlayer: vi.fn() } }))

const player: PlayerResponse = {
  ok: true, gameId: 'GAME1', gameType: 'EMPAREJA2', playerToken: 'player-token',
  assignment: { playerId: 1, characterId: 1, characterName: 'Sol', partnerCharacterName: 'Luna', validationCode: 1234, validated: true },
  prizes: [
    { kind: 'validation', token: 'validation-token', delivered: false },
    { kind: 'raffle', token: 'raffle-token', delivered: false },
  ],
  prizeCatalog: {
    validation: { name: 'Mochila', limit: 10, imageUrl: '/backpack.png' },
    raffle: { name: 'Bicicleta', limit: 1, imageUrl: '/bike.png' },
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  savePlayerSession('GAME1', 'player-token', player.assignment!)
  vi.mocked(publicApi.getPlayer).mockResolvedValue(player)
})
afterEach(() => { cleanup(); vi.useRealTimers(); sessionStorage.clear() })

it('shows the correct images alongside awarded prize QRs, including a won raffle', async () => {
  render(<ResultView gameId="GAME1" />)
  expect(await screen.findByRole('img', { name: 'Mochila' })).toHaveAttribute('src', '/backpack.png')
  expect(screen.getByRole('img', { name: 'Bicicleta' })).toHaveAttribute('src', '/bike.png')
  expect(screen.getByRole('img', { name: 'QR Premio por pareja' })).toHaveAttribute('src', expect.stringContaining('data=validation-token'))
  expect(screen.getByRole('img', { name: 'QR Premio del sorteo' })).toHaveAttribute('src', expect.stringContaining('data=raffle-token'))
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('refreshes image URLs and removals while keeping the pending QR stable', async () => {
  vi.useFakeTimers()
  render(<ResultView gameId="GAME1" />)
  await act(async () => {})
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ...player,
    prizes: [{ kind: 'validation', token: 'new-token', delivered: false }],
    prizeCatalog: { validation: { name: 'Mochila', limit: 10, imageKey: null, imageUrl: null } },
  })
  await act(async () => { vi.advanceTimersByTime(30000) })
  expect(screen.queryByRole('img', { name: 'Mochila' })).not.toBeInTheDocument()
  expect(screen.getByText('Mochila')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'QR Premio por pareja' })).toHaveAttribute('src', expect.stringContaining('data=validation-token'))
})

it('retains delivered prize images without displaying a redemption QR', async () => {
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ...player, prizes: player.prizes.map((prize) => ({ ...prize, delivered: true })),
  })
  render(<ResultView gameId="GAME1" />)
  expect(await screen.findByText('Premio(s) ya recogido(s). ¡Disfrutad!')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Mochila' })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'QR Premio por pareja' })).not.toBeInTheDocument()
})
