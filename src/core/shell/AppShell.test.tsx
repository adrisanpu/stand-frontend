import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import AppShell from './AppShell'
import { fetchUserMedia, type UserMediaResponse } from '../../api/userMedia'
import { api } from '../../api/api'
import { getJoinUrl } from '../lib/joinUrl'
import { initialHomeCanvas } from '../home/canvasModel'

const state = vi.hoisted(() => ({ portrait: true, plan: 'event' }))
vi.mock('../../hooks/useOrientation', () => ({ useOrientation: () => state.portrait }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ loading: false, plan: state.plan }) }))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }))
vi.mock('../theme', () => ({ ThemeProvider: ({ children }: { children: ReactNode }) => children, useStandLogo: () => '/stand.png' }))
vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('../../api/userMedia', async original => ({ ...await original<typeof import('../../api/userMedia')>(), fetchUserMedia: vi.fn() }))
vi.mock('../../games', () => ({
  games: [],
  getGameById: (id: string) => ({
    id, name: id, showRanking: ['T1MER', 'STACK'].includes(id), assets: { logo: `/images/${id.toLowerCase()}-logo.png` },
  }),
}))
vi.mock('../widgets/Players', () => ({ default: (props: unknown) => <div data-testid="players" data-props={JSON.stringify(props)}>Jugadores</div> }))
vi.mock('../widgets/RaffleData', () => ({ default: (props: unknown) => <div data-testid="raffle" data-props={JSON.stringify(props)}>Sorteo</div> }))
vi.mock('../widgets/Ranking', () => ({ default: (props: unknown) => <div data-testid="ranking" data-props={JSON.stringify(props)}>Ranking</div> }))
vi.mock('../widgets/HomePrizes', () => ({ default: (props: unknown) => <div data-testid="prizes" data-props={JSON.stringify(props)}>Premios</div> }))
vi.mock('../widgets/QRCode', () => ({ default: ({ data }: { data: string }) => <div data-testid="qr" data-url={data} /> }))

function media(selected = false): UserMediaResponse {
  const logo = { id: 'client', kind: 'logo' as const, name: 'Client', fileName: 'logo.png', contentType: 'image/png', sizeBytes: 10, key: 'client', url: '/client.png' }
  return { ok: true, logo: { items: selected ? [logo] : [], selectedId: selected ? logo.id : null, selected: selected ? logo : null,
    defaults: { dark: { ...logo, id: 'platform', url: '/platform.png' } } } }
}
function metadata(type = 'T1MER', extra: Record<string, unknown> = {}) {
  return { ok: true, game: { gameType: type, playMode: 'master', joinChannel: 'instagram' },
    homeCanvas: initialHomeCanvas(['T1MER', 'STACK'].includes(type), true),
    homeBackgroundUrls: { landscape: null, portrait: null }, ...extra }
}
const props = (widget: string) => JSON.parse(screen.getByTestId(widget).getAttribute('data-props')!)
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('gameId', 'ABC123')
  localStorage.setItem('gameName', 'Event')
  localStorage.setItem('gameType', 'T1MER')
  state.portrait = true
  state.plan = 'event'
  vi.mocked(api.get).mockResolvedValue(metadata())
  vi.mocked(fetchUserMedia).mockResolvedValue(media())
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

it.each(['EMPAREJA2', 'T1MER', 'STACK', 'L3TRAS', 'RULET4', 'CUPIDO', 'SEMAFORO', 'INFOCARDS', 'IMPOSTOR'].flatMap(type =>
  [true, false].map(portrait => ({ type, portrait }))))('renders only the canvas for $type, portrait=$portrait, ignoring legacy access', async ({ type, portrait }) => {
  localStorage.setItem('gameType', type)
  state.portrait = portrait
  vi.mocked(api.get).mockResolvedValue(metadata(type))
  render(<AppShell />)
  expect(await screen.findByTestId('qr')).toHaveAttribute('data-url', getJoinUrl('ABC123', 'web'))
  expect(screen.getByRole('img', { name: 'Logo del evento' })).toHaveAttribute('src', `/images/${type.toLowerCase()}-logo.png`)
  const stage = screen.getByLabelText('Lienzo del Home').querySelector<HTMLElement>('[data-home-stage]')!
  expect(stage.style.transform).toBe('')
  expect(screen.getByTestId('players')).toBeInTheDocument()
  expect(screen.getByTestId('raffle')).toBeInTheDocument()
  expect(screen.getByTestId('prizes')).toBeInTheDocument()
  expect(!!screen.queryByTestId('ranking')).toBe(['T1MER', 'STACK'].includes(type))
  expect(screen.queryByRole('button', { name: 'Configuración' })).not.toBeInTheDocument()
  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
})
it('uses independent saved orientation content and respects intentionally empty designs', async () => {
  const data = metadata()
  data.homeCanvas.portrait.items = []
  render(<AppShell />)
  await screen.findByTestId('qr')
  vi.mocked(api.get).mockResolvedValue(data)
  await act(async () => { window.dispatchEvent(new CustomEvent('home-canvas-updated', { detail: { gameId: 'ABC123' } })) })
  await waitFor(() => expect(screen.queryByTestId('qr')).not.toBeInTheDocument())
  expect(screen.getByLabelText('Lienzo del Home')).toBeInTheDocument()
})
it('uses the explicitly selected event and returns without terminating it', async () => {
  const onReturn = vi.fn()
  render(<AppShell initialGame={{ gameId: 'NEW', gameName: 'NEW_EVENT', gameType: 'T1MER' }} onReturnToAdmin={onReturn} />)
  expect(await screen.findByTestId('qr')).toHaveAttribute('data-url', getJoinUrl('NEW', 'web'))
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=NEW')
  expect(api.get).not.toHaveBeenCalledWith('/v1/game?gameId=ABC123')
  fireEvent.click(screen.getByRole('button', { name: 'Administración' }))
  expect(onReturn).toHaveBeenCalledOnce()
  expect(api.put).not.toHaveBeenCalled()
  expect(localStorage.getItem('gameId')).toBe('NEW')
})
it('waits for account media and prefers event logo over selected client or platform defaults', async () => {
  let resolve!: (value: UserMediaResponse) => void
  vi.mocked(fetchUserMedia).mockReturnValue(new Promise(done => { resolve = done }))
  vi.mocked(api.get).mockResolvedValue(metadata('T1MER', { formLogoUrl: '/event.png' }))
  render(<AppShell />)
  expect(await screen.findByRole('status')).toHaveTextContent('Cargando')
  expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
  await act(async () => { resolve(media(true)) })
  expect(await screen.findByRole('img', { name: 'Logo del evento' })).toHaveAttribute('src', '/event.png')
  expect(document.querySelector('img[src="/platform.png"]')).toBeNull()
})
it('uses the selected client logo when the event inherits branding', async () => {
  vi.mocked(fetchUserMedia).mockResolvedValue(media(true))
  render(<AppShell />)
  expect(await screen.findByRole('img', { name: 'Logo del evento' })).toHaveAttribute('src', '/client.png')
})
it('hydrates prizes from authoritative metadata instead of stale local labels', async () => {
  localStorage.setItem('T1MER_settings_ABC123', JSON.stringify({ prizeValidation: 'Old', prizeTopX: 'Old', topX: 99 }))
  const prizeCatalog = {
    validation: { name: 'Entrada', limit: 5, imageUrl: '/validation.png' },
    ranking: { name: 'Trofeo', limit: 3, topX: 2, imageUrl: '/ranking.png' },
    raffle: { name: 'Bolsa', limit: 8, imageUrl: '/raffle.png' },
  }
  vi.mocked(api.get).mockResolvedValue(metadata('T1MER', { prizeCatalog }))
  render(<AppShell />)
  await screen.findByTestId('qr')
  expect(props('prizes').prizes).toEqual([
    { ...prizeCatalog.validation, id: 'validation', slot: 'validation', heading: 'Premio' },
    { ...prizeCatalog.ranking, id: 'ranking', slot: 'ranking', heading: 'Premio top 2' },
    { ...prizeCatalog.raffle, id: 'raffle', slot: 'raffle', heading: 'Sorteo' },
  ])
  expect(props('ranking')).toMatchObject({ prize: prizeCatalog.ranking, topX: 2, maxPrizeRanking: 3 })
  for (const widget of ['players', 'raffle']) expect(props(widget).prize).toBeUndefined()
})
it('retains legacy prize names only when the server catalog is absent', async () => {
  localStorage.setItem('T1MER_settings_ABC123', JSON.stringify({ prizeValidation: 'Entrada local', maxPrizeValidation: 4, prizeTopX: 'Copa local', maxPrizeRanking: 3, topX: 2, prizeRaffle: 'Bolsa local', maxPrizeRaffle: 8 }))
  render(<AppShell />)
  await screen.findByTestId('qr')
  expect(props('prizes').prizes.map((prize: { name: string; limit: number }) => [prize.name, prize.limit]))
    .toEqual([['Entrada local', 4], ['Copa local', 3], ['Bolsa local', 8]])
  expect(props('ranking')).toMatchObject({ topX: 2, maxPrizeRanking: 3 })
})
it('refreshes signed URLs and removals without remounting widgets', async () => {
  vi.useFakeTimers()
  vi.mocked(api.get).mockResolvedValue(metadata('T1MER', { prizeCatalog: { validation: { name: 'First', imageUrl: '/first.png' } } }))
  await act(async () => { render(<AppShell />) })
  const home = screen.getByTestId('qr')
  vi.mocked(api.get).mockResolvedValue(metadata('T1MER', { prizeCatalog: { validation: { name: 'Fresh', imageUrl: '/fresh.png' } } }))
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(screen.getByTestId('qr')).toBe(home)
  expect(props('prizes').prizes[0].imageUrl).toBe('/fresh.png')
  vi.mocked(api.get).mockResolvedValue(metadata('T1MER', { prizeCatalog: {} }))
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(props('prizes').prizes).toEqual([])
})
it('collects every STACK prize rule into the standalone prizes component', async () => {
  localStorage.setItem('gameType', 'STACK')
  vi.mocked(api.get).mockResolvedValue(metadata('STACK', { stackPrizeRules: [
    { condition: 'completed', names: ['Pizza'] }, { condition: 'top_finish', topX: 3, names: ['Copa'] }, { condition: 'raffle', names: ['Bolsa'] },
  ] }))
  render(<AppShell />)
  await screen.findByTestId('qr')
  expect(props('prizes').prizes.map((prize: { name: string }) => prize.name)).toEqual(['Pizza', 'Copa', 'Bolsa'])
  expect(props('players').stackPrizes).toBeUndefined()
  expect(props('ranking').stackPrizes).toBeUndefined()
})
it.each([true, false])('does not mount raffle when disabled or unavailable on plan (event=%s)', async event => {
  if (!event) state.plan = 'free'
  vi.mocked(api.get).mockResolvedValue(metadata('T1MER', { game: { gameType: 'T1MER', showRaffleOnHome: !event } }))
  render(<AppShell />)
  await screen.findByTestId('qr')
  expect(screen.queryByTestId('raffle')).not.toBeInTheDocument()
})
it('surfaces load errors and can retry without mounting a game engine', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Sin conexión'))
  render(<AppShell />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
  expect(await screen.findByTestId('qr')).toBeInTheDocument()
})
it('rejects invalid canvas metadata rather than silently reverting to an old layout', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: { gameType: 'T1MER' } })
  render(<AppShell />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Actualiza el backend')
  expect(screen.queryByTestId('qr')).not.toBeInTheDocument()
})
