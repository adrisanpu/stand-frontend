import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stackPrizeApi, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { kivlyApi } from '../../api/kivlyApi'
import { uploadPrizeImage, validatePrizeImage } from '../../api/prizeMedia'
import StackPrizeSettings from './StackPrizeSettings'

vi.mock('../../api/stackPrizes', () => ({ stackPrizeApi: { get: vi.fn(), save: vi.fn(), close: vi.fn(), retryEmail: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({
  kivlyApi: { getAccountConnection: vi.fn(), listRewards: vi.fn(), createReward: vi.fn() },
}))
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
  vi.mocked(kivlyApi.createReward).mockResolvedValue({ id: 'new-reward', name: 'New reward' })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function mount() {
  const onPersist = vi.fn()
  render(<StackPrizeSettings gameId="ABC123" raffles onPersist={onPersist} />)
  return { onPersist }
}
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar reglas de premios' }))
async function openCreate(source: 'stand' | 'kivly' = 'stand') {
  fireEvent.click(await screen.findByRole('button', { name: '+ CREAR' }))
  if (source === 'kivly') {
    await waitFor(() => expect(screen.getByRole('option', { name: 'Kivly' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Origen del premio'), { target: { value: 'kivly' } })
  }
}

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
  expect(await screen.findByText('Premio creado en Kivly. Guarda para aplicar el inventario y la imagen al juego.')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Crear premio' })).not.toBeInTheDocument()
  await waitFor(() => expect(kivlyApi.listRewards).toHaveBeenCalledTimes(2))
  expect(stackPrizeApi.save).not.toHaveBeenCalled()
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
  mount()
  await openCreate()
  fireEvent.change(screen.getByLabelText('Nombre del premio STAND'), { target: { value: 'Bebida' } })
  fireEvent.change(screen.getByLabelText('Stock inicial'), { target: { value: '25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear premio STAND' }))
  await screen.findByRole('article', { name: 'Bebida' })
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  expect(vi.mocked(stackPrizeApi.save).mock.calls[0][1].catalog).toEqual(expect.arrayContaining([
    expect.objectContaining({ source: 'stand', name: 'Bebida', stockTotal: 25 }),
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
  const card = await screen.findByRole('article', { name: 'Pizza' })
  expect(card).toHaveTextContent('Disponibles: 97')
  expect(card).toHaveTextContent('Entregados: 3')
  fireEvent.change(screen.getByLabelText('Inventario total Y de Pizza'), { target: { value: '8' } })
  expect(card).toHaveTextContent('Disponibles: 5')
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
  await screen.findByText('Catálogo de premios')
  fireEvent.click(screen.getByRole('button', { name: 'Añadir regla' }))
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Condición 2'), { target: { value: 'top_final' } })
  expect(screen.getByLabelText('Top 2')).toHaveValue(10)
  expect(screen.getAllByRole('option', { name: 'entre en el top al terminar su partida' })).toHaveLength(2)
})

it('configures a score range prize rule with inclusive bounds', async () => {
  mount()
  await screen.findByText('Catálogo de premios')
  fireEvent.change(screen.getByLabelText('Condición 1'), { target: { value: 'score' } })
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Operador de puntuación 1'), { target: { value: 'between' } })
  fireEvent.change(screen.getByLabelText('Puntuación mínima 1'), { target: { value: '10' } })
  fireEvent.change(screen.getByLabelText('Puntuación máxima 1'), { target: { value: '20' } })
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeEnabled()
  fireEvent.change(screen.getByLabelText('Puntuación máxima 1'), { target: { value: '9' } })
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Puntuación máxima 1'), { target: { value: '20' } })
  expect(screen.getByRole('button', { name: 'Guardar reglas de premios' })).toBeEnabled()
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalled())
  expect(vi.mocked(stackPrizeApi.save).mock.calls[0][1].rules[0]).toMatchObject({
    condition: 'score', scoreOperator: 'between', scoreValue: 10, scoreMaxValue: 20,
  })
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

it('filters only the cards by name without changing rule choices or unsaved stock', async () => {
  mount()
  await screen.findByRole('article', { name: 'Coffee' })
  fireEvent.change(screen.getByLabelText('Inventario total Y de Pizza'), { target: { value: '8' } })
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar premios' }), { target: { value: ' COFF ' } })
  expect(screen.queryByRole('article', { name: 'Pizza' })).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Coffee' })).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar premios' }), { target: { value: 'missing' } })
  expect(screen.getByText('No hay premios que coincidan con la búsqueda.')).toBeInTheDocument()
  expect(within(screen.getByLabelText('Añadir premio al grupo 1.1')).getByRole('option', { name: 'Coffee' })).toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar premios' }), { target: { value: '' } })
  expect(screen.getByLabelText('Inventario total Y de Pizza')).toHaveValue(8)
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

it('places delivery after the rules and gives every dropdown readable colors', async () => {
  mount()
  const delivery = await screen.findByLabelText('Entrega de premios Kivly')
  const rule = screen.getByRole('region', { name: 'Regla 1' })
  expect(rule.compareDocumentPosition(delivery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
  fireEvent.change(screen.getByLabelText('Stock inicial'), { target: { value: '42' } })
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

it('validates initial stock for both creation sources and uses footer logos', async () => {
  mount()
  await openCreate()
  fireEvent.change(screen.getByLabelText('Nombre del premio STAND'), { target: { value: 'Gift' } })
  for (const stock of ['', '0', '1001', '1.5']) {
    fireEvent.change(screen.getByLabelText('Stock inicial'), { target: { value: stock } })
    expect(screen.getByRole('button', { name: 'Crear premio STAND' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('El stock debe ser un entero entre 1 y 1000.')
  }
  await waitFor(() => expect(screen.getByRole('option', { name: 'Kivly' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Origen del premio'), { target: { value: 'kivly' } })
  expect(screen.getByLabelText('Stock inicial')).toHaveValue(100)
  fireEvent.change(screen.getByLabelText('Stock inicial'), { target: { value: '0' } })
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
  await screen.findByLabelText('Inventario total Y de Coffee')
  save()
  await waitFor(() => expect(stackPrizeApi.save).toHaveBeenCalledWith('ABC123', expect.objectContaining({
    catalog: expect.arrayContaining([expect.objectContaining({ source: 'kivly', rewardId: 'coffee', imageKey: 'staged/coffee.png' })]),
  })))
  expect(kivlyApi.createReward).not.toHaveBeenCalled()
})
