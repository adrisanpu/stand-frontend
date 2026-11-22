import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../../api/api'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import PrizeAdministration from './PrizeAdministration'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
vi.mock('../../api/prizeGameCaps', () => ({ saveGamePrizeCap: vi.fn() }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ plan: 'event', loading: false }) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockImplementation(async url => url === '/v1/prizes/inventory' ? {
    ok: true, mode: 'reservations', catalog: [{
      id: 'welcome', name: 'Premio bienvenida', source: 'stand', games: [{ gameId: 'EV', name: 'Evento', active: true, limit: 15 }], canjeados: 0,
      inventory: { initialized: true, available: 12, assigned: 3, historicalAssigned: 0,
        redeemed: 0, historicalRedeemed: 0, revision: 1 },
      reservation: { total: 15, available: 12, assigned: 3, redeemed: 0, error: null },
    }], imports: {}, unresolved: 0,
  } : {
    ok: true, catalog: [{ id: 'welcome', name: 'Premio bienvenida', imageKey: null, imageUrl: null }], revision: 1,
  })
  vi.mocked(api.put).mockResolvedValue({ ok: true, revision: 2 })
})
afterEach(cleanup)

it('allows deleting an uninitialized STAND prize without any event', async () => {
  let removed = false
  vi.mocked(api.get).mockImplementation(async url => url === '/v1/prizes/inventory' ? {
    ok: true, mode: 'reservations', imports: {}, unresolved: 0, catalog: removed ? [] : [{
      id: 'welcome', name: 'Premio bienvenida', source: 'stand', games: [], canjeados: 0,
      inventory: { initialized: false, available: 0, assigned: 0, historicalAssigned: 0,
        redeemed: 0, historicalRedeemed: 0, revision: 0 },
      reservation: { total: 0, available: 0, assigned: 0, redeemed: 0, error: null },
    }],
  } : {
    ok: true, catalog: removed ? [] : [{ id: 'welcome', name: 'Premio bienvenida', imageKey: null }], revision: 1,
  })
  vi.mocked(api.put).mockImplementation(async () => { removed = true; return { ok: true, revision: 2 } })
  render(<OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider>)
  await selectPrize()
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
  expect(await screen.findByText('Premio eliminado.')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Premio bienvenida' })).not.toBeInTheDocument())
  expect(api.put).toHaveBeenCalledWith('/v1/prizes/catalog', { catalog: [], expectedRevision: 1 })
})

async function selectPrize() {
  fireEvent.click(await screen.findByRole('radio', { name: 'Seleccionar Premio bienvenida' }))
}

it('provides one shared catalog container without selecting a game', async () => {
  render(<MemoryRouter initialEntries={['/admin/prizes?gameId=ACTIVE']}>
    <OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider>
  </MemoryRouter>)

  expect(await screen.findByRole('rowheader', { name: 'Premio bienvenida' })).toBeInTheDocument()
  const validator = screen.getByRole('region', { name: 'Validador de premios' })
  const url = `${window.location.origin}/redeem`
  expect(within(validator).getByRole('link', { name: 'Abrir validador de premios' })).toHaveAttribute('href', url)
  expect(within(validator).getByRole('img', { name: 'QR validador de premios' })).toHaveAttribute('data-qr-value', url)
  expect(validator.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Catálogo e inventario de premios' })).toBeInTheDocument()
  expect(screen.queryByText(/compartidos por todas las partidas/)).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Partida' })).not.toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/v1/prizes/catalog')
  expect(screen.getAllByRole('table')).toHaveLength(1)
  const row = within(screen.getByRole('rowheader', { name: 'Premio bienvenida' }).closest('tr')!)
  expect(row.queryByRole('button')).not.toBeInTheDocument()
  const actions = within(screen.getByRole('group', { name: 'Acciones del premio seleccionado' }))
  expect(actions.getByRole('button', { name: 'Editar' })).toBeDisabled()
  expect(actions.getByRole('button', { name: 'Ver movimientos' })).toBeDisabled()
  await selectPrize()
  expect(actions.getByRole('button', { name: 'Editar' })).toBeEnabled()
  await waitFor(() => expect(actions.getByRole('button', { name: 'Ver movimientos' })).toBeEnabled())
  expect(row.getByText('15')).toBeInTheDocument()
})

it('edits the master prize in one flat catalog instead of per-event panels', async () => {
  render(<MemoryRouter><OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider></MemoryRouter>)
  await screen.findByRole('rowheader', { name: 'Premio bienvenida' })
  await selectPrize()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  const prizeRow = screen.getByRole('rowheader', { name: 'Premio bienvenida' }).closest('tr')!
  expect(within(prizeRow.nextElementSibling as HTMLElement).getByRole('form', { name: 'Ficha del premio' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ver movimientos' })).toBeDisabled()
  fireEvent.change(screen.getByPlaceholderText('Nombre del premio'), { target: { value: 'Premio bienvenida actualizado' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  expect(await screen.findByText('Premio guardado en el catálogo general.')).toBeInTheDocument()
  expect(api.put).toHaveBeenCalledWith('/v1/prizes/catalog', {
    catalog: [{ id: 'welcome', name: 'Premio bienvenida actualizado', imageKey: null }], expectedRevision: 1,
  })
  expect(screen.getAllByRole('rowheader')).toHaveLength(1)
  expect(screen.getByRole('rowheader', { name: 'Premio bienvenida actualizado' })).toBeInTheDocument()
})

it('keeps catalog editing available when balances fail without inventing zero stock', async () => {
  vi.mocked(api.get).mockImplementation(async url => {
    if (url === '/v1/prizes/inventory') throw new Error('Inventory unavailable')
    return { ok: true, catalog: [{ id: 'welcome', name: 'Premio bienvenida', imageKey: null }], revision: 1 }
  })
  render(<OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Inventory unavailable')
  const row = within(screen.getByRole('rowheader', { name: 'Premio bienvenida' }).closest('tr')!)
  await selectPrize()
  expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled()
  expect(row.getByText('Saldo pendiente de cargar. Actualiza el inventario.')).toBeInTheDocument()
  expect(row.queryByText('0')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ver movimientos' })).toBeDisabled()
})

it('replaces the allocation detail with the catalog editor rather than opening a second panel', async () => {
  render(<OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider>)
  await selectPrize()
  expect(await screen.findByRole('table', { name: 'Reparto por partida' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  expect(screen.getByRole('form', { name: 'Ficha del premio' })).toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Reparto por partida' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('region', { name: 'Detalle: Premio bienvenida' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('region', { name: 'Detalle: Premio bienvenida' })).not.toBeInTheDocument()
})
