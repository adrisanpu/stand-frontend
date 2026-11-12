import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { prizeInventoryApi, type PrizeInventory as Inventory } from '../../api/prizeInventory'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import { saveGamePrizeCap } from '../../api/prizeGameCaps'
import PrizeInventory from './PrizeInventory'

vi.mock('../../api/prizeGameCaps', () => ({ saveGamePrizeCap: vi.fn() }))
vi.mock('../../api/prizeInventory', () => ({
  prizeInventoryApi: { get: vi.fn(), movements: vi.fn(), importHistory: vi.fn(), removeKivlyPrize: vi.fn() },
}))
let data: Inventory
beforeEach(() => {
  vi.resetAllMocks()
  data = {
    ok: true, mode: 'reservations', unresolved: 0, imports: { event: true },
    catalog: [
      { id: 'gift', name: 'Gift', source: 'stand', games: [{ gameId: 'event', name: 'Event One', active: true, limit: 5 }],
        inventory: { initialized: true, available: 0, assigned: 3, historicalAssigned: 7, redeemed: 1, historicalRedeemed: 2, revision: 4 },
        canjeados: 3, reservation: { total: 10, available: 0, assigned: 10, redeemed: 3, error: null } },
      { id: 'coffee', name: 'Coffee', source: 'kivly', games: [],
        inventory: { initialized: false, available: 0, assigned: 0, historicalAssigned: 0, redeemed: 0, historicalRedeemed: 0, revision: 0 },
        canjeados: null, reservation: { total: 0, available: 0, assigned: 0, redeemed: null, error: null } },
    ],
  }
  vi.mocked(prizeInventoryApi.get).mockImplementation(async () => structuredClone(data))
  vi.mocked(prizeInventoryApi.movements).mockResolvedValue({ ok: true, items: [], cursor: null })
})
afterEach(cleanup)
const mount = () => render(<OperatorLanguageProvider><PrizeInventory /></OperatorLanguageProvider>)
async function row(name: string) {
  return within((await screen.findByRole('rowheader', { name })).closest('tr')!)
}
async function selectPrize(name: string) {
  const radio = await screen.findByRole('radio', { name: `Seleccionar ${name}` })
  fireEvent.click(radio.closest('tr')!)
}
it('deletes an uninitialized unused Kivly prize from both catalogs after confirmation', async () => {
  vi.mocked(prizeInventoryApi.removeKivlyPrize).mockImplementation(async id => {
    data.catalog = data.catalog.filter(item => item.id !== id)
  })
  mount()
  await selectPrize('Coffee')
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar de STAND y Kivly' }))
  expect(prizeInventoryApi.removeKivlyPrize).not.toHaveBeenCalled()
  expect(screen.getByRole('alertdialog')).toHaveTextContent('catálogo de Kivly')
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))
  await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Coffee' })).not.toBeInTheDocument())
  expect(prizeInventoryApi.removeKivlyPrize).toHaveBeenCalledTimes(1)
  expect(prizeInventoryApi.removeKivlyPrize).toHaveBeenCalledWith('coffee')
})

it.each(['linked', 'initialized', 'history'] as const)('protects Kivly prizes with %s', async state => {
  const coffee = data.catalog[1]
  if (state === 'linked') coffee.games = [{ gameId: 'old', name: 'Old', active: false, limit: null }]
  if (state === 'initialized') coffee.inventory.initialized = true
  if (state === 'history') coffee.inventory.historicalAssigned = 1
  mount()
  await selectPrize('Coffee')
  expect(screen.getByRole('button', { name: 'Eliminar de STAND y Kivly' })).toBeDisabled()
  expect(prizeInventoryApi.removeKivlyPrize).not.toHaveBeenCalled()
})

it('requires a manual inventory refresh before retrying an uncertain deletion', async () => {
  vi.mocked(prizeInventoryApi.removeKivlyPrize).mockRejectedValue(new Error('Network failed'))
  mount()
  await selectPrize('Coffee')
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar de STAND y Kivly' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Actualiza el inventario antes de reintentar')
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Eliminar de STAND y Kivly' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar inventario' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Eliminar de STAND y Kivly' })).toBeEnabled())
})
it('shows read-only stock, a distribution bar and linked event counts', async () => {
  mount()
  const gift = await row('Gift')
  expect(screen.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Selección', 'Foto', 'Nombre', 'Origen', 'Stock', 'Distribución', 'Partidas',
  ])
  expect(gift.getAllByRole('cell')[3]).toHaveTextContent(/^10$/)
  expect(gift.getByRole('img', { name: 'Disponible: 0 (0%) · Repartido: 7 (70%) · Canjeado: 3 (30%)' })).toBeInTheDocument()
  expect(gift.getAllByRole('cell')[5]).toHaveTextContent(/^1$/)
  const coffee = await row('Coffee')
  expect(coffee.getAllByRole('cell')[3]).toHaveTextContent(/^0$/)
  expect(coffee.getAllByRole('cell')[4]).toHaveTextContent('0')
  expect(coffee.getAllByRole('cell')[5]).toHaveTextContent('Ninguna')
  expect(screen.queryByText(/Modo anterior: cada partida conserva/)).not.toBeInTheDocument()
  await selectPrize('Gift')
  expect(gift.queryByRole('textbox')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }))
  expect(screen.getByText(/Canjeados históricos/)).toHaveTextContent('Repartidos históricos: 7')
})

it.each(['focus', 'visibilitychange'])('refreshes event sub-stocks automatically on %s', async event => {
  data.catalog[0].reservation = { total: 5, available: 5, assigned: 0, redeemed: 0, error: null }
  mount()
  await selectPrize('Gift')
  data.catalog[0].games[0].limit = 12
  data.catalog[0].games[0].remaining = 12
  data.catalog[0].games[0].assigned = 0
  data.catalog[0].reservation = { total: 12, available: 12, assigned: 0, redeemed: 0, error: null }
  if (event === 'focus') fireEvent.focus(window)
  else fireEvent(document, new Event('visibilitychange'))
  await waitFor(() => expect(within(screen.getByRole('rowheader', { name: 'Gift' }).closest('tr')!)
    .getAllByRole('cell')[3]).toHaveTextContent(/^12$/))
  const allocation = within(screen.getByRole('table', { name: 'Reparto por partida' }))
  expect(within(allocation.getByRole('rowheader', { name: 'Event One' }).closest('tr')!)
    .getAllByRole('cell')[1]).toHaveTextContent(/^12$/)
})

it('keeps the latest reservations when automatic refresh responses arrive out of order', async () => {
  mount()
  await row('Gift')
  let resolveOlder!: (value: Inventory) => void
  vi.mocked(prizeInventoryApi.get).mockImplementationOnce(() => new Promise(resolve => { resolveOlder = resolve }))
  const older = structuredClone(data)
  fireEvent.focus(window)
  data.catalog[0].reservation = { total: 12, available: 12, assigned: 0, redeemed: 0, error: null }
  fireEvent.focus(window)
  const stockCell = () => within(screen.getByRole('rowheader', { name: 'Gift' }).closest('tr')!).getAllByRole('cell')[3]
  await waitFor(() => expect(stockCell()).toHaveTextContent(/^12$/))
  await act(async () => { resolveOlder(older) })
  expect(stockCell()).toHaveTextContent(/^12$/)
})

it('reports an automatic refresh failure and removes listeners on unmount', async () => {
  const { unmount } = mount()
  await row('Gift')
  vi.mocked(prizeInventoryApi.get).mockRejectedValueOnce(new Error('Refresh failed'))
  fireEvent.focus(window)
  expect(await screen.findByRole('alert')).toHaveTextContent('Refresh failed')
  const calls = vi.mocked(prizeInventoryApi.get).mock.calls.length
  unmount()
  fireEvent.focus(window)
  expect(prizeInventoryApi.get).toHaveBeenCalledTimes(calls)
})

it('shows read-only sub-stocks with a per-event chart below the selected row; a second click closes it', async () => {
  Object.assign(data.catalog[0].games[0], { assigned: 3, remaining: 2, redeemed: 1 })
  data.catalog[0].games.push({ gameId: 'old', name: 'Old event', active: false, limit: 15, remaining: 15, assigned: 0, redeemed: 0 })
  vi.mocked(prizeInventoryApi.movements).mockResolvedValue({ ok: true, cursor: null, items: [
    { key: 'a', prizeId: 'gift', kind: 'assignment', quantity: 3, historical: false, createdAt: '2026-01-01', gameId: 'event',
      units: { u1: { state: 'delivered', condition: 'ranking' }, u2: { state: 'available', condition: 'ranking' } } },
  ] })
  mount()
  await selectPrize('Gift')
  const giftRow = screen.getByRole('rowheader', { name: 'Gift' }).closest('tr')!
  const detail = screen.getByRole('region', { name: 'Detalle: Gift' })
  expect(giftRow.nextElementSibling).toContainElement(detail)
  expect(await within(detail).findByRole('img', { name: 'Disponible: 2 (40%) · Repartido: 2 (40%) · Canjeado: 1 (20%)' })).toBeInTheDocument()
  expect(within(detail).getByRole('img', { name: 'Disponible: 15 (100%) · Repartido: 0 (0%) · Canjeado: 0 (0%)' })).toBeInTheDocument()
  expect(within(detail).getByText('Inactiva')).toBeInTheDocument()
  const event = within(within(detail).getByRole('rowheader', { name: 'Event One' }).closest('tr')!)
  expect(event.getAllByRole('cell')[1]).toHaveTextContent(/^5$/)
  expect(within(detail).queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar reparto' })).not.toBeInTheDocument()
  expect(saveGamePrizeCap).not.toHaveBeenCalled()
  expect(prizeInventoryApi.movements).not.toHaveBeenCalled()
  await selectPrize('Coffee')
  expect(screen.queryByRole('region', { name: 'Detalle: Gift' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Detalle: Coffee' })).toHaveTextContent('no está asignado a ninguna partida')
  await selectPrize('Coffee')
  expect(screen.queryByRole('region', { name: 'Detalle: Coffee' })).not.toBeInTheDocument()
})

it.each(['uninitialized', 'pending-history', 'invalid-counters'] as const)(
  'uses event reservations independently of legacy %s', async state => {
    if (state === 'uninitialized') data.catalog[0].inventory.initialized = false
    if (state === 'pending-history') data.unresolved = 1
    if (state === 'invalid-counters') data.catalog[0].canjeados = 11
    mount()
    const gift = await row('Gift')
    expect(gift.getAllByRole('cell')[3]).toHaveTextContent(/^10$/)
  },
)

it('paginates movements with retry and client filters that explicitly apply to loaded rows', async () => {
  vi.mocked(prizeInventoryApi.movements)
    .mockResolvedValueOnce({ ok: true, cursor: 'next', items: [
      { key: 'one', prizeId: 'gift', kind: 'assignment', quantity: 1, historical: true, createdAt: '2026-01-01', gameId: 'event', gameName: 'Event One',
        units: { award: { state: 'delivered', condition: 'ranking' } } },
    ] })
    .mockRejectedValueOnce(new Error('Page failed'))
    .mockResolvedValueOnce({ ok: true, cursor: null, items: [
      { key: 'two', prizeId: 'gift', kind: 'replenish', quantity: 4, historical: false, createdAt: '2026-02-01', reason: 'New shipment' },
    ] })
  mount()
  await selectPrize('Gift')
  fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }))
  await screen.findByText('award: delivered · ranking')
  expect(screen.getByText(/Los filtros solo afectan a las filas cargadas/)).toHaveTextContent('(1)')
  fireEvent.click(screen.getByRole('button', { name: 'Cargar más movimientos' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar página' }))
  await screen.findByText('New shipment')
  expect(vi.mocked(prizeInventoryApi.movements).mock.calls).toEqual([['gift', undefined], ['gift', 'next'], ['gift', 'next']])
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'delivered' } })
  expect(screen.queryByText('New shipment')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Estado'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'replenish' } })
  expect(screen.getByText('New shipment')).toBeInTheDocument()
  expect(screen.queryByText('award: delivered · ranking')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Partida'), { target: { value: 'event' } })
  expect(screen.queryByText('New shipment')).not.toBeInTheDocument()
})

it('automatically imports every page and retains failed cursors without an activation step', async () => {
  data.imports.event = false
  vi.mocked(prizeInventoryApi.importHistory)
    .mockResolvedValueOnce({ ok: true, cursor: 'players:page-two+/=', unresolved: 0 })
    .mockRejectedValueOnce(new Error('Import failed'))
    .mockImplementationOnce(async () => {
      data.imports.event = true
      return { ok: true, cursor: null, unresolved: 0 }
    })

  mount()
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar importación' }))
  await waitFor(() => expect(screen.queryByLabelText('Histórico de premios')).not.toBeInTheDocument())
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([['event', undefined], ['event', 'players:page-two+/='], ['event', 'players:page-two+/=']])
  expect(screen.queryByRole('button', { name: 'Activar inventario compartido' })).not.toBeInTheDocument()
})

it('imports all response games including archived and empty catalogs, preserving a 140-character opaque cursor', async () => {
  data.imports = { event: true, 'archived-no-catalog': false, 'empty-catalog': true }
  data.catalog[0].games.push({ gameId: 'not-in-imports', name: 'Not an import target', active: false, limit: null })
  const cursor = `players:${'x'.repeat(132)}`
  expect(cursor).toHaveLength(140)
  vi.mocked(prizeInventoryApi.importHistory)
    .mockResolvedValueOnce({ ok: true, cursor, unresolved: 0 })
    .mockImplementationOnce(async () => {
      data.imports['archived-no-catalog'] = true
      return { ok: true, cursor: null, unresolved: 0 }
    })
  mount()
  await waitFor(() => expect(prizeInventoryApi.importHistory).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByLabelText('Histórico de premios')).not.toBeInTheDocument())
  expect(screen.queryByLabelText('Histórico de premios')).not.toBeInTheDocument()
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([
    ['archived-no-catalog', undefined], ['archived-no-catalog', cursor],
  ])
})

it('continues importing other games after one fails, including in active mode', async () => {
  data.imports = { event: false, archive: false, empty: false }
  vi.mocked(prizeInventoryApi.importHistory).mockImplementation(async (id, cursor) => {
    if (id === 'event') throw new Error('Unlinked historical prize')
    if (id === 'archive' && !cursor) return { ok: true, cursor: 'players:42', unresolved: 0 }
    data.imports[id] = true
    return { ok: true, cursor: null, unresolved: 0 }
  })
  mount()
  await screen.findByRole('alert')
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([
    ['event', undefined], ['archive', undefined], ['archive', 'players:42'], ['empty', undefined],
  ])
  expect(screen.getByText('archive: Importación completa')).toBeInTheDocument()
  expect(screen.getByText('empty: Importación completa')).toBeInTheDocument()
  expect(screen.queryByText('Históricos actualizados automáticamente.')).not.toBeInTheDocument()
})

it('stops at unresolved history without an automatic retry loop', async () => {
  data.imports.event = false
  vi.mocked(prizeInventoryApi.importHistory).mockImplementation(async () => {
    data.unresolved = 1
    return { ok: true, cursor: null, unresolved: 1 }
  })
  mount()
  await screen.findByRole('button', { name: 'Reintentar importación' })
  expect(prizeInventoryApi.importHistory).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Activar inventario compartido' })).not.toBeInTheDocument()
  vi.mocked(prizeInventoryApi.importHistory).mockImplementationOnce(async () => {
    data.unresolved = 0; data.imports.event = true
    return { ok: true, cursor: null, unresolved: 0 }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar importación' }))
  await waitFor(() => expect(screen.queryByLabelText('Histórico de premios')).not.toBeInTheDocument())
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([['event', undefined], ['event', undefined]])
})

it('does not duplicate imports under StrictMode', async () => {
  data.imports.event = false
  vi.mocked(prizeInventoryApi.importHistory).mockImplementation(async (_id, cursor) => {
    if (!cursor) return { ok: true, cursor: 'players:', unresolved: 0 }
    data.imports.event = true
    return { ok: true, cursor: null, unresolved: 0 }
  })
  render(<StrictMode><OperatorLanguageProvider><PrizeInventory /></OperatorLanguageProvider></StrictMode>)
  await waitFor(() => expect(prizeInventoryApi.importHistory).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(screen.queryByLabelText('Histórico de premios')).not.toBeInTheDocument())
  expect(screen.queryByLabelText('Histórico de premios')).not.toBeInTheDocument()
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([
    ['event', undefined], ['event', 'players:'],
  ])
})

it('hides successful migration details and initialization instructions', async () => {
  mount()
  await row('Gift')
  expect(screen.queryByText('Históricos actualizados automáticamente.')).not.toBeInTheDocument()
  expect(screen.queryByText(/Estado por partida/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Sin resolver: 0/)).not.toBeInTheDocument()
  expect(screen.queryByText(/inicializa todos los premios/)).not.toBeInTheDocument()
})

it('shows stock as summed exclusive reservations even without manual initialization', async () => {
  data.catalog[0].inventory.initialized = false
  data.catalog[0].games = [
    { gameId: 'event', name: 'Event One', active: true, limit: 10, assigned: 3, redeemed: 1, remaining: 7 },
    { gameId: 'old', name: 'Old event', active: false, limit: 20, assigned: 2, redeemed: 1, remaining: 18 },
  ]
  data.catalog[0].reservation = { total: 30, available: 25, assigned: 5, redeemed: 2, error: null }
  mount()
  const gift = await row('Gift')
  expect(gift.getAllByRole('cell')[3]).toHaveTextContent(/^30$/)
  expect(gift.getByRole('img', { name: 'Disponible: 25 (83%) · Repartido: 3 (10%) · Canjeado: 2 (7%)' })).toBeInTheDocument()
  await selectPrize('Gift')
  const detail = screen.getByRole('region', { name: 'Detalle: Gift' })
  expect(within(detail).getByRole('img', { name: 'Disponible: 7 (70%) · Repartido: 2 (20%) · Canjeado: 1 (10%)' })).toBeInTheDocument()
  expect(within(detail).getByRole('img', { name: 'Disponible: 18 (90%) · Repartido: 1 (5%) · Canjeado: 1 (5%)' })).toBeInTheDocument()
  expect(prizeInventoryApi.movements).not.toHaveBeenCalled()
})

it('reports missing reservation quantities instead of guessing a total', async () => {
  data.catalog[0].reservation = { total: null, available: null, assigned: 0, redeemed: 0, error: 'EventReservationRequired' }
  data.catalog[0].games[0].limit = null
  mount()
  const gift = await row('Gift')
  expect(gift.getAllByRole('cell')[3]).toHaveTextContent('Define los substocks')
  await selectPrize('Gift')
  expect(screen.getByRole('alert')).toHaveTextContent('Define un substock numérico')
  expect(screen.queryByText('Sin inicializar')).not.toBeInTheDocument()
})

it('imports games discovered during another import without automatically retrying failures', async () => {
  data.imports = { event: false }
  let reject!: (error: Error) => void
  vi.mocked(prizeInventoryApi.importHistory)
    .mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail }))
    .mockImplementationOnce(async () => {
      data.imports.archive = true
      return { ok: true, cursor: null, unresolved: 0 }
    })
  const { rerender } = mount()
  await waitFor(() => expect(prizeInventoryApi.importHistory).toHaveBeenCalledTimes(1))
  data.imports.archive = false
  rerender(<OperatorLanguageProvider><PrizeInventory catalogVersion={1} /></OperatorLanguageProvider>)
  await screen.findByText('archive: Pendiente de conciliar')
  await act(async () => { reject(new Error('Unlinked historical prize')) })
  await screen.findByText('archive: Importación completa')
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([
    ['event', undefined], ['archive', undefined],
  ])
  expect(screen.getByRole('alert')).toHaveTextContent('Unlinked historical prize')
})

it('refreshes an open movement panel after historical import completes', async () => {
  data.imports.event = false
  let resolve!: (page: { ok: true; cursor: string | null; unresolved: number }) => void
  vi.mocked(prizeInventoryApi.importHistory).mockReturnValue(new Promise(done => { resolve = done }))
  vi.mocked(prizeInventoryApi.movements)
    .mockResolvedValueOnce({ ok: true, cursor: null, items: [] })
    .mockResolvedValueOnce({ ok: true, cursor: null, items: [
      { key: 'imported', prizeId: 'gift', kind: 'assignment', quantity: 1, historical: true,
        createdAt: '2026-01-01', gameId: 'event', gameName: 'Imported event' },
    ] })
  mount()
  await selectPrize('Gift')
  fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }))
  await screen.findByText('Sin movimientos cargados para estos filtros.')
  data.imports.event = true
  await act(async () => { resolve({ ok: true, cursor: null, unresolved: 0 }) })
  await screen.findByText(/2026-01-01 · assignment · 1 · Imported event/)
  expect(prizeInventoryApi.movements).toHaveBeenCalledTimes(2)
})

it('does not start another page after leaving the panel', async () => {
  data.imports.event = false
  let resolve!: (page: { ok: true; cursor: string | null; unresolved: number }) => void
  vi.mocked(prizeInventoryApi.importHistory).mockReturnValue(new Promise(done => { resolve = done }))
  const { unmount } = mount()
  await waitFor(() => expect(prizeInventoryApi.importHistory).toHaveBeenCalledTimes(1))
  unmount()
  resolve({ ok: true, cursor: 'players:', unresolved: 0 })
  await new Promise(done => setTimeout(done, 0))
  expect(prizeInventoryApi.importHistory).toHaveBeenCalledTimes(1)
})

it.each(['uninitialized', 'unresolved'] as const)('has no legacy activation for %s', async condition => {
  if (condition === 'uninitialized') data.catalog[0].inventory.initialized = false
  else data.unresolved = 1
  mount()
  await row('Gift')
  expect(screen.queryByRole('button', { name: 'Activar inventario compartido' })).not.toBeInTheDocument()
  if (condition === 'unresolved') {
    expect(screen.queryByText('Históricos actualizados automáticamente.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Histórico de premios')).toHaveTextContent('Sin resolver: 1')
  }
})

it('reports load failures and supports reload', async () => {
  vi.mocked(prizeInventoryApi.get).mockRejectedValueOnce(new Error('Load failed'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Load failed')
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar inventario' }))
  await row('Gift')
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})
