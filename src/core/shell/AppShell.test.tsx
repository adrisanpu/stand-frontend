import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from './AppShell'
import { fetchUserMedia, type UserMediaResponse } from '../../api/userMedia'
import { api } from '../../api/api'
import { getJoinUrl } from '../lib/joinUrl'

const state = vi.hoisted(() => ({ portrait: true, plan: 'event' }))
const observeLayout = vi.fn()
vi.mock('../../hooks/useOrientation', () => ({ useOrientation: () => state.portrait }))
vi.mock('../../auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { email: 'operator@example.test' }, loading: false, plan: state.plan }),
}))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }))
vi.mock('../theme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useAvatarsEnabled: () => false,
  getAvatarsEnabled: () => false,
  useStandLogo: () => '/stand.png',
}))
vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('../../api/userMedia', async (original) => ({
  ...await original<typeof import('../../api/userMedia')>(),
  fetchUserMedia: vi.fn(),
}))
vi.mock('../../games', () => ({
  games: [],
  getGameById: (id: string) => ({
    id, name: id, showRanking: id === 'STACK' || id === 'T1MER', assets: { logo: `/images/${id.toLowerCase()}-logo.png` },
    GameScreen: ({ logoElement, playMode, joinChannel }: { logoElement: ReactNode; playMode: string; joinChannel: string }) => (
      <div data-testid="game-screen" data-mode={playMode} data-channel={joinChannel}>{logoElement}</div>
    ),
  }),
}))
vi.mock('../widgets/Players', () => ({ default: () => <div data-testid="players">Jugadores</div> }))
vi.mock('../widgets/RaffleData', () => ({ default: ({ compact }: { compact?: boolean }) => <div data-testid="raffle" data-compact={String(Boolean(compact))}>Sorteo</div> }))
vi.mock('../widgets/Ranking', () => ({ default: () => <div data-testid="ranking">Ranking</div> }))
vi.mock('../widgets/QRCode', () => ({ default: ({ data }: { data: string }) => <div data-testid="qr" data-url={data} /> }))

function media(selected = false): UserMediaResponse {
  const logo = {
    id: 'client', kind: 'logo' as const, name: 'Client', fileName: 'logo.png',
    contentType: 'image/png', sizeBytes: 10, key: 'client', url: '/client.png',
  }
  return {
    ok: true,
    logo: {
      items: selected ? [logo] : [], selectedId: selected ? logo.id : null, selected: selected ? logo : null,
      defaults: { dark: { ...logo, id: 'platform', url: '/platform.png' } },
    },
    avatar: { items: [], selectedByState: { idle: null, win: null, lose: null }, selected: { idle: null, win: null, lose: null } },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('gameId', 'ABC123')
  localStorage.setItem('gameName', 'Event')
  localStorage.setItem('gameType', 'SEMAFORO')
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: { gameType: 'SEMAFORO', playMode: 'master', joinChannel: 'instagram' } })
  vi.mocked(fetchUserMedia).mockResolvedValue(media())
  state.portrait = true
  state.plan = 'event'
  observeLayout.mockClear()
  vi.stubGlobal('ResizeObserver', class { observe(target: Element) { observeLayout(target) } disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('game home identity and configuration', () => {
  it.each([true, false])('uses the game logo without a selected client logo (portrait=%s)', async (portrait) => {
    state.portrait = portrait
    render(<AppShell />)
    const logo = await screen.findByRole('img', { name: 'SEMAFORO' })
    expect(logo).toHaveAttribute('src', '/images/semaforo-logo.png')
    expect(document.querySelector('img[src="/platform.png"]')).toBeNull()
    expect(screen.getByRole('img', { name: 'Stand' })).toHaveAttribute('src', '/images/logo-stand-footer.png')
    await waitFor(() => expect(observeLayout).toHaveBeenCalled())
  })

  it.each([true, false])('keeps the selected client logo (portrait=%s)', async (portrait) => {
    state.portrait = portrait
    vi.mocked(fetchUserMedia).mockResolvedValue(media(true))
    render(<AppShell />)
    expect(await screen.findByRole('img', { name: 'Logo del cliente' })).toHaveAttribute('src', '/client.png')
  })

  it('opens configuration even without a game-specific config component', async () => {
    render(<AppShell />)
    await screen.findByTestId('game-screen')
    fireEvent.click(screen.getByRole('button', { name: 'Configuración' }))
    fireEvent.click(screen.getByRole('button', { name: 'Configurar juego' }))
    expect(screen.getByRole('dialog', { name: 'Configurar juego' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '1 pantalla' })).toBeEnabled())
    expect(screen.getByRole('button', { name: '∞ móviles' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Web' })).toBeDisabled()
  })

  it('passes independent mode and channel through the landscape home', async () => {
    state.portrait = false
    localStorage.setItem('gameType', 'T1MER')
    vi.mocked(api.get).mockResolvedValue({ ok: true, game: { gameType: 'T1MER', playMode: 'master', joinChannel: 'web' } })
    render(<AppShell />)
    const game = await screen.findByTestId('game-screen')
    expect(game).toHaveAttribute('data-mode', 'master')
    expect(game).toHaveAttribute('data-channel', 'web')
  })

  it('does not launch a default gameplay mode when access cannot be loaded', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Sin conexión'))
    render(<AppShell />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.queryByTestId('game-screen')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    expect(await screen.findByTestId('game-screen')).toHaveAttribute('data-mode', 'master')
  })

  it.each(['EMPAREJA2', 'T1MER', 'STACK'].flatMap(gameType =>
    (['web', 'instagram'] as const).flatMap(joinChannel =>
      [true, false].map(portrait => ({ gameType, joinChannel, portrait }))
    )
  ))('uses the clean mobile event home for $gameType, $joinChannel (portrait=$portrait)', async ({ gameType, joinChannel, portrait }) => {
    state.portrait = portrait
    localStorage.setItem('gameType', gameType)
    vi.mocked(api.get).mockResolvedValue({ ok: true, game: { gameType, playMode: 'mobile', joinChannel } })
    render(<AppShell />)
    const logoPanel = await screen.findByLabelText('Logo del evento')
    expect(logoPanel.querySelector('img')).toHaveAttribute('src', `/images/${gameType.toLowerCase()}-logo.png`)
    expect(logoPanel.children).toHaveLength(1)
    expect(logoPanel.querySelector('button')).toBeNull()
    const left = screen.getByLabelText('Logo, jugadores y sorteo')
    expect(left).toContainElement(screen.getByTestId('players'))
    expect(left).toContainElement(screen.getByTestId('raffle'))
    expect(left.lastElementChild).toContainElement(screen.getByTestId('raffle'))
    expect(screen.getByTestId('raffle')).toHaveAttribute('data-compact', String(!portrait))
    const center = screen.getByLabelText('QR de acceso al juego')
    expect(center).toContainElement(screen.getByTestId('qr'))
    expect(screen.getByTestId('qr')).toHaveAttribute('data-url', getJoinUrl('ABC123', joinChannel))
    expect(screen.queryByTestId('game-screen')).not.toBeInTheDocument()
    expect(screen.queryByText('Participación desde el móvil')).not.toBeInTheDocument()
    expect(screen.queryByText(/Juega STACK desde el móvil/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir enlace participante' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar enlace participante' })).not.toBeInTheDocument()
    if (gameType === 'EMPAREJA2') {
      expect(screen.queryByLabelText('Ranking del evento')).not.toBeInTheDocument()
    } else {
      const right = screen.getByLabelText('Ranking del evento')
      expect(right).toContainElement(screen.getByTestId('ranking'))
      expect(right).not.toContainElement(screen.getByTestId('raffle'))
    }
  })

  it.each([true, false])('retains the selected client logo in mobile mode (portrait=%s)', async (portrait) => {
    state.portrait = portrait
    localStorage.setItem('gameType', 'STACK')
    vi.mocked(api.get).mockResolvedValue({ ok: true, game: { gameType: 'STACK', playMode: 'mobile', joinChannel: 'web' } })
    vi.mocked(fetchUserMedia).mockResolvedValue(media(true))
    render(<AppShell />)
    expect(await screen.findByRole('img', { name: 'Logo del cliente' })).toHaveAttribute('src', '/client.png')
    expect(screen.getAllByTestId('qr')).toHaveLength(1)
    expect(screen.getByTestId('qr')).toHaveAttribute('data-url', getJoinUrl('ABC123', 'web'))
    expect(screen.getByRole('img', { name: 'Stand' })).toHaveAttribute('src', '/images/logo-stand-footer.png')
  })

  it('keeps the mobile raffle hidden on plans without raffles', async () => {
    state.plan = 'free'
    localStorage.setItem('gameType', 'STACK')
    vi.mocked(api.get).mockResolvedValue({ ok: true, game: { gameType: 'STACK', playMode: 'mobile', joinChannel: 'web' } })
    render(<AppShell />)
    await screen.findByLabelText('Logo del evento')
    expect(screen.queryByLabelText('Sorteo del evento')).not.toBeInTheDocument()
    expect(screen.queryByTestId('raffle')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ranking del evento')).toBeInTheDocument()
  })
})
