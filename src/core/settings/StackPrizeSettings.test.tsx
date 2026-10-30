import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stackPrizeApi, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { kivlyApi } from '../../api/kivlyApi'
import { uploadPrizeImage } from '../../api/prizeMedia'
import StackPrizeSettings from './StackPrizeSettings'

vi.mock('../../api/stackPrizes', () => ({ stackPrizeApi: { get: vi.fn(), save: vi.fn(), close: vi.fn(), retryEmail: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { getAccountConnection: vi.fn(), listRewards: vi.fn() } }))
vi.mock('../../api/prizeMedia', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/prizeMedia')>(),
  uploadPrizeImage: vi.fn(), validatePrizeImage: vi.fn(),
}))
const response: StackPrizeSettingsResponse = {
  ok: true, enabled: true, state: 'open', pendingPlayers: [], awards: [], allocations: [],
  inventory: [{ prizeId: 'pizza', total: 100, remaining: 100 }],
  program: { version: 3, storefrontUrl: 'https://club.kivly.store', catalog: [
    { id: 'pizza', source: 'stand', name: 'Pizza', limit: null, stockTotal: 100 },
  ], rules: [{ id: 'done', condition: 'completed', groups: [{ allocations: [{ prizeId: 'pizza', quantity: 1 }] }] }] },
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stackPrizeApi.get).mockResolvedValue(structuredClone(response))
  vi.mocked(stackPrizeApi.save).mockImplementation(async (_, program) => program)
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
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas de premios' }))

it('adds a Kivly reward to an AND group without creating it externally', async () => {
  const { onPersist } = mount()
  await screen.findByRole('option', { name: 'Coffee' })
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.1'), { target: { value: 'kivly_coffee' } })
  save()
  await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(1))
  const saved = vi.mocked(stackPrizeApi.save).mock.calls[0][1]
  const reward = saved.catalog.find((prize) => prize.source === 'kivly')!
  expect(saved.rules[0].groups[0].allocations).toEqual([
    { prizeId: 'pizza', quantity: 1 }, { prizeId: reward.id, quantity: 1 },
  ])
  expect(saved.rules[0].id).not.toBe('done')
  expect(reward.id.length).toBeLessThanOrEqual(80)
  expect(reward).toMatchObject({ rewardId: 'coffee', locationId: 'loc', source: 'kivly', stockTotal: 100 })
})

it('saves one exclusive email channel while retaining wallet as the legacy default', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...structuredClone(response), emailAvailable: true })
  mount()
  const channel = await screen.findByLabelText('Entrega de premios Kivly')
  expect(channel).toHaveValue('wallet')
  expect(screen.queryByRole('option', { name: /ambas/i })).not.toBeInTheDocument()
  fireEvent.change(channel, { target: { value: 'email' } })
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalledWith('ABC123',
    expect.objectContaining({ deliveryChannel: 'email' })))
})

it('disables email when it is unavailable in this environment', async () => {
  mount()
  await screen.findByLabelText('Entrega de premios Kivly')
  expect(screen.getByRole('option', { name: 'Email' })).toBeDisabled()
  expect(screen.getByText('El envío de premios por email aún no está habilitado en este entorno.')).toBeInTheDocument()
})

it('shows missing Kivly phone and retries only the email, including after closure', async () => {
  const data: StackPrizeSettingsResponse = {
    ...structuredClone(response), state: 'closed', emailAvailable: true,
    awards: [{ id: 'award_one', playerId: 7, name: 'Coffee', source: 'kivly', condition: 'completed',
      state: 'confirmed', deliveryChannel: 'email', emailState: 'failed', emailError: 'KivlyPhoneRequired' }],
  }
  vi.mocked(stackPrizeApi.get).mockResolvedValue(data)
  vi.mocked(stackPrizeApi.retryEmail).mockResolvedValue({
    ...data, awards: [{ ...data.awards[0], emailState: 'pending', emailError: null }],
  })
  mount()
  const retry = await screen.findByRole('button', { name: 'Reintentar email sin reasignar premio' })
  expect(screen.getByRole('alert')).toHaveTextContent('Falta un teléfono válido en Kivly')
  expect(retry).toBeEnabled()
  fireEvent.click(retry)
  await waitFor(() => expect(stackPrizeApi.retryEmail).toHaveBeenCalledWith('ABC123', 'award_one'))
  expect(await screen.findByText(/Pendiente de envío/)).toBeInTheDocument()
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
  expect(stackPrizeApi.close).not.toHaveBeenCalled()
})

it('shows the full external catalog without publishing it until selected', async () => {
  mount()
  await screen.findByRole('option', { name: 'Coffee' })
  expect(screen.getByRole('button', { name: 'Añadir al inventario' })).toBeInTheDocument()
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('textbox', { name: 'Buscar premios' })).not.toBeInTheDocument()
  expect(screen.queryByText('Reglas de premios')).not.toBeInTheDocument()
  expect(screen.queryByText('Entregas')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Web oficial del club Kivly')).not.toBeInTheDocument()
})

it('adds a local STAND prize without creating anything in Kivly', async () => {
  mount()
  await screen.findByText('Catálogo e inventario')
  fireEvent.change(screen.getByLabelText('Nombre del premio STAND'), { target: { value: 'Bebida' } })
  fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  expect(vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'stand', name: 'Bebida', stockTotal: 100 }),
  ]))
})

it('configures OR groups of AND prizes, quantities and shared stock', async () => {
  mount()
  await screen.findByRole('option', { name: 'Coffee' })
  fireEvent.change(screen.getByLabelText('Cantidad de Pizza · 1.1'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Inventario total Y de Pizza'), { target: { value: '8' } })
  fireEvent.click(screen.getByRole('button', { name: 'O añadir grupo' }))
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.2'), { target: { value: 'kivly_coffee' } })
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.2'), { target: { value: 'pizza' } })
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  const saved = vi.mocked(stackPrizeApi.save).mock.calls[0][1]
  expect(saved.rules[0].groups).toHaveLength(2)
  expect(saved.rules[0].groups[0].allocations).toEqual([{ prizeId: 'pizza', quantity: 3 }])
  expect(saved.rules[0].groups[1].allocations).toHaveLength(2)
  expect(saved.catalog[0].stockTotal).toBe(8)
  expect(screen.queryByLabelText('Agrupación 1')).not.toBeInTheDocument()
})

it('previews remaining stock while editing without a header of counters', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({
    ...structuredClone(response), inventory: [{ prizeId: 'pizza', total: 100, remaining: 97 }],
  })
  mount()
  await screen.findByText('Catálogo e inventario')
  expect(screen.getByText('Disponibles: 97')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Inventario total Y de Pizza'), { target: { value: '8' } })
  expect(screen.getByText('Disponibles: 5')).toBeInTheDocument()
  expect(screen.queryByText('STAND · Recogida con QR')).not.toBeInTheDocument()
  expect(screen.queryByText('Sin cambios pendientes')).not.toBeInTheDocument()
  save()
  expect(await screen.findByText('Premios guardados. Los premios ya ganados se conservan.')).toBeInTheDocument()
})

it('removes a selected prize only through its explicit remove control', async () => {
  mount()
  const quantity = await screen.findByLabelText('Cantidad de Pizza · 1.1')
  fireEvent.click(quantity)
  expect(quantity).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar premio Pizza · 1.1' }))
  expect(screen.queryByLabelText('Cantidad de Pizza · 1.1')).not.toBeInTheDocument()
  expect(screen.getByText('Selecciona al menos un premio.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeDisabled()
})

it('offers both ranking conditions and requires a prize in each added rule', async () => {
  mount()
  await screen.findByText('Catálogo e inventario')
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Condición 2'), { target: { value: 'top_final' } })
  expect(screen.getByLabelText('Top 2')).toHaveValue(10)
  expect(screen.getAllByRole('option', { name: 'entre en el top al terminar su partida' })).toHaveLength(2)
})

it('retries the external catalog without replacing unsaved edits', async () => {
  vi.mocked(kivlyApi.listRewards).mockRejectedValueOnce(new Error('Unavailable'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar Kivly.')
  fireEvent.change(screen.getByLabelText('Inventario total Y de Pizza'), { target: { value: '8' } })
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByRole('option', { name: 'Coffee' })
  expect(screen.getByLabelText('Inventario total Y de Pizza')).toHaveValue(8)
  expect(stackPrizeApi.get).toHaveBeenCalledTimes(1)
})

it('uses a stable local ID for a long external reward ID', async () => {
  const externalId = 'reward'.repeat(80)
  vi.mocked(kivlyApi.listRewards).mockResolvedValue([{ id: externalId, name: 'Long reward' }])
  mount()
  await screen.findByRole('option', { name: 'Long reward' })
  fireEvent.change(screen.getByLabelText('Añadir premio al grupo 1.1'), { target: { value: `kivly_${externalId}` } })
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  const selected = vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog.find((prize) => prize.source === 'kivly')!
  expect(selected.id.length).toBeLessThanOrEqual(80)
  expect(selected.rewardId).toBe(externalId)
})

it('keeps edits and retry available after a failed save', async () => {
  vi.mocked(stackPrizeApi.save).mockRejectedValue(new Error('Unavailable'))
  const { onPersist } = mount()
  fireEvent.change(await screen.findByLabelText('Inventario total Y de Pizza'), { target: { value: '8' } })
  save()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable')
  expect(screen.getByLabelText('Inventario total Y de Pizza')).toHaveValue(8)
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

it('locks prize editing after closure starts', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...response, state: 'closing' })
  mount()
  expect(await screen.findByLabelText('Inventario total Y de Pizza')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Confirmar cierre' })).not.toBeInTheDocument()
})
