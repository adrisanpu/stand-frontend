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
  id: 'EMPAREJA2', name: 'EMPAREJA2', colors, showRanking: true,
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
    ? { ok: true, mode: 'reservations', imports: {}, unresolved: 0, catalog: [
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
  editConditions?: boolean
  readOnly?: boolean
} = {}) {
  const onPersist = vi.fn()
  render(<OperatorLanguageProvider>
    <OperatorPrizeSettings gameId="GAME 1" gameDefinition={options.game ?? definition}
      plan={options.plan ?? 'event'} settings={options.settings ?? {}} onPersist={onPersist}
      editConditions={options.editConditions} readOnly={options.readOnly} />
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
  fireEvent.change(ranking.getByLabelText('Substock reservado'), { target: { value: '7' } })
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

it.each(['EMPAREJA2', 'T1MER', 'CUPIDO'])('saves the raffle sub-stock for %s', async id => {
  await mount({ game: { ...definition, id } })
  fireEvent.change(region('Sorteo').getByRole('textbox', { name: 'Substock reservado' }), { target: { value: '12' } })
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    prizeCatalog: expect.objectContaining({
      raffle: expect.objectContaining({ sharedPrizeId: 'surprise', limit: 12 }),
    }),
  }))
  expect(region('Sorteo').getByLabelText('Substock reservado')).toHaveValue('12')
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
  fireEvent.change(region().getByLabelText('Substock reservado'), { target: { value: '-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('El límite debe ser un entero')
  expect(api.put).not.toHaveBeenCalled()
  fireEvent.change(region().getByLabelText('Substock reservado'), { target: { value: '0' } })
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
  expect(region().getByText(/Disponible general/)).toHaveTextContent('9')
  expect(region('Ranking').getByText(/Disponible general/)).toHaveTextContent('0')
  fireEvent.change(region().getByLabelText('Substock reservado'), { target: { value: '' } })
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    prizeCatalog: expect.objectContaining({ validation: expect.objectContaining({ limit: null }) }),
  }))
  expect(region().getByText(/Disponible general/)).toHaveTextContent('9')
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

it.each([
  ['EMPAREJA2', false, 'event', ['valide su participación', 'gane un sorteo']],
  ['T1MER', true, 'event', ['esté en el top del ranking', 'gane un sorteo']],
  ['L3TRAS', false, 'free', ['valide su participación']],
  ['RULET4', false, 'event', ['gane un sorteo']],
  ['INFOCARDS', false, 'event', ['gane un sorteo']],
  ['IMPOSTOR', false, 'event', ['gane un sorteo']],
] as const)('shows Stack-style native rules compatible with %s and %s on %s', async (id, showRanking, plan, conditions) => {
  await mount({ game: { ...definition, id, showRanking }, plan, editConditions: true })
  expect(screen.getByRole('table', { name: 'Condiciones' })).toBeInTheDocument()
  expect(screen.getAllByLabelText(/^Condición \d/)).toHaveLength(conditions.length)
  expect(within(screen.getByLabelText('Condición 1')).getAllByRole('option').map(option => option.textContent)).toEqual(conditions)
  expect(screen.queryByRole('option', { name: 'consiga una puntuación' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'O añadir grupo' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/Cantidad de/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Añadir regla' })).toBeDisabled()
  expect(api.put).not.toHaveBeenCalled()
})

it('adds and saves a native ranking rule with its prize, sub-stock and top, without STACK APIs', async () => {
  serverResponse.prizeCatalog = {}
  const onPersist = await mount({ game: { ...definition, id: 'T1MER' }, editConditions: true })
  expect(screen.queryByRole('table', { name: 'Condiciones' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  expect(screen.getByLabelText('Condición 1')).toHaveValue('ranking')
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Premio de la regla 1'), { target: { value: 'welcome' } })
  fireEvent.change(screen.getByLabelText('Puestos premiados (top)'), { target: { value: '7' } })
  fireEvent.change(screen.getByLabelText('Substock de la regla 1'), { target: { value: '12' } })
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    preserveRewardConditions: false, prizeCatalog: expect.objectContaining({
      ranking: expect.objectContaining({ sharedPrizeId: 'welcome', topX: 7, limit: 12 }),
    }),
  }))
  expect(onPersist).toHaveBeenCalledWith(expect.objectContaining({ topX: 7, maxPrizeRanking: 12 }))
  expect(vi.mocked(api.get).mock.calls.some(([url]) => url.includes('/stack/'))).toBe(false)
})

it('removes a rule and clears only its assignment while preserving other and hidden conditions', async () => {
  await mount({ plan: 'free', editConditions: true })
  fireEvent.click(screen.getByRole('button', { name: 'Quitar regla 1' }))
  expect(screen.getByLabelText('Condición 1')).toHaveValue('ranking')
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    prizeCatalog: expect.objectContaining({
      validation: expect.objectContaining({ name: '', limit: null }),
      ranking: expect.objectContaining({ sharedPrizeId: 'podium', topX: 3 }),
      raffle: expect.objectContaining({ sharedPrizeId: 'surprise', limit: 2 }),
    }),
  }))
})

it('switches an unused native condition without duplicating a prize rule', async () => {
  serverResponse.prizeCatalog = { validation: initialCatalog.validation }
  await mount({ editConditions: true })
  fireEvent.change(screen.getByLabelText('Condición 1'), { target: { value: 'ranking' } })
  expect(screen.getByLabelText('Premio de la regla 1')).toHaveValue('welcome')
  fireEvent.change(screen.getByLabelText('Puestos premiados (top)'), { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  expect(screen.getByLabelText('Condición 2')).toHaveValue('validation')
  expect(within(screen.getByLabelText('Condición 2')).getByRole('option', { name: 'esté en el top del ranking' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar regla 2' }))
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    prizeCatalog: expect.objectContaining({
      validation: expect.objectContaining({ name: '', limit: null }),
      ranking: expect.objectContaining({ sharedPrizeId: 'welcome', topX: 5, limit: 4 }),
    }),
  }))
})

it('retains legacy prizes in the rule editor until explicitly replaced', async () => {
  serverResponse.prizeCatalog = { validation: { name: 'Legacy cup', limit: 8, imageKey: 'old.png' } }
  await mount({ editConditions: true })
  expect(screen.getByRole('option', { name: 'Legacy cup' })).toHaveValue('legacy')
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    prizeCatalog: expect.objectContaining({ validation: expect.objectContaining({ name: 'Legacy cup', limit: 8, imageKey: 'old.png' }) }),
  }))
})

it('rejects invalid native rule parameters before writing and permits correction', async () => {
  await mount({ editConditions: true })
  fireEvent.click(screen.getByRole('radio', { name: 'Seleccionar regla 2' }))
  fireEvent.change(screen.getByLabelText('Puestos premiados (top)'), { target: { value: '101' } })
  fireEvent.change(screen.getByLabelText('Substock de la regla 2'), { target: { value: '-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('El substock debe ser un entero')
  expect(api.put).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Puestos premiados (top)'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Substock de la regla 2'), { target: { value: '0' } })
  await save()
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    prizeCatalog: expect.objectContaining({ ranking: expect.objectContaining({ topX: 5, limit: 0 }) }),
  }))
})

it('shows rule save failures explicitly without discarding the draft or reporting success', async () => {
  await mount({ editConditions: true })
  vi.mocked(api.put).mockRejectedValue(new Error('ReservationBelowAssigned'))
  fireEvent.change(screen.getByLabelText('Substock de la regla 1'), { target: { value: '8' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('ReservationBelowAssigned')
  expect(screen.getByLabelText('Substock de la regla 1')).toHaveValue('8')
  expect(screen.queryByText('Guardado.')).not.toBeInTheDocument()
})

it('keeps the native rules read-only when the event is inactive', async () => {
  render(<OperatorLanguageProvider><OperatorPrizeSettings gameId="GAME" gameDefinition={definition}
    settings={{}} plan="event" onPersist={vi.fn()} editConditions readOnly /></OperatorLanguageProvider>)
  expect(await screen.findByLabelText('Condición 1')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Añadir regla' })).toBeDisabled()
  expect(screen.getByLabelText('Premio de la regla 1')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument()
  expect(api.put).not.toHaveBeenCalled()
})

it('blocks setup readiness for unsaved and incomplete rules until they are saved or removed', async () => {
  serverResponse.prizeCatalog = {}
  const onReadyChange = vi.fn()
  render(<OperatorLanguageProvider><OperatorPrizeSettings gameId="GAME" gameDefinition={definition}
    settings={{}} plan="event" onPersist={vi.fn()} editConditions onReadyChange={onReadyChange} /></OperatorLanguageProvider>)
  await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(true))
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(false))
  expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  expect(screen.getByText('Selecciona un premio o elimina esta regla antes de guardar.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar regla 1' }))
  await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(true))
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  fireEvent.change(screen.getByLabelText('Premio de la regla 1'), { target: { value: 'welcome' } })
  expect(onReadyChange).toHaveBeenLastCalledWith(false)
  await save()
  await waitFor(() => expect(onReadyChange).toHaveBeenLastCalledWith(true))
})
