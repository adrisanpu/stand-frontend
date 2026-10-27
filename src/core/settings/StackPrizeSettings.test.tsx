import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stackPrizeApi, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { kivlyApi } from '../../api/kivlyApi'
import { uploadPrizeImage } from '../../api/prizeMedia'
import StackPrizeSettings from './StackPrizeSettings'

vi.mock('../../api/stackPrizes', () => ({ stackPrizeApi: { get: vi.fn(), save: vi.fn(), close: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { getAccountConnection: vi.fn(), listRewards: vi.fn() } }))
vi.mock('../../api/prizeMedia', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/prizeMedia')>(),
  uploadPrizeImage: vi.fn(), validatePrizeImage: vi.fn(),
}))
const response: StackPrizeSettingsResponse = {
  ok: true, enabled: true, state: 'open', pendingPlayers: [], awards: [], allocations: [],
  inventory: [{ prizeId: 'pizza', total: 100, remaining: 100 }],
  program: { version: 2, storefrontUrl: 'https://club.kivly.store', catalog: [
    { id: 'pizza', source: 'stand', name: 'Pizza', limit: null, stockTotal: 100 },
  ], rules: [{ id: 'done', condition: 'completed', mode: 'all', allocations: [{ prizeId: 'pizza', quantity: 1 }] }] },
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stackPrizeApi.get).mockResolvedValue(structuredClone(response))
  vi.mocked(stackPrizeApi.save).mockImplementation(async (_, program) => program)
  vi.mocked(stackPrizeApi.close).mockResolvedValue({ ...response, state: 'closing' })
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
    connected: true, locationId: 'loc', locations: [{ id: 'loc', name: 'Club' }],
  })
  vi.mocked(kivlyApi.listRewards).mockResolvedValue([{ id: 'coffee', name: 'Coffee' }])
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function mount() {
  const onPersist = vi.fn()
  render(<StackPrizeSettings gameId="ABC123" raffles onPersist={onPersist} />)
  return { onPersist }
}

it('adds a Kivly reward to the same textual rule as a STAND prize', async () => {
  const { onPersist } = mount()
  await screen.findByRole('option', { name: 'Coffee' })
  fireEvent.change(screen.getByLabelText('Añadir premio a regla 1'), { target: { value: 'kivly_coffee' } })
  expect(screen.getByText('Pizza · STAND')).toBeInTheDocument()
  expect(screen.getByText('Coffee · Kivly')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas de premios' }))
  await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(1))
  const saved = vi.mocked(stackPrizeApi.save).mock.calls[0][1]
  const reward = saved.catalog.find((p) => p.source === 'kivly')!
  expect(saved.rules[0].allocations).toEqual([
    { prizeId: 'pizza', quantity: 1 }, { prizeId: reward.id, quantity: 1 },
  ])
  expect(saved.rules[0].id).not.toBe('done')
  expect(reward.id.length).toBeLessThanOrEqual(80)
  expect(reward).toMatchObject({ rewardId: 'coffee', locationId: 'loc', source: 'kivly' })
  expect(reward.stockTotal).toBe(100)
})

it('adds a local STAND prize without creating anything in Kivly', async () => {
  mount()
  await screen.findByText('Reglas de premios')
  fireEvent.change(screen.getByLabelText('Nombre del premio STAND'), { target: { value: 'Bebida' } })
  fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas de premios' }))
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  expect(vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'stand', name: 'Bebida', stockTotal: 100 }),
  ]))
})

it('configures AND/OR, winner quantity X and shared event stock Y', async () => {
  mount()
  await screen.findByText('Reglas de premios')
  fireEvent.change(screen.getByLabelText('Cantidad X por ganador de Pizza'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Inventario total Y de Pizza'), { target: { value: '8' } })
  fireEvent.change(screen.getByLabelText('Agrupación 1'), { target: { value: 'random_one' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas de premios' }))
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  const saved = vi.mocked(stackPrizeApi.save).mock.calls[0][1]
  expect(saved.rules[0]).toMatchObject({
    mode: 'random_one', allocations: [{ prizeId: 'pizza', quantity: 3 }],
  })
  expect(saved.catalog[0].stockTotal).toBe(8)
})

it('offers both distinct ranking conditions and requires a prize on every rule', async () => {
  mount()
  await screen.findByText('Reglas de premios')
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Condición 2'), { target: { value: 'top_final' } })
  expect(screen.getByLabelText('Top 2')).toHaveValue(10)
  expect(screen.getAllByRole('option', { name: 'entre en el top al terminar su partida' })).toHaveLength(2)
  expect(screen.getAllByRole('option', { name: 'esté en el top al cerrar el juego' })).toHaveLength(2)
})

it('reports catalog failure without treating it as successful empty Kivly catalog', async () => {
  vi.mocked(kivlyApi.listRewards).mockRejectedValue(new Error('Unavailable'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar Kivly.')
  expect(screen.getByText('Pizza · STAND')).toBeInTheDocument()
})

it('requires confirmation before requesting definitive closure', async () => {
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Cerrar juego y entregar premios finales' }))
  expect(stackPrizeApi.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
  await waitFor(() => expect(stackPrizeApi.close).toHaveBeenCalledWith('ABC123', []))
})

it('requires a second confirmation before excluding abandoned attempts', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...response, state: 'closing', pendingPlayers: [{ playerId: 3, name: 'Pending' }] })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir los intentos pendientes' }))
  expect(stackPrizeApi.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusión y cierre' }))
  await waitFor(() => expect(stackPrizeApi.close).toHaveBeenCalledWith('ABC123', [3]))
})

it('does not replace unsaved edits when retrying the catalog', async () => {
  vi.mocked(kivlyApi.listRewards).mockRejectedValue(new Error('Unavailable'))
  mount()
  await screen.findByRole('alert')
  fireEvent.change(screen.getByLabelText('Web oficial del club Kivly'), { target: { value: 'https://new.kivly.store' } })
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled()
})

it('uses a local stable ID even when the external reward ID is long', async () => {
  const externalId = 'reward'.repeat(80)
  vi.mocked(kivlyApi.listRewards).mockResolvedValue([{ id: externalId, name: 'Long reward' }])
  mount()
  await screen.findByRole('option', { name: 'Long reward' })
  fireEvent.change(screen.getByLabelText('Añadir premio a regla 1'), { target: { value: `kivly_${externalId}` } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas de premios' }))
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  const selected = vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog.find((p) => p.source === 'kivly')!
  expect(selected.id.length).toBeLessThanOrEqual(80)
  expect(selected.rewardId).toBe(externalId)
})

it('keeps edits and retry available after a failed save', async () => {
  vi.mocked(stackPrizeApi.save).mockRejectedValue(new Error('Unavailable'))
  const { onPersist } = mount()
  fireEvent.change(await screen.findByLabelText('Web oficial del club Kivly'), { target: { value: 'https://new.kivly.store' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas de premios' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable')
  expect(screen.getByLabelText('Web oficial del club Kivly')).toHaveValue('https://new.kivly.store')
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeEnabled()
  expect(onPersist).not.toHaveBeenCalled()
})

it('previews a staged PNG and lets the owner remove it before saving', async () => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:prize-preview')
    static revokeObjectURL = vi.fn()
  })
  vi.mocked(uploadPrizeImage).mockResolvedValue('staged/prize.png')
  mount()
  const input = await screen.findByLabelText('Imagen de Pizza')
  fireEvent.change(input, { target: { files: [new File(['png'], 'prize.png', { type: 'image/png' })] } })
  expect(await screen.findByRole('img', { name: 'Vista previa del premio Pizza' })).toHaveAttribute('src', 'blob:prize-preview')
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen de Pizza' }))
  expect(screen.queryByRole('img', { name: 'Vista previa del premio Pizza' })).not.toBeInTheDocument()
})
