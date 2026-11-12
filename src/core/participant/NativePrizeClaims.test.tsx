import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { publicApi } from '../../api/publicApi'
import NativePrizeClaims from './NativePrizeClaims'

vi.mock('../../api/publicApi', () => ({ publicApi: {
  getPlayer: vi.fn(),
  walletPassUrl: vi.fn((token: string, platform: string) => `/wallet/${platform}?token=${token}`),
  retryRewardEmail: vi.fn(),
} }))
vi.mock('../widgets/QRCode', () => ({ default: ({ data }: { data: string }) => <span>{data}</span> }))
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks() })

const award = { id: 'one', name: 'Medal', state: 'available' as const, token: 'claim-token' }

it('shows persisted awards immediately without repeating the initial session request', () => {
  render(<NativePrizeClaims gameId="GAME" playerToken="session" initialAwards={[award]} />)
  expect(screen.getByText('Medal')).toBeInTheDocument()
  expect(screen.getByText('claim-token')).toBeInTheDocument()
  expect(publicApi.getPlayer).not.toHaveBeenCalled()
})

it('updates collection state and removes the consumed QR', async () => {
  vi.useFakeTimers()
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ok: true, gameId: 'GAME', gameType: 'T1MER', playerToken: 'session', assignment: null, prizes: [],
    nativePrizes: [{ ...award, state: 'delivered', token: null }],
  })
  render(<NativePrizeClaims gameId="GAME" playerToken="session" initialAwards={[award]} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
  expect(screen.queryByText('claim-token')).not.toBeInTheDocument()
  expect(screen.getByText(/ya recogido/)).toBeInTheDocument()
})

it('keeps an update failure explicit and hides stale QR claims until recovery', async () => {
  vi.useFakeTimers()
  vi.mocked(publicApi.getPlayer).mockRejectedValue(new Error('Offline'))
  render(<NativePrizeClaims gameId="GAME" playerToken="session" initialAwards={[award]} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron actualizar')
  expect(screen.queryByText('claim-token')).not.toBeInTheDocument()
})

it('shows compact unavailable-claim reasons without fabricating an award or QR', () => {
  render(<NativePrizeClaims gameId="GAME" playerToken="session" initialAwards={[]} initialUnavailable={[
    { condition: 'ranking', reason: 'event_cap_exhausted' },
    { condition: 'validation', reason: 'global_stock_exhausted' },
    { condition: 'raffle', reason: 'uninitialized' },
  ]} />)
  expect(screen.getByRole('status')).toHaveTextContent('Se ha alcanzado el límite de premios de esta partida.')
  expect(screen.getByRole('status')).toHaveTextContent('Se ha agotado el stock compartido del premio.')
  expect(screen.getByRole('status')).toHaveTextContent('El stock del premio no está inicializado.')
  expect(screen.queryByText('claim-token')).not.toBeInTheDocument()
  expect(publicApi.getPlayer).not.toHaveBeenCalled()
})

it('clears unavailable reasons when polling receives an awarded claim', async () => {
  vi.useFakeTimers()
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ok: true, gameId: 'GAME', gameType: 'T1MER', playerToken: 'session', assignment: null, prizes: [],
    nativePrizes: [award], prizeUnavailable: [],
  })
  render(<NativePrizeClaims gameId="GAME" playerToken="session" initialAwards={[]} initialUnavailable={[
    { condition: 'ranking', reason: 'uninitialized' },
  ]} />)
  expect(screen.getByRole('status')).toHaveTextContent('El stock del premio no está inicializado.')
  await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getByText('claim-token')).toBeInTheDocument()
})
