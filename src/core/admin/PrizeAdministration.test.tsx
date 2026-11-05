import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../../api/api'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import PrizeAdministration from './PrizeAdministration'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ plan: 'event', loading: false }) }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockImplementation(async url => url === '/v1/prizes/inventory' ? {
    ok: true, mode: 'active', catalog: [{
      id: 'welcome', name: 'Premio bienvenida', source: 'stand', games: [], canjeados: 0,
      inventory: { initialized: true, available: 12, assigned: 3, historicalAssigned: 0,
        redeemed: 0, historicalRedeemed: 0, revision: 1 },
    }], imports: {}, unresolved: 0,
  } : {
    ok: true, catalog: [{ id: 'welcome', name: 'Premio bienvenida', imageKey: null, imageUrl: null }], revision: 1,
  })
  vi.mocked(api.put).mockResolvedValue({ ok: true, revision: 2 })
})
afterEach(cleanup)

async function selectPrize() {
  fireEvent.click(await screen.findByRole('radio', { name: 'Seleccionar Premio bienvenida' }))
}

it('provides one shared catalog container without selecting a game', async () => {
  render(<MemoryRouter initialEntries={['/admin/prizes?gameId=ACTIVE']}>
    <OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider>
  </MemoryRouter>)

  expect(await screen.findByRole('rowheader', { name: 'Premio bienvenida' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Catálogo e inventario de premios' })).toBeInTheDocument()
  expect(screen.getByText(/compartidos por todas las partidas/)).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Partida' })).not.toBeInTheDocument()
  expect(api.get).toHaveBeenCalledWith('/v1/prizes/catalog')
  expect(screen.getAllByRole('table')).toHaveLength(1)
  const row = within(screen.getByRole('rowheader', { name: 'Premio bienvenida' }).closest('tr')!)
  expect(row.queryByRole('button')).not.toBeInTheDocument()
  const actions = within(screen.getByRole('group', { name: 'Acciones del premio seleccionado' }))
  expect(actions.getByRole('button', { name: 'Editar' })).toBeDisabled()
  expect(actions.getByRole('button', { name: 'Gestionar saldo' })).toBeDisabled()
  await selectPrize()
  expect(actions.getByRole('button', { name: 'Editar' })).toBeEnabled()
  await waitFor(() => expect(actions.getByRole('button', { name: 'Gestionar saldo' })).toBeEnabled())
  expect(actions.getByRole('button', { name: 'Ver movimientos' })).toBeEnabled()
  expect(row.getByText('12')).toBeInTheDocument()
})

it('edits the master prize in one flat catalog instead of per-event panels', async () => {
  render(<MemoryRouter><OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider></MemoryRouter>)
  await screen.findByRole('rowheader', { name: 'Premio bienvenida' })
  await selectPrize()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  const prizeRow = screen.getByRole('rowheader', { name: 'Premio bienvenida' }).closest('tr')!
  expect(within(prizeRow.nextElementSibling as HTMLElement).getByRole('form', { name: 'Ficha del premio' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Gestionar saldo' })).toBeDisabled()
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
  expect(screen.getByRole('button', { name: 'Gestionar saldo' })).toBeDisabled()
})

it('replaces a balance panel with the inline editor rather than opening a second panel', async () => {
  render(<OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider>)
  await selectPrize()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gestionar saldo' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Gestionar saldo' }))
  expect(screen.getByLabelText('Cantidad')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  expect(screen.getByRole('form', { name: 'Ficha del premio' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Cantidad')).not.toBeInTheDocument()
  expect(screen.getAllByRole('region', { name: 'Detalle: Premio bienvenida' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('region', { name: 'Detalle: Premio bienvenida' })).not.toBeInTheDocument()
})

it('prevents catalog edits from discarding an uncertain stock request', async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Response lost'))
  render(<OperatorLanguageProvider><PrizeAdministration /></OperatorLanguageProvider>)
  await selectPrize()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Gestionar saldo' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Gestionar saldo' }))
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Motivo obligatorio'), { target: { value: 'Refill' } })
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Añadir premio' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Editar' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '3' } })
  expect(screen.getByRole('button', { name: 'Editar' })).toBeEnabled()
})
