import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import type { PrizeGameResponse } from '../../api/prizeMedia'
import type { GameDefinition } from '../types'
import type { PrizeCatalog } from '../prizes'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import OperatorPrizeSettings from './OperatorPrizeSettings'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))

const colors = { primary: '#000', accent: '#000', background: '#000', surface: '#000', textMain: '#fff', textSub: '#fff' }
const definition: GameDefinition = {
  id: 'EMPAREJA2', name: 'EMPAREJA2', colors, GameScreen: () => null, showRanking: true,
}
const shared = [
  { id: 'welcome', name: 'Mi premio', imageKey: 'prizes/owner/welcome.png', imageUrl: 'https://images/welcome.png' },
  { id: 'podium', name: 'Podium', imageKey: null, imageUrl: null },
  { id: 'surprise', name: 'Sorpresa', imageKey: null, imageUrl: null },
]
const initialCatalog: PrizeCatalog = {
  validation: { name: 'Mi premio', limit: 4, sharedPrizeId: 'welcome', imageKey: shared[0].imageKey, imageUrl: shared[0].imageUrl },
  ranking: { name: 'Podium', limit: null, topX: 3, sharedPrizeId: 'podium' },
  raffle: { name: 'Sorpresa', limit: 2, sharedPrizeId: 'surprise' },
}
let serverResponse: PrizeGameResponse

beforeEach(() => {
  vi.clearAllMocks()
  serverResponse = { ok: true, prizeCatalog: structuredClone(initialCatalog) }
  vi.mocked(api.get).mockImplementation(async url => url === '/v1/prizes/inventory'
    ? { ok: true, mode: 'active', imports: {}, unresolved: 0, catalog: [
      { id: 'welcome', inventory: { initialized: true, available: 9 } },
      { id: 'podium', inventory: { initialized: true, available: 0 } },
    ] }
    : url === '/v1/prizes/catalog'
    ? { ok: true, catalog: structuredClone(shared), revision: 1 }
    : serverResponse)
  vi.mocked(api.put).mockImplementation(async (url, body) => {
    if (url === '/v1/game') {
      const catalog = (body as { prizeCatalog: PrizeCatalog }).prizeCatalog
      serverResponse = { ok: true, prizeCatalog: structuredClone(catalog) }
    }
    return { ok: true }
  })
})
afterEach(cleanup)

async function mount(options: {
  game?: GameDefinition
  plan?: 'free' | 'event'
  settings?: Record<string, unknown>
} = {}) {
  const onPersist = vi.fn()
  render(<OperatorLanguageProvider>
    <OperatorPrizeSettings gameId="GAME 1" gameDefinition={options.game ?? definition}
      plan={options.plan ?? 'event'} settings={options.settings ?? {}} onPersist={onPersist} />
  </OperatorLanguageProvider>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled())
  return onPersist
}

const region = (name = 'Validación / participación') => within(screen.getByRole('region', { name }))

it.each([
  ['EMPAREJA2', true, 'event', ['Validación / participación', 'Ranking', 'Sorteo']],
  ['T1MER', true, 'free', ['Ranking']],
  ['CUPIDO', false, 'free', ['Validación / participación']],
] as const)('shows assignable slots for %s / %s / %s', async (id, showRanking, plan, names) => {
  const game = { ...definition, id, showRanking }
  await mount({ game, plan })
  expect(screen.getAllByRole('region').map(element => within(element).getByRole('heading').textContent)).toEqual(names)
})

it('assigns a shared prize while keeping limits and ranking conditions per event', async () => {
  const onPersist = await mount()
  const ranking = region('Ranking')
  fireEvent.change(ranking.getByLabelText('Premio compartido'), { target: { value: 'welcome' } })
  fireEvent.change(ranking.getByLabelText('Límite por evento'), { target: { value: '7' } })
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    gameId: 'GAME 1', preserveRewardConditions: true,
    prizeCatalog: expect.objectContaining({
      ranking: { name: 'Mi premio', limit: 7, sharedPrizeId: 'welcome', imageKey: shared[0].imageKey, topX: 3 },
    }),
  }))
  expect(onPersist).toHaveBeenCalledWith(expect.objectContaining({
    prizeCatalog: expect.any(Object), prizeTopX: 'Mi premio', maxPrizeRanking: 7, topX: 3,
  }))
})

it('uses the master name and image as read-only details in an event assignment', async () => {
  await mount()
  expect(region().getByLabelText('Premio compartido')).toHaveValue('welcome')
  expect(screen.getByRole('region', { name: 'Validación / participación' }).querySelector('img'))
    .toHaveAttribute('src', 'https://images/welcome.png')
  expect(region().queryByLabelText('Premio')).not.toBeInTheDocument()
  expect(screen.getByText('La condición top se edita en Configurar partida > Condiciones.')).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/v1/prizes/catalog')
})

it('keeps an unassigned slot empty and accepts only valid integer limits', async () => {
  await mount()
  fireEvent.change(region().getByLabelText('Premio compartido'), { target: { value: '' } })
  fireEvent.change(region().getByLabelText('Límite por evento'), { target: { value: '-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('El límite debe ser un entero')
  expect(api.put).not.toHaveBeenCalled()
  fireEvent.change(region().getByLabelText('Límite por evento'), { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await screen.findByText('Guardado.')
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    prizeCatalog: expect.objectContaining({ validation: expect.objectContaining({ name: '', limit: 0 }) }),
  }))
})

async function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await screen.findByText('Guardado.')
}

it('shows shared availability separately from optional event caps, including genuine zero', async () => {
  await mount()
  expect(region().getByText(/Disponible compartido/)).toHaveTextContent('9')
  expect(region('Ranking').getByText(/Disponible compartido/)).toHaveTextContent('0')
  fireEvent.change(region().getByLabelText('Límite por evento'), { target: { value: '' } })
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    prizeCatalog: expect.objectContaining({ validation: expect.objectContaining({ limit: null }) }),
  }))
  expect(region().getByText(/Disponible compartido/)).toHaveTextContent('9')
})

it('reports missing inventory data instead of silently showing invented stock', async () => {
  vi.mocked(api.get).mockImplementation(async url => {
    if (url === '/v1/prizes/inventory') throw new Error('Inventory unavailable')
    return { ok: true, catalog: shared, revision: 1 }
  })
  render(<OperatorLanguageProvider><OperatorPrizeSettings gameId="GAME" gameDefinition={definition}
    settings={{}} plan="event" onPersist={vi.fn()} /></OperatorLanguageProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los premios')
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  expect(api.put).not.toHaveBeenCalled()
})
