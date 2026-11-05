import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stackPrizeApi, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { kivlyApi } from '../../api/kivlyApi'
import { uploadPrizeImage, validatePrizeImage } from '../../api/prizeMedia'
import { fetchSharedPrizeCatalog } from '../../api/sharedPrizeCatalog'
import StackPrizeSettings from './StackPrizeSettings'

vi.mock('../../api/stackPrizes', () => ({ stackPrizeApi: { get: vi.fn(), save: vi.fn(), close: vi.fn(), retryEmail: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({
  kivlyApi: {
    getAccountConnection: vi.fn(), listRewards: vi.fn(), getReward: vi.fn(),
    createReward: vi.fn(), updateReward: vi.fn(),
  },
}))
vi.mock('../../api/prizeMedia', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/prizeMedia')>(),
  uploadPrizeImage: vi.fn(), validatePrizeImage: vi.fn(),
}))
vi.mock('../../api/sharedPrizeCatalog', () => ({
  fetchSharedPrizeCatalog: vi.fn().mockResolvedValue({
    catalog: [{ id: 'shared-pizza', name: 'Pizza', imageKey: null, imageUrl: null }],
    revision: 1,
  }),
}))
const response: StackPrizeSettingsResponse = {
  globalInventory: null,
  ok: true, enabled: true, state: 'open', pendingPlayers: [], awards: [], allocations: [],
  inventory: [{ prizeId: 'pizza', total: 100, remaining: 100 }],
  program: { version: 3, storefrontUrl: 'https://club.kivly.store', catalog: [
    { id: 'pizza', source: 'stand', name: 'Pizza', sharedPrizeId: 'shared-pizza', limit: null, stockTotal: 100 },
  ], rules: [{ id: 'done', condition: 'completed', groups: [{ allocations: [{ prizeId: 'pizza', quantity: 1 }] }] }] },
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchSharedPrizeCatalog).mockResolvedValue({
    catalog: [{ id: 'shared-pizza', name: 'Pizza', imageKey: null, imageUrl: null }],
    revision: 1,
  })
  vi.mocked(stackPrizeApi.get).mockResolvedValue(structuredClone(response))
  vi.mocked(stackPrizeApi.save).mockImplementation(async (_, program) => program)
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
    connected: true, locationId: 'loc', locations: [{ id: 'loc', name: 'Club' }],
  })
  vi.mocked(kivlyApi.listRewards).mockResolvedValue([{ id: 'coffee', name: 'Coffee' }])
  vi.mocked(kivlyApi.getReward).mockResolvedValue({
    id: 'coffee', title: 'Coffee', description: 'A coffee', rewardType: 'free_item',
    value: 1, pointsRequired: 20, image: null, termsAndConditions: null,
    validFrom: null, validUntil: null, maxRedemptions: null, maxRedemptionsPerUser: null,
  })
  vi.mocked(kivlyApi.createReward).mockResolvedValue({ id: 'new-reward', name: 'New reward' })
  vi.mocked(kivlyApi.updateReward).mockImplementation(async (_, rewardId, reward) => ({
    id: rewardId, name: reward.title,
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function mount() {
  const onPersist = vi.fn()
  render(<StackPrizeSettings gameId="ABC123" raffles onPersist={onPersist} />)
  return { onPersist }
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar premios' }))
async function openCreate(source: 'stand' | 'kivly' = 'stand') {
  fireEvent.click(await screen.findByRole('button', { name: '+ CREAR' }))
  if (source === 'kivly') {
    await waitFor(() => expect(screen.getByRole('option', { name: 'Kivly' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Origen del premio'), { target: { value: 'kivly' } })
  }
}

it('adds an existing Kivly reward to inventory without editing conditions or creating it externally', async () => {
  const { onPersist } = mount()
  await screen.findByRole('article', { name: 'Coffee' })
  fireEvent.click(screen.getByRole('button', { name: 'Añadir a la partida' }))
  save()
  await waitFor(() => expect(onPersist).toHaveBeenCalledTimes(1))
  const saved = vi.mocked(stackPrizeApi.save).mock.calls[0][1]
  const reward = saved.catalog.find((prize) => prize.source === 'kivly')!
  expect(saved.rules).toEqual(response.program.rules)
  expect(kivlyApi.createReward).not.toHaveBeenCalled()
  expect(reward.id.length).toBeLessThanOrEqual(80)
  expect(reward).toMatchObject({ rewardId: 'coffee', locationId: 'loc', source: 'kivly', stockTotal: null })
})

it('does not expose a delivery-channel selector and saves Wallet as the legacy default', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...structuredClone(response), emailAvailable: true })
  mount()
  await screen.findByText('Entrega de premios')
  expect(screen.queryByLabelText('Entrega de premios Kivly')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: /entrega/i })).not.toBeInTheDocument()
  expect(screen.getByText(/tarjeta Wallet/)).toBeInTheDocument()
  fireEvent.change(await screen.findByLabelText('Límite por evento de Pizza'), { target: { value: '99' } })
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalledWith('ABC123',
    expect.objectContaining({ deliveryChannel: 'wallet' })))
})

it('saves blank event caps as null without editing shared availability', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({
    ...structuredClone(response),
    globalInventory: [{ prizeId: 'pizza', inventoryPrizeId: 'shared-pizza', remaining: 0, reason: null }],
  })
  mount()
  const cap = await screen.findByLabelText('Límite por evento de Pizza')
  const card = screen.getByRole('article', { name: 'Pizza' })
  expect(card).toHaveTextContent('Disponible compartido: 0')
  fireEvent.change(cap, { target: { value: '' } })
  expect(card).toHaveTextContent('Margen del evento: Sin límite')
  expect(card).toHaveTextContent('Disponible compartido: 0')
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  expect(vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog[0].stockTotal).toBeNull()
  expect(screen.queryByText(/Modo anterior: la partida/)).not.toBeInTheDocument()
})

it('accepts null backend totals and displays unavailable global stock reasons', async () => {
  const next = structuredClone(response)
  next.program.catalog[0].stockTotal = null
  next.inventory[0].total = null
  next.globalInventory = [{ prizeId: 'pizza', inventoryPrizeId: null, remaining: 0, reason: 'uninitialized' }]
  vi.mocked(stackPrizeApi.get).mockResolvedValue(next)
  mount()
  expect(await screen.findByLabelText('Límite por evento de Pizza')).toHaveValue(null)
  expect(screen.getByText(/El stock del premio no está inicializado/)).toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Pizza' })).toHaveTextContent('Disponible compartido: No disponible')
})

it('explains zero caps and ledger inventory reasons without changing allocations', async () => {
  const next = structuredClone(response)
  next.program.catalog[0].stockTotal = 0
  next.globalInventory = [{ prizeId: 'pizza', inventoryPrizeId: 'shared-pizza', remaining: 0, reason: 'global_stock_exhausted' }]
  next.allocations = [{ playerId: 7, ruleId: 'done', state: 'out_of_stock', awarded: [],
    inventoryReasons: { pizza: 'EventLimitReached' } }]
  vi.mocked(stackPrizeApi.get).mockResolvedValue(next)
  mount()
  expect(await screen.findByText('Límite por evento: 0. Esta partida no repartirá este premio.')).toBeInTheDocument()
  expect(screen.getByText(/Se ha agotado el stock compartido/)).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Premios no asignados por inventario' }))
    .toHaveTextContent('#7 · Pizza · Se ha alcanzado el límite de premios de esta partida.')
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
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

it.each([
  ['blocked', 'queued', 'Premio pendiente de confirmación; correo aún no encolado'],
  ['reconciliation_required', 'confirmed', 'Envío incierto: comprobar antes de reenviar'],
  ['accepted', 'confirmed', 'Aceptado por SES; entrega en bandeja no confirmada'],
] as const)('displays %s emails without offering a resend', async (emailState, state, message) => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({
    ...structuredClone(response), emailAvailable: true,
    awards: [{
      id: 'award_one', playerId: 7, name: 'Coffee', source: 'kivly', condition: 'completed',
      state, deliveryChannel: 'email', emailState,
    }],
  })
  mount()
  expect(await screen.findByText(new RegExp(message))).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Reintentar email sin reasignar premio' })).not.toBeInTheDocument()
  expect(stackPrizeApi.retryEmail).not.toHaveBeenCalled()
})

it('shows the full external catalog without publishing it until selected', async () => {
  mount()
  await screen.findByRole('article', { name: 'Coffee' })
  expect(screen.getByRole('button', { name: 'Añadir a la partida' })).toBeInTheDocument()
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
  expect(screen.getByRole('searchbox', { name: 'Buscar premios' })).toBeInTheDocument()
  expect(screen.queryByText('Reglas de premios')).not.toBeInTheDocument()
  expect(screen.queryByText('Entregas')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Web oficial del club Kivly')).not.toBeInTheDocument()
})

it('creates a Kivly reward with minimal required details and refreshes the catalog', async () => {
  mount()
  await openCreate('kivly')
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tea' } })
  fireEvent.change(screen.getByLabelText('Tipo de premio'), { target: { value: 'discount_fixed' } })
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'A cup of tea' } })
  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Puntos necesarios'), { target: { value: '20' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear en Kivly' }))

  await waitFor(() => expect(kivlyApi.createReward).toHaveBeenCalledWith('ABC123', {
    title: 'Tea', description: 'A cup of tea', rewardType: 'discount_fixed',
    value: 5, pointsRequired: 20,
  }))
  expect(await screen.findByText('Premio creado en Kivly. Guarda para aplicar el límite por evento y la imagen.')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Crear premio' })).not.toBeInTheDocument()
  await waitFor(() => expect(kivlyApi.listRewards).toHaveBeenCalledTimes(2))
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
})

it('opens a STAND prize card in the populated edit form and stages its local changes', async () => {
  mount()
  await screen.findByRole('article', { name: 'Pizza' })
  fireEvent.click(screen.getByRole('button', { name: 'Editar premio Pizza' }))
  const form = screen.getByRole('region', { name: 'Editar premio' })
  expect(within(form).getByLabelText('Premio del catálogo general')).toHaveValue('shared-pizza')
  expect(within(form).getByLabelText('Premio del catálogo general')).toBeDisabled()
  expect(within(form).queryByLabelText('Nombre')).not.toBeInTheDocument()
  expect(within(form).getByText('Imagen del catálogo general')).toBeInTheDocument()
  expect(within(form).getByLabelText('Límite opcional por evento')).toHaveValue(100)

  fireEvent.change(within(form).getByLabelText('Límite opcional por evento'), { target: { value: '75' } })
  fireEvent.click(within(form).getByRole('button', { name: 'Guardar cambios' }))

  const card = await screen.findByRole('article', { name: 'Pizza' })
  expect(card).toHaveTextContent('Disponible compartido: —')
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  expect(vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog[0])
    .toMatchObject({ id: 'pizza', name: 'Pizza', sharedPrizeId: 'shared-pizza', stockTotal: 75 })
})

it('loads and updates every editable Kivly field from the prize card', async () => {
  const configured: StackPrizeSettingsResponse = {
    ...structuredClone(response),
    program: {
      ...structuredClone(response.program),
      catalog: [...structuredClone(response.program.catalog), {
        id: 'coffee-card', source: 'kivly', rewardId: 'coffee', locationId: 'loc',
        name: 'Coffee', stockTotal: 30, imageUrl: null,
      }],
    },
    inventory: [...structuredClone(response.inventory), { prizeId: 'coffee-card', total: 30, remaining: 30 }],
  }
  vi.mocked(stackPrizeApi.get).mockResolvedValue(configured)
  vi.mocked(kivlyApi.getReward).mockResolvedValue({
    id: 'coffee', title: 'Coffee', description: 'A coffee', rewardType: 'free_item',
    value: 1, pointsRequired: 20, image: 'https://cdn.kivly.store/coffee.png',
    termsAndConditions: 'Use once', validFrom: '2030-01-01T10:00:00Z',
    validUntil: '2030-03-01T10:00:00Z', maxRedemptions: 100, maxRedemptionsPerUser: 2,
  })
  mount()
  await screen.findByRole('article', { name: 'Coffee' })
  fireEvent.click(screen.getByRole('button', { name: 'Editar premio Coffee' }))
  const form = await screen.findByRole('region', { name: 'Editar premio' })
  expect(kivlyApi.getReward).toHaveBeenCalledWith('ABC123', 'coffee')
  expect(within(form).getByLabelText('Nombre')).toHaveValue('Coffee')
  expect(within(form).getByLabelText('Descripción')).toHaveValue('A coffee')
  expect(within(form).getByLabelText('Límite opcional por evento')).toHaveValue(30)
  expect(within(form).queryByText('Opciones avanzadas')).not.toBeInTheDocument()
  expect(within(form).getByLabelText('Condiciones')).toHaveValue('Use once')
  expect(within(form).getByLabelText('Canjes máximos en total')).toHaveValue(100)
  expect(within(form).getByLabelText('Canjes máximos por usuario')).toHaveValue(2)

  fireEvent.change(within(form).getByLabelText('Nombre'), { target: { value: 'Tea' } })
  fireEvent.change(within(form).getByLabelText('Descripción'), { target: { value: 'A cup of tea' } })
  fireEvent.change(within(form).getByLabelText('Tipo de premio'), { target: { value: 'discount_fixed' } })
  fireEvent.change(within(form).getByLabelText('Valor'), { target: { value: '5' } })
  fireEvent.change(within(form).getByLabelText('Puntos necesarios'), { target: { value: '40' } })
  fireEvent.change(within(form).getByLabelText('Límite opcional por evento'), { target: { value: '50' } })
  fireEvent.change(within(form).getByLabelText('Condiciones'), { target: { value: 'New terms' } })
  fireEvent.change(within(form).getByLabelText('Válido desde'), { target: { value: '2030-02-01T10:00' } })
  fireEvent.change(within(form).getByLabelText('Válido hasta'), { target: { value: '2030-04-01T10:00' } })
  fireEvent.change(within(form).getByLabelText('Canjes máximos en total'), { target: { value: '150' } })
  fireEvent.change(within(form).getByLabelText('Canjes máximos por usuario'), { target: { value: '3' } })
  fireEvent.click(within(form).getByRole('button', { name: 'Guardar cambios en Kivly' }))

  await waitFor(() => expect(kivlyApi.updateReward).toHaveBeenCalledWith('ABC123', 'coffee', {
    title: 'Tea', description: 'A cup of tea', rewardType: 'discount_fixed',
    value: 5, pointsRequired: 40, image: 'https://cdn.kivly.store/coffee.png',
    termsAndConditions: 'New terms', validFrom: new Date('2030-02-01T10:00').toISOString(),
    validUntil: new Date('2030-04-01T10:00').toISOString(),
    maxRedemptions: 150, maxRedemptionsPerUser: 3,
  }))
  expect(await screen.findByText('Premio actualizado en Kivly. Guarda para aplicar el límite por evento y la imagen.'))
    .toBeInTheDocument()
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  expect(vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog.find((item) => item.id === 'coffee-card'))
    .toMatchObject({ name: 'Tea', stockTotal: 50, rewardId: 'coffee' })
})

it('requires a detail refresh before retrying an uncertain Kivly reward update', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({
    ...structuredClone(response),
    program: {
      ...structuredClone(response.program),
      catalog: [...structuredClone(response.program.catalog), {
        id: 'coffee-card', source: 'kivly', rewardId: 'coffee', locationId: 'loc',
        name: 'Coffee', stockTotal: 30,
      }],
    },
  })
  vi.mocked(kivlyApi.updateReward).mockRejectedValueOnce(Object.assign(
    new Error('Kivly API error: 503'), { code: 'KivlyRewardUpdateUncertain' },
  ))
  mount()
  await screen.findByRole('article', { name: 'Coffee' })
  fireEvent.click(screen.getByRole('button', { name: 'Editar premio Coffee' }))
  const form = await screen.findByRole('region', { name: 'Editar premio' })
  fireEvent.click(within(form).getByRole('button', { name: 'Guardar cambios en Kivly' }))
  expect(await within(form).findByRole('alert')).toHaveTextContent('No se pudo confirmar la actualización')
  expect(within(form).getByRole('button', { name: 'Guardar cambios en Kivly' })).toBeDisabled()
  expect(stackPrizeApi.save).not.toHaveBeenCalled()

  fireEvent.click(within(form).getByRole('button', { name: 'Actualizar datos de Kivly y revisar' }))
  await within(form).findByText('Datos actualizados desde Kivly. Revisa antes de volver a guardar.')
  expect(kivlyApi.getReward).toHaveBeenCalledTimes(2)
  expect(within(form).getByRole('button', { name: 'Guardar cambios en Kivly' })).toBeEnabled()
  expect(kivlyApi.updateReward).toHaveBeenCalledTimes(1)
})

it('hides Kivly reward creation when the account is disconnected', async () => {
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
    connected: false, locationId: null, locations: [],
  })
  mount()
  await screen.findByText('Catálogo de premios')
  expect(screen.queryByRole('button', { name: 'Crear en Kivly' })).not.toBeInTheDocument()
})

it('requires a catalog refresh before retrying an uncertain creation', async () => {
  vi.mocked(kivlyApi.createReward).mockRejectedValueOnce(Object.assign(
    new Error('Kivly API error: 503'), { code: 'KivlyRewardCreationUncertain' },
  ))
  mount()
  await openCreate('kivly')
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tea' } })
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'A cup of tea' } })
  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear en Kivly' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar la creación')
  expect(screen.getByRole('button', { name: 'Crear en Kivly' })).toBeDisabled()

  fireEvent.click(screen.getByRole('button', { name: 'Actualizar catálogo y revisar' }))
  await screen.findByText('No se encontró un premio con ese nombre. Ya puedes volver a intentar.')
  expect(screen.getByRole('button', { name: 'Crear en Kivly' })).toBeEnabled()
  expect(kivlyApi.createReward).toHaveBeenCalledTimes(1)
})

it('adds a local STAND prize without creating anything in Kivly', async () => {
  vi.mocked(fetchSharedPrizeCatalog).mockResolvedValue({
    catalog: [
      { id: 'shared-pizza', name: 'Pizza', imageKey: null, imageUrl: null },
      { id: 'shared-gift', name: 'Gift', imageKey: 'prizes/owner/gift.png', imageUrl: 'https://media.example/gift.png' },
    ],
    revision: 1,
  })
  mount()
  await openCreate()
  expect(fetchSharedPrizeCatalog).toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Premio del catálogo general'), { target: { value: 'shared-gift' } })
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Límite opcional por evento' }), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear premio STAND' }))
  await screen.findByRole('article', { name: 'Gift' })
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  expect(vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog).toEqual(expect.arrayContaining([
    expect.objectContaining({
      source: 'stand', name: 'Gift', sharedPrizeId: 'shared-gift',
      imageKey: 'prizes/owner/gift.png', stockTotal: 25,
    }),
  ]))
  expect(kivlyApi.createReward).not.toHaveBeenCalled()
})

it('keeps condition editing out of the prize catalog', async () => {
  mount()
  await screen.findByRole('article', { name: 'Pizza' })
  expect(screen.queryByLabelText('Condición 1')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Añadir regla' })).not.toBeInTheDocument()
  expect(screen.getByText(/Las condiciones se configuran desde el icono/)).toBeInTheDocument()
})

it('keeps global availability separate from edited event caps', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({
    ...structuredClone(response), inventory: [{ prizeId: 'pizza', total: 100, remaining: 97 }],
  })
  mount()
  const card = await screen.findByRole('article', { name: 'Pizza' })
  expect(card).toHaveTextContent('Margen del evento: 97')
  expect(card).toHaveTextContent('Disponible compartido: —')
  fireEvent.change(screen.getByLabelText('Límite por evento de Pizza'), { target: { value: '8' } })
  expect(card).toHaveTextContent('Disponible compartido: —')
  expect(screen.queryByText('STAND · Recogida con QR')).not.toBeInTheDocument()
  expect(screen.queryByText('Sin cambios pendientes')).not.toBeInTheDocument()
  save()
  expect(await screen.findByText('Premios guardados. Los premios ya ganados se conservan.')).toBeInTheDocument()
})

it('retries the external catalog without replacing unsaved edits', async () => {
  vi.mocked(kivlyApi.listRewards).mockRejectedValueOnce(new Error('Unavailable'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar Kivly.')
  fireEvent.change(screen.getByLabelText('Límite por evento de Pizza'), { target: { value: '8' } })
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await screen.findByRole('article', { name: 'Coffee' })
  expect(screen.getByLabelText('Límite por evento de Pizza')).toHaveValue(8)
  expect(stackPrizeApi.get).toHaveBeenCalledTimes(1)
})

it('uses a stable local ID for a long external reward ID', async () => {
  const externalId = 'reward'.repeat(80)
  vi.mocked(kivlyApi.listRewards).mockResolvedValue([{ id: externalId, name: 'Long reward' }])
  mount()
  await screen.findByRole('article', { name: 'Long reward' })
  fireEvent.click(screen.getByRole('button', { name: 'Añadir a la partida' }))
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  const selected = vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog.find((prize) => prize.source === 'kivly')!
  expect(selected.id.length).toBeLessThanOrEqual(80)
  expect(selected.rewardId).toBe(externalId)
})

it('keeps edits and retry available after a failed save', async () => {
  vi.mocked(stackPrizeApi.save).mockRejectedValue(new Error('Unavailable'))
  const { onPersist } = mount()
  fireEvent.change(await screen.findByLabelText('Límite por evento de Pizza'), { target: { value: '8' } })
  save()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unavailable')
  expect(screen.getByLabelText('Límite por evento de Pizza')).toHaveValue(8)
  expect(screen.getByRole('button', { name: 'Guardar premios' })).toBeEnabled()
  expect(onPersist).not.toHaveBeenCalled()
})

it('does not expose per-event image editing for a shared STAND prize', async () => {
  mount()
  await screen.findByRole('article', { name: 'Pizza' })
  expect(screen.queryByLabelText('Imagen de Pizza')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Opciones de imagen para Pizza' })).toBeDisabled()
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
})

it('locks prize editing after closure starts', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...response, state: 'closing' })
  mount()
  expect(await screen.findByLabelText('Límite por evento de Pizza')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Confirmar cierre' })).not.toBeInTheDocument()
})

it('filters only the cards by name without changing rule choices or unsaved stock', async () => {
  mount()
  await screen.findByRole('article', { name: 'Coffee' })
  fireEvent.change(screen.getByLabelText('Límite por evento de Pizza'), { target: { value: '8' } })
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar premios' }), { target: { value: ' COFF ' } })
  expect(screen.queryByRole('article', { name: 'Pizza' })).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Coffee' })).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar premios' }), { target: { value: 'missing' } })
  expect(screen.getByText('No hay premios que coincidan con la búsqueda.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Añadir premio al grupo 1.1')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar premios' }), { target: { value: '' } })
  expect(screen.getByLabelText('Límite por evento de Pizza')).toHaveValue(8)
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
})

it('provides a four-card desktop row and navigates horizontally in both directions', async () => {
  vi.mocked(kivlyApi.listRewards).mockResolvedValue(Array.from({ length: 5 }, (_, index) => ({
    id: `reward-${index}`, name: `Reward ${index}`,
  })))
  mount()
  await screen.findByRole('article', { name: 'Reward 4' })
  const cards = screen.getAllByRole('article')
  expect(cards).toHaveLength(6)
  cards.forEach((card) => expect(card).toHaveClass('shrink-0', 'lg:basis-[calc((100%_-_1.5rem)/4)]'))
  const scroller = cards[0].parentElement!
  const scrollBy = vi.fn()
  Object.defineProperty(scroller, 'clientWidth', { value: 800 })
  scroller.scrollBy = scrollBy
  fireEvent.click(screen.getByRole('button', { name: 'Premios siguientes' }))
  expect(scrollBy).toHaveBeenLastCalledWith({ left: 800, behavior: 'smooth' })
  fireEvent.click(screen.getByRole('button', { name: 'Premios anteriores' }))
  expect(scrollBy).toHaveBeenLastCalledWith({ left: -800, behavior: 'smooth' })
})

it('places the delivery policy after the catalog and gives every dropdown readable colors', async () => {
  mount()
  const delivery = await screen.findByRole('heading', { name: 'Entrega de premios' })
  const catalog = screen.getByText('Catálogo de premios')
  expect(catalog.compareDocumentPosition(delivery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await openCreate('kivly')
  screen.getAllByRole('combobox').forEach((select) => {
    expect(select).toHaveClass('bg-transparent', 'stack-prize-select')
  })
})

it('uploads a Kivly image locally and keeps its durable key when saving', async () => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:kivly-preview')
    static revokeObjectURL = vi.fn()
  })
  vi.mocked(uploadPrizeImage).mockResolvedValue('staged/kivly.png')
  mount()
  await openCreate('kivly')
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Límite opcional por evento' }), { target: { value: '42' } })
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tea' } })
  fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'A cup of tea' } })
  fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '5' } })
  const file = new File(['png'], 'tea.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Imagen del nuevo premio Kivly'), { target: { files: [file] } })
  await screen.findByRole('img', { name: 'Vista previa del nuevo premio' })
  fireEvent.click(screen.getByRole('button', { name: 'Crear en Kivly' }))
  const card = await screen.findByRole('article', { name: 'New reward' })
  expect(within(card).getByRole('img', { name: 'Vista previa del premio New reward' })).toHaveAttribute('src', 'blob:kivly-preview')
  expect(validatePrizeImage).toHaveBeenCalledWith(file)
  expect(uploadPrizeImage).toHaveBeenCalledWith('ABC123', 'ranking', file)
  expect(kivlyApi.createReward).toHaveBeenCalledWith('ABC123', expect.not.objectContaining({ image: expect.anything() }))
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalledWith('ABC123', expect.objectContaining({
    catalog: expect.arrayContaining([expect.objectContaining({ source: 'kivly', rewardId: 'new-reward', imageKey: 'staged/kivly.png', stockTotal: 42 })]),
  })))
})

it('validates optional event caps for both creation sources and uses footer logos', async () => {
  mount()
  await openCreate()
  fireEvent.change(screen.getByLabelText('Premio del catálogo general'), { target: { value: 'shared-pizza' } })
  for (const stock of ['-1', '1.5']) {
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Límite opcional por evento' }), { target: { value: stock } })
    expect(screen.getByRole('button', { name: 'Crear premio STAND' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('El límite debe ser un entero ≥ 0 o vacío (sin límite).')
  }
  for (const stock of ['', '0', '1001']) {
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Límite opcional por evento' }), { target: { value: stock } })
    expect(screen.getByRole('button', { name: 'Crear premio STAND' })).toBeEnabled()
  }
  await waitFor(() => expect(screen.getByRole('option', { name: 'Kivly' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Origen del premio'), { target: { value: 'kivly' } })
  expect(screen.getByRole('spinbutton', { name: 'Límite opcional por evento' })).toHaveValue(null)
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Límite opcional por evento' }), { target: { value: '-1' } })
  expect(screen.getByRole('button', { name: 'Crear en Kivly' })).toBeDisabled()
  const stand = within(screen.getByRole('article', { name: 'Pizza' })).getByRole('img', { name: 'STAND' })
  const kivly = within(screen.getByRole('article', { name: 'Coffee' })).getByRole('img', { name: 'Kivly' })
  expect(stand).toHaveAttribute('src', '/images/logo-stand-footer.png')
  expect(kivly).toHaveAttribute('src', '/images/logo-kivly-footer.png')
  expect(screen.getByRole('button', { name: 'Opciones de imagen para Pizza' }).parentElement).toHaveClass('bg-transparent')
})

it('uploads an image from an unconfigured Kivly card and adds it to the game inventory', async () => {
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:coffee')
    static revokeObjectURL = vi.fn()
  })
  vi.mocked(uploadPrizeImage).mockResolvedValue('staged/coffee.png')
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Opciones de imagen para Coffee' }))
  expect(screen.getByRole('button', { name: 'Opciones de imagen para Coffee' })).toHaveAttribute('aria-expanded', 'true')
  fireEvent.change(screen.getByLabelText('Imagen de Coffee'), {
    target: { files: [new File(['png'], 'coffee.png', { type: 'image/png' })] },
  })
  await screen.findByLabelText('Límite por evento de Coffee')
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalledWith('ABC123', expect.objectContaining({
    catalog: expect.arrayContaining([expect.objectContaining({ source: 'kivly', rewardId: 'coffee', imageKey: 'staged/coffee.png' })]),
  })))
  expect(kivlyApi.createReward).not.toHaveBeenCalled()
})
