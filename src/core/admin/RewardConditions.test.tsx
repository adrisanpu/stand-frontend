import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import RewardConditions from './RewardConditions'
import { stackPrizeApi, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { fetchSharedPrizeCatalog } from '../../api/sharedPrizeCatalog'
import { kivlyApi } from '../../api/kivlyApi'
import type { OperatorGameConfiguration } from '../../api/operatorGames'

vi.mock('../../api/stackPrizes', () => ({ stackPrizeApi: { get: vi.fn(), save: vi.fn(), saveRules: vi.fn() } }))
vi.mock('../../api/sharedPrizeCatalog', () => ({ fetchSharedPrizeCatalog: vi.fn() }))
vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { getAccountConnection: vi.fn(), listRewards: vi.fn() } }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ plan: 'event', loading: false }) }))
vi.mock('../../api/operatorGames', () => ({ getOperatorGameConfiguration: async () => data }))

const data: OperatorGameConfiguration = {
  ok: true, game: { gameId: 'NEW', gameName: 'New event', gameType: 'STACK', isActive: true, lifecycleState: 'active' },
  configuration: {}, rewardConditionsRevision: 'native',
}
let snapshot: StackPrizeSettingsResponse
beforeEach(() => {
  vi.clearAllMocks()
  snapshot = {
    ok: true, enabled: true, state: 'open', programRevision: 'original', globalInventory: null,
    pendingPlayers: [], awards: [], inventory: [], allocations: [],
    program: { version: 3, storefrontUrl: '', catalog: [], rules: [] },
  }
  vi.mocked(stackPrizeApi.get).mockImplementation(async () => structuredClone(snapshot))
  vi.mocked(fetchSharedPrizeCatalog).mockResolvedValue({
    revision: 1, catalog: [
      { id: 'medal', name: 'Medal', imageKey: null }, { id: 'cup', name: 'Cup', imageKey: null },
    ],
  })
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({ connected: true, locationId: 'club', locations: [] })
  vi.mocked(kivlyApi.listRewards).mockResolvedValue([{ id: 'coffee', name: 'Coffee' }])
  vi.mocked(stackPrizeApi.save).mockImplementation(async (_, program) => {
    snapshot = { ...snapshot, program, programRevision: 'catalog-revision' }
    return structuredClone(program)
  })
  vi.mocked(stackPrizeApi.saveRules).mockImplementation(async (_, rules) => {
    snapshot = { ...snapshot, program: { ...snapshot.program, rules }, programRevision: 'rules-revision' }
    return { ok: true, program: snapshot.program, programRevision: 'rules-revision' }
  })
})
afterEach(cleanup)
function mount() {
  const onDirtyChange = vi.fn(), onBusyChange = vi.fn()
  render(<RewardConditions data={data} readOnly={false} onDirtyChange={onDirtyChange} onBusyChange={onBusyChange} />)
  return { onDirtyChange, onBusyChange }
}

it('saves a game-wide automatic close only with a valid final-top duration', async () => {
  snapshot.program.catalog = [{ id: 'existing', source: 'stand', name: 'Medal', stockTotal: null }]
  snapshot.program.rules = [{ id: 'final', condition: 'top_final', topX: 3,
    groups: [{ allocations: [{ prizeId: 'existing', quantity: 1 }] }] }]
  vi.mocked(stackPrizeApi.saveRules).mockImplementationOnce(async (_, rules, __, duration) => ({
    ok: true, program: { ...snapshot.program, rules }, programRevision: 'scheduled',
    autoClose: duration ? { ...duration, closesAt: 1_800_000_000 } : null,
  }))
  mount()
  const checkbox = await screen.findByRole('checkbox', { name: 'Cerrar automáticamente' })
  const parameters = screen.getByLabelText('Top 1').closest('td')
  expect(parameters).toContainElement(checkbox)
  fireEvent.click(checkbox)
  expect(parameters).toContainElement(screen.getByLabelText('Horas'))
  expect(parameters).toContainElement(screen.getByLabelText('Minutos'))
  fireEvent.change(screen.getByLabelText('Horas'), { target: { value: '0' } })
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '60' } })
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Minutos'), { target: { value: '15' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  expect(await screen.findByText(/Cierre guardado/)).toBeInTheDocument()
  expect(stackPrizeApi.saveRules).toHaveBeenCalledWith('NEW', snapshot.program.rules, 'original', { hours: 0, minutes: 15 })
  fireEvent.change(screen.getByLabelText('Condición 1'), { target: { value: 'completed' } })
  expect(screen.queryByRole('checkbox', { name: 'Cerrar automáticamente' })).not.toBeInTheDocument()
  expect(screen.getByText(/se cancelará al guardar/)).toBeInTheDocument()
})

it('offers every existing catalog prize and saves selected associations before the new rules', async () => {
  const { onDirtyChange, onBusyChange } = mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Añadir regla' }))
  const select = screen.getByLabelText('Añadir premio al grupo 1.1')
  expect(Array.from(select.querySelectorAll('option')).map(option => option.textContent)).toEqual([
    'Seleccionar premio…', 'Medal', 'Cup', 'Coffee',
  ])
  fireEvent.change(select, { target: { value: 'shared_medal' } })
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.1'), { target: { value: 'kivly_coffee' } })
  expect(screen.getByLabelText('Substock Medal')).toHaveValue('')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await screen.findByText(/Condiciones guardadas/)
  expect(stackPrizeApi.save).toHaveBeenCalledWith('NEW', expect.objectContaining({
    catalog: [
      expect.objectContaining({ sharedPrizeId: 'medal', stockTotal: null }),
      expect.objectContaining({ rewardId: 'coffee', locationId: 'club', stockTotal: null }),
    ],
  }))
  expect(stackPrizeApi.saveRules).toHaveBeenCalledWith('NEW', expect.any(Array), 'catalog-revision')
  expect(snapshot.program.catalog).toHaveLength(2)
  expect(snapshot.program.rules[0].groups[0].allocations).toHaveLength(2)
  expect(onDirtyChange).toHaveBeenLastCalledWith(false)
  expect(onBusyChange).toHaveBeenLastCalledWith(false)
})

it('does not write rules or report success after an association save fails', async () => {
  vi.mocked(stackPrizeApi.save).mockRejectedValue(new Error('Network'))
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Añadir regla' }))
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.1'), { target: { value: 'shared_medal' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar')
  expect(stackPrizeApi.saveRules).not.toHaveBeenCalled()
  expect(screen.queryByText(/Condiciones guardadas/)).not.toBeInTheDocument()
})

it('reports catalog load failures and supports retry', async () => {
  vi.mocked(fetchSharedPrizeCatalog).mockRejectedValueOnce(new Error('Network'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar')
  expect(screen.queryByRole('button', { name: 'Añadir regla' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Recargar condiciones' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Añadir regla' })).toBeEnabled())
})

it('does not duplicate existing event prizes or write anything on load', async () => {
  snapshot.program.catalog = [{ id: 'existing', source: 'stand', sharedPrizeId: 'medal', name: 'Medal', stockTotal: 5 }]
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Añadir regla' }))
  const select = screen.getByLabelText('Añadir premio al grupo 1.1')
  expect(select.querySelectorAll('option[value="existing"]')).toHaveLength(1)
  expect(select.querySelector('option[value="shared_medal"]')).toBeNull()
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
  fireEvent.change(select, { target: { value: 'existing' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await screen.findByText(/Condiciones guardadas/)
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
  expect(stackPrizeApi.saveRules).toHaveBeenCalledWith('NEW', expect.any(Array), 'original')
  expect(snapshot.program.catalog[0].stockTotal).toBe(5)
})

it('requires persisted prize associations before saving rules', async () => {
  vi.mocked(stackPrizeApi.save).mockImplementation(async () => structuredClone(snapshot.program))
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Añadir regla' }))
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.1'), { target: { value: 'shared_medal' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar')
  expect(stackPrizeApi.saveRules).not.toHaveBeenCalled()
})

it('reveals and saves the prize sub-stock when changing a collapsed rule to raffle', async () => {
  snapshot.program.catalog = [{ id: 'existing', source: 'stand', sharedPrizeId: 'medal', name: 'Medal', stockTotal: 5 }]
  snapshot.program.rules = [{
    id: 'rule', condition: 'completed', groups: [{ allocations: [{ prizeId: 'existing', quantity: 1 }] }],
  }]
  mount()
  await screen.findByLabelText('Substock Medal')
  fireEvent.click(screen.getByRole('radio', { name: 'Seleccionar regla 1' }))
  expect(screen.queryByLabelText('Substock Medal')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Condición 1'), { target: { value: 'raffle' } })
  expect(screen.getByRole('textbox', { name: 'Substock Medal' })).toHaveValue('5')
  fireEvent.change(screen.getByLabelText('Substock Medal'), { target: { value: '12' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await screen.findByText(/Condiciones guardadas/)
  expect(snapshot.program.catalog[0].stockTotal).toBe(12)
  expect(snapshot.program.rules[0].condition).toBe('raffle')
  expect(stackPrizeApi.saveRules).toHaveBeenCalledWith('NEW', expect.any(Array), 'catalog-revision')
})

it('keeps the released sub-stock returned by the server after removing the last prize rule', async () => {
  snapshot.program.catalog = [{ id: 'existing', source: 'kivly', rewardId: 'coffee', locationId: 'club', name: 'Coffee', stockTotal: 10 }]
  snapshot.program.rules = [{
    id: 'rule', condition: 'completed', groups: [{ allocations: [{ prizeId: 'existing', quantity: 1 }] }],
  }]
  vi.mocked(stackPrizeApi.saveRules).mockImplementation(async (_, rules) => {
    snapshot = {
      ...snapshot, programRevision: 'released',
      program: { ...snapshot.program, rules, catalog: [{ ...snapshot.program.catalog[0], stockTotal: 2 }] },
    }
    return { ok: true, program: structuredClone(snapshot.program), programRevision: 'released' }
  })
  mount()
  await screen.findByLabelText('Substock Coffee')
  fireEvent.click(screen.getByRole('button', { name: 'Quitar regla 1' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await screen.findByText(/Condiciones guardadas/)
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.1'), { target: { value: 'existing' } })
  expect(screen.getByLabelText('Substock Coffee')).toHaveValue('2')
})
