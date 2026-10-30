import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { publicApi, type PlayerResponse } from '../../api/publicApi'
import RankingPrizeClaim from './RankingPrizeClaim'

vi.mock('../../api/publicApi', () => ({ publicApi: { getPlayer: vi.fn() } }))

const response: PlayerResponse = {
  ok: true, gameId: 'GAME1', gameType: 'STACK', playerToken: 'session',
  assignment: { gameType: 'STACK', playerId: 1, displayName: 'Winner', attempt: null, score: 7, rank: 1 },
  prizes: [{ kind: 'ranking', token: 'signed-prize-token', delivered: false }],
  prizeCatalog: { ranking: { name: 'Consola', limit: 3, topX: 3, imageUrl: '/prize.png' } },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(publicApi.getPlayer).mockResolvedValue(response)
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it('shows the server-issued ranking claim and generates its QR locally', async () => {
  render(<RankingPrizeClaim gameId="GAME1" playerToken="session" />)
  const qr = await screen.findByRole('img', { name: 'QR Premio del ranking' })
  expect(qr).toHaveAttribute('src', expect.stringContaining('data:image/gif;base64,'))
  expect(screen.getByRole('img', { name: 'Consola' })).toHaveAttribute('src', '/prize.png')
  expect(publicApi.getPlayer).toHaveBeenCalledWith('session', 'GAME1')
  expect(screen.getByText(/Muestra este QR/)).toBeInTheDocument()
})

it('shows no prize or QR when the server does not grant a ranking claim', async () => {
  vi.mocked(publicApi.getPlayer).mockResolvedValue({ ...response, prizes: [] })
  const { container } = render(<RankingPrizeClaim gameId="GAME1" playerToken="session" prizeCatalog={response.prizeCatalog} />)
  await act(async () => {})
  expect(container.querySelector('.stack-viewport')).toBeEmptyDOMElement()
})

it('does not require or offer wallet in email mode and preserves STAND QR access', async () => {
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ...response, prizes: [], stackPrizes: {
      deliveryChannel: 'email', walletUrl: 'https://club.kivly.store/add-to-wallet',
      walletExpected: true, state: 'open', finalPrizesPending: false,
      awards: [
        { id: 'local', name: 'Pizza', source: 'stand', condition: 'completed', state: 'available', token: 'qr' },
        { id: 'club', name: 'Coffee', source: 'kivly', condition: 'completed', state: 'confirmed',
          deliveryChannel: 'email', emailState: 'accepted' },
      ],
    },
  })
  render(<RankingPrizeClaim gameId="GAME1" playerToken="session" />)
  expect(await screen.findByRole('img', { name: 'QR Pizza' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /wallet/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'Abre la wallet para ver tu premio' })).not.toBeInTheDocument()
  expect(screen.getByText(/Email de tu premio enviado/)).toBeInTheDocument()
})

it('replaces the QR with delivery confirmation on the next poll', async () => {
  vi.useFakeTimers()
  render(<RankingPrizeClaim gameId="GAME1" playerToken="session" />)
  await act(async () => {})
  expect(screen.getByRole('img', { name: 'QR Premio del ranking' })).toBeInTheDocument()
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ...response, prizes: [{ ...response.prizes[0], delivered: true }],
  })
  await act(async () => { vi.advanceTimersByTime(30000) })
  expect(screen.queryByRole('img', { name: 'QR Premio del ranking' })).not.toBeInTheDocument()
  expect(screen.getByText(/ya recogido/)).toBeInTheDocument()
})

it('removes a claim if the player drops out of the eligible ranking', async () => {
  vi.useFakeTimers()
  const { container } = render(<RankingPrizeClaim gameId="GAME1" playerToken="session" />)
  await act(async () => {})
  vi.mocked(publicApi.getPlayer).mockResolvedValue({ ...response, prizes: [] })
  await act(async () => { vi.advanceTimersByTime(30000) })
  expect(container.querySelector('.stack-viewport')).toBeEmptyDOMElement()
})

it('reports failures explicitly and lets the player retry', async () => {
  vi.mocked(publicApi.getPlayer).mockRejectedValueOnce(new Error('Offline'))
  render(<RankingPrizeClaim gameId="GAME1" playerToken="session" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron actualizar los premios.')
  expect(screen.queryByRole('img', { name: 'QR Premio del ranking' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar actualización de premios' }))
  expect(await screen.findByRole('img', { name: 'QR Premio del ranking' })).toBeInTheDocument()
})

it('does not show a claim from a mismatched game response', async () => {
  vi.mocked(publicApi.getPlayer).mockResolvedValue({ ...response, gameId: 'OTHER' })
  render(<RankingPrizeClaim gameId="GAME1" playerToken="session" />)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'QR Premio del ranking' })).not.toBeInTheDocument()
})

it('places the compact wallet after the result and before earned prizes', async () => {
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ...response, prizes: [], stackPrizes: {
      walletUrl: 'https://club.kivly.store/add-to-wallet', state: 'open', finalPrizesPending: false,
      awards: [{ id: 'unit', name: 'Pizza', source: 'stand', condition: 'completed', state: 'available', token: 'qr' }],
    },
  })
  const { rerender } = render(<RankingPrizeClaim gameId="GAME1" playerToken="session" enabled={false} rank={null} />)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  rerender(<RankingPrizeClaim gameId="GAME1" playerToken="session" enabled rank={1} />)
  const wallet = await screen.findByRole('link', { name: 'Añadir a mi wallet y desbloquear mi premio' })
  const position = screen.getByRole('heading', { name: 'Posición: #1' })
  const prize = screen.getByRole('heading', { name: 'Pizza' })
  expect(position.compareDocumentPosition(wallet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(wallet.compareDocumentPosition(prize) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByText('STAND · QR')).not.toBeInTheDocument()
  expect(screen.queryByText('Por completar la partida')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Abre la wallet para ver tu premio' })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'QR Pizza' })).not.toBeInTheDocument()
  fireEvent.click(wallet)
  expect(screen.queryByRole('img', { name: 'Abre la wallet para ver tu premio' })).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'QR Pizza' })).toBeInTheDocument()
  expect(wallet).not.toHaveClass('wallet-highlight')
})

it.each([null, 'https://other.example/add-to-wallet'])('keeps prizes accessible without a usable wallet link (%s)', async (walletUrl) => {
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ...response, prizes: [], stackPrizes: {
      walletUrl, state: 'open', finalPrizesPending: false,
      awards: [{ id: 'unit', name: 'Pizza', source: 'stand', condition: 'completed', state: 'available', token: 'qr' }],
    },
  })
  render(<RankingPrizeClaim gameId="GAME1" playerToken="session" enabled rank={1} />)
  expect(await screen.findByRole('img', { name: 'QR Pizza' })).toBeInTheDocument()
  expect(screen.queryByRole('img', { name: 'Abre la wallet para ver tu premio' })).not.toBeInTheDocument()
})

it('preserves the visual reveal across prize refreshes', async () => {
  vi.useFakeTimers()
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ...response, prizes: [], stackPrizes: {
      walletUrl: 'https://club.kivly.store/add-to-wallet', state: 'open', finalPrizesPending: false,
      awards: [
        { id: 'unit', name: 'Pizza', source: 'stand', condition: 'completed', state: 'available', token: 'qr' },
        { id: 'club', name: 'Coffee', source: 'kivly', condition: 'completed', state: 'confirmed' },
      ],
    },
  })
  render(<RankingPrizeClaim gameId="GAME1" playerToken="session" enabled rank={1} />)
  await act(async () => {})
  expect(screen.getAllByRole('img', { name: 'Abre la wallet para ver tu premio' })).toHaveLength(2)
  fireEvent.click(screen.getByRole('link', { name: 'Añadir a mi wallet y desbloquear mi premio' }))
  await act(async () => { vi.advanceTimersByTime(30000) })
  expect(screen.queryByRole('img', { name: 'Abre la wallet para ver tu premio' })).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'QR Pizza' })).toBeInTheDocument()
})
