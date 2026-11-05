import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { prizeInventoryApi, type PrizeInventory as Inventory } from '../../api/prizeInventory'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import PrizeInventory from './PrizeInventory'

vi.mock('../../api/prizeInventory', () => ({
  prizeInventoryApi: { get: vi.fn(), change: vi.fn(), movements: vi.fn(), importHistory: vi.fn(), activate: vi.fn() },
}))
let data: Inventory
beforeEach(() => {
  vi.resetAllMocks()
  data = {
    ok: true, mode: 'legacy', unresolved: 0, imports: { event: true },
    catalog: [
      { id: 'gift', name: 'Gift', source: 'stand', games: [{ gameId: 'event', name: 'Event One', active: true, limit: 5 }],
        inventory: { initialized: true, available: 0, assigned: 3, historicalAssigned: 7, redeemed: 1, historicalRedeemed: 2, revision: 4 },
        canjeados: 3 },
      { id: 'coffee', name: 'Coffee', source: 'kivly', games: [],
        inventory: { initialized: false, available: 0, assigned: 0, historicalAssigned: 0, redeemed: 0, historicalRedeemed: 0, revision: 0 },
        canjeados: null },
    ],
  }
  vi.mocked(prizeInventoryApi.get).mockImplementation(async () => structuredClone(data))
  vi.mocked(prizeInventoryApi.change).mockImplementation(async payload => {
    const prize = data.catalog.find(item => item.id === payload.prizeId)!
    prize.inventory = { ...prize.inventory, initialized: true, revision: payload.expectedRevision + 1,
      available: payload.action === 'initialize' ? payload.quantity : prize.inventory.available + payload.quantity }
    return structuredClone(prize.inventory)
  })
  vi.mocked(prizeInventoryApi.activate).mockImplementation(async () => { data.mode = 'active' })
  vi.mocked(prizeInventoryApi.movements).mockResolvedValue({ ok: true, items: [], cursor: null })
})
afterEach(cleanup)
const mount = () => render(<OperatorLanguageProvider><PrizeInventory /></OperatorLanguageProvider>)
async function row(name: string) {
  return within((await screen.findByRole('rowheader', { name })).closest('tr')!)
}
async function selectPrize(name: string) {
  fireEvent.click(await screen.findByRole('radio', { name: `Seleccionar ${name}` }))
}
async function openStock(name = 'Gift') {
  mount()
  await selectPrize(name)
  fireEvent.click(screen.getByRole('button', { name: 'Gestionar saldo' }))
}
function draft(quantity = '2', reason = 'Physical count') {
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: quantity } })
  fireEvent.change(screen.getByLabelText('Motivo obligatorio'), { target: { value: reason } })
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

it('distinguishes initialized zero, unknown Kivly, explicit redemptions, historical totals and active caps', async () => {
  mount()
  const gift = await row('Gift')
  expect(screen.getAllByRole('columnheader').map(cell => cell.textContent)).toEqual([
    'Selección', 'Foto', 'Nombre', 'Origen', 'Stock', 'Disponibles', 'Canjeados', 'Repartidos', 'Partidas',
  ])
  expect(gift.getAllByRole('cell')[3]).toHaveTextContent(/^7$/)
  expect(gift.getAllByRole('cell')[4]).toHaveTextContent(/^0$/)
  expect(gift.getAllByRole('cell')[5]).toHaveTextContent(/^3$/)
  expect(gift.getAllByRole('cell')[6]).toHaveTextContent(/^10$/)
  fireEvent.click(gift.getByText('Ver partidas (1)'))
  expect(gift.getByText('Event One · 5')).toBeInTheDocument()
  expect(gift.queryByText(/Canjeados históricos/)).not.toBeInTheDocument()
  await selectPrize('Gift')
  fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }))
  expect(screen.getByText(/Canjeados históricos/)).toHaveTextContent('Repartidos históricos: 7')
  const coffee = await row('Coffee')
  expect(coffee.getAllByRole('cell')[3]).toHaveTextContent('Desconocido')
  expect(coffee.getAllByRole('cell')[4]).toHaveTextContent('Sin inicializar')
  expect(coffee.getAllByRole('cell')[5]).toHaveTextContent('Desconocido')
  expect(screen.getByText(/Modo anterior: cada partida conserva/)).toBeInTheDocument()
})

it('opens one compact detail immediately below its prize and switches between prizes', async () => {
  mount()
  await selectPrize('Gift')
  fireEvent.click(screen.getByRole('button', { name: 'Gestionar saldo' }))
  const giftRow = screen.getByRole('rowheader', { name: 'Gift' }).closest('tr')!
  expect(giftRow.nextElementSibling).toContainElement(screen.getByRole('region', { name: 'Detalle: Gift' }))
  expect(screen.getByRole('button', { name: 'Gestionar saldo' })).toHaveAttribute('aria-expanded', 'true')
  await selectPrize('Coffee')
  fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' }))
  expect(screen.queryByRole('region', { name: 'Detalle: Gift' })).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Detalle: Coffee' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Cantidad')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar detalle' }))
  expect(screen.queryByRole('region', { name: 'Detalle: Coffee' })).not.toBeInTheDocument()
})

it('keeps all linked games informational, including inactive games and unlimited caps', async () => {
  data.catalog[0].games.push({ gameId: 'old', name: 'Old event', active: false, limit: null })
  mount()
  const gift = await row('Gift')
  const summary = gift.getByText('Ver partidas (2)')
  expect(summary.closest('details')).not.toHaveAttribute('open')
  fireEvent.click(summary)
  expect(summary.closest('details')).toHaveAttribute('open')
  expect(gift.getByText('Activa')).toBeInTheDocument()
  expect(gift.getByText('Inactiva')).toBeInTheDocument()
  expect(gift.getByText('Old event · Sin límite')).toBeInTheDocument()
  expect(gift.queryByRole('combobox')).not.toBeInTheDocument()
})

it.each(['uninitialized', 'pending-history', 'invalid-counters'] as const)(
  'does not invent physical stock for %s', async state => {
    if (state === 'uninitialized') data.catalog[0].inventory.initialized = false
    if (state === 'pending-history') data.unresolved = 1
    if (state === 'invalid-counters') data.catalog[0].canjeados = 11
    mount()
    const gift = await row('Gift')
    expect(gift.getAllByRole('cell')[3]).toHaveTextContent(state === 'uninitialized' ? 'Sin inicializar' : 'Desconocido')
    if (state === 'invalid-counters') {
      await selectPrize('Gift')
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ver movimientos' })) })
      expect(screen.getByRole('alert')).toHaveTextContent('Los canjes superan los repartos registrados')
    }
  },
)

it('keeps an uncertain stock request mounted until it is retried or edited', async () => {
  vi.mocked(prizeInventoryApi.change).mockRejectedValueOnce(new Error('Response lost'))
  await openStock()
  draft(); submit()
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Cerrar detalle' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Seleccionar Coffee' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Ver movimientos' })).toBeDisabled()
  draft('3')
  expect(screen.getByRole('button', { name: 'Cerrar detalle' })).toBeEnabled()
})

it('keeps the identical payload and requestId after uncertain failure even when summary refreshes', async () => {
  vi.mocked(prizeInventoryApi.change).mockRejectedValueOnce(new Error('Network interrupted'))
  await openStock()
  draft()
  submit()
  expect(await screen.findByRole('alert')).toHaveTextContent('Resultado no confirmado')
  const first = vi.mocked(prizeInventoryApi.change).mock.calls[0][0]
  expect(first).toMatchObject({ action: 'replenish', quantity: 2, reason: 'Physical count', expectedRevision: 4 })
  data.catalog[0].inventory.revision = 8
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar inventario' }))
  await waitFor(() => expect(prizeInventoryApi.get).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar operación' }))
  await screen.findByText('Operación confirmada.')
  expect(vi.mocked(prizeInventoryApi.change).mock.calls[1][0]).toEqual(first)
  expect(first.requestId).toBeTruthy()
})

it('creates a new request only after the user edits the draft', async () => {
  vi.mocked(prizeInventoryApi.change).mockRejectedValueOnce(new Error('Network interrupted'))
  await openStock()
  draft()
  submit()
  await screen.findByRole('alert')
  const first = vi.mocked(prizeInventoryApi.change).mock.calls[0][0]
  draft('3')
  submit()
  await screen.findByText('Operación confirmada.')
  const second = vi.mocked(prizeInventoryApi.change).mock.calls[1][0]
  expect(second.quantity).toBe(3)
  expect(second.requestId).not.toBe(first.requestId)
})

it('retries an uncertain signed adjustment unchanged even if refreshed stock is already reduced', async () => {
  data.catalog[0].inventory.available = 5
  vi.mocked(prizeInventoryApi.change).mockRejectedValueOnce(new Error('Response lost'))
  await openStock()
  fireEvent.change(screen.getByLabelText('Operación'), { target: { value: 'adjust' } })
  draft('-5'); submit()
  await screen.findByRole('alert')
  const first = vi.mocked(prizeInventoryApi.change).mock.calls[0][0]
  data.catalog[0].inventory.available = 0
  data.catalog[0].inventory.revision = 5
  vi.mocked(prizeInventoryApi.change).mockResolvedValueOnce(data.catalog[0].inventory)
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar inventario' }))
  await waitFor(() => expect(prizeInventoryApi.get).toHaveBeenCalledTimes(2))
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar operación' }))
  await screen.findByText('Operación confirmada.')
  expect(vi.mocked(prizeInventoryApi.change).mock.calls[1][0]).toEqual(first)
})

it('requires a reload after a revision conflict and uses the refreshed revision', async () => {
  vi.mocked(prizeInventoryApi.change).mockRejectedValueOnce(Object.assign(new Error('Revision conflict'), { status: 409 }))
  await openStock()
  draft(); submit()
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Cantidad')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Reintentar operación' })).toBeDisabled()
  data.catalog[0].inventory.revision = 9
  fireEvent.click(screen.getByRole('button', { name: 'Recargar saldos' }))
  await waitFor(() => expect(screen.getByLabelText('Cantidad')).toBeEnabled())
  draft(); submit()
  await screen.findByText('Operación confirmada.')
  expect(vi.mocked(prizeInventoryApi.change).mock.calls[1][0].expectedRevision).toBe(9)
})

it('initializes current physical stock with zero even with no active games', async () => {
  await openStock('Coffee')
  draft('0')
  submit()
  await screen.findByText('Operación confirmada.')
  expect(prizeInventoryApi.change).toHaveBeenCalledWith(expect.objectContaining({ action: 'initialize', prizeId: 'coffee', quantity: 0 }))
  expect(screen.getByLabelText('Operación')).toHaveValue('replenish')
})

it('rejects missing reasons, zero replenish and adjustments below zero; accepts signed adjustments', async () => {
  data.catalog[0].inventory.available = 5
  await openStock()
  draft('2', ' ')
  submit()
  await screen.findByRole('alert')
  draft('0')
  submit()
  expect(prizeInventoryApi.change).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Operación'), { target: { value: 'adjust' } })
  for (const invalid of ['-6', '-1.5', 'NaN', 'Infinity', '9007199254740992']) {
    draft(invalid)
    submit()
    expect(prizeInventoryApi.change).not.toHaveBeenCalled()
  }
  draft('-5')
  submit()
  await screen.findByText('Operación confirmada.')
  expect(prizeInventoryApi.change).toHaveBeenCalledWith(expect.objectContaining({ action: 'adjust', quantity: -5 }))
})

it('does not send another stock write when a confirmed write cannot refresh', async () => {
  await openStock()
  vi.mocked(prizeInventoryApi.get).mockRejectedValueOnce(new Error('Refresh failed'))
  draft(); submit()
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Reintentar operación' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Recargar saldos' }))
  await waitFor(() => expect(screen.getByLabelText('Cantidad')).toBeEnabled())
  expect(prizeInventoryApi.change).toHaveBeenCalledTimes(1)
})

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

it('automatically imports every page, retains failed cursors and keeps activation explicit', async () => {
  data.imports.event = false
  vi.mocked(prizeInventoryApi.importHistory)
    .mockResolvedValueOnce({ ok: true, cursor: 'players:page-two+/=', unresolved: 0 })
    .mockRejectedValueOnce(new Error('Import failed'))
    .mockImplementationOnce(async () => {
      data.imports.event = true
      return { ok: true, cursor: null, unresolved: 0 }
    })

  mount()
  const activate = await screen.findByRole('button', { name: 'Activar inventario compartido' })
  expect(activate).toBeDisabled()
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar importación' }))
  await waitFor(() => expect(activate).toBeEnabled())
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([['event', undefined], ['event', 'players:page-two+/='], ['event', 'players:page-two+/=']])
  fireEvent.click(activate)
  const dialog = screen.getByRole('dialog', { name: 'Confirmar activación' })
  expect(dialog).toHaveTextContent('Los nuevos premios sin inicializar no se repartirán')
  expect(prizeInventoryApi.activate).not.toHaveBeenCalled()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar activación' }))
  await screen.findByText(/Inventario compartido activo/)
  expect(prizeInventoryApi.activate).toHaveBeenCalledTimes(1)
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
  const activate = await screen.findByRole('button', { name: 'Activar inventario compartido' })
  expect(screen.getByText('empty-catalog: Importación completa')).toBeInTheDocument()
  expect(within(screen.getByLabelText('Histórico de premios')).queryByText(/Not an import target/)).not.toBeInTheDocument()
  await waitFor(() => expect(activate).toBeEnabled())
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([
    ['archived-no-catalog', undefined], ['archived-no-catalog', cursor],
  ])
})

it('continues importing other games after one fails, including in active mode', async () => {
  data.mode = 'active'
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
  expect(prizeInventoryApi.activate).not.toHaveBeenCalled()
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
  expect(screen.getByRole('button', { name: 'Activar inventario compartido' })).toBeDisabled()
  vi.mocked(prizeInventoryApi.importHistory).mockImplementationOnce(async () => {
    data.unresolved = 0; data.imports.event = true
    return { ok: true, cursor: null, unresolved: 0 }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar importación' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Activar inventario compartido' })).toBeEnabled())
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
  await screen.findByText('Event One: Importación completa')
  expect(vi.mocked(prizeInventoryApi.importHistory).mock.calls).toEqual([
    ['event', undefined], ['event', 'players:'],
  ])
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

it.each(['uninitialized', 'unresolved'] as const)('blocks activation for %s prerequisites', async condition => {
  if (condition === 'uninitialized') data.catalog[0].inventory.initialized = false
  else data.unresolved = 1
  mount()
  expect(await screen.findByRole('button', { name: 'Activar inventario compartido' })).toBeDisabled()
  if (condition === 'unresolved') {
    expect(screen.queryByText('Históricos actualizados automáticamente.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Histórico de premios')).toHaveTextContent('Sin resolver: 1')
  }
})

it('reports load failures and supports reload without hiding an activation failure', async () => {
  vi.mocked(prizeInventoryApi.get).mockRejectedValueOnce(new Error('Load failed'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Load failed')
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar inventario' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Activar inventario compartido' }))
  vi.mocked(prizeInventoryApi.activate).mockRejectedValueOnce(new Error('Activation failed'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar activación' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Activation failed')
})
