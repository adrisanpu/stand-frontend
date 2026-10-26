import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import { kivlyApi } from '../../api/kivlyApi'
import type { GameConfigProps, GameDefinition } from '../types'
import GameConfigPanel, { GAME_CONFIG_SAVE_LABEL } from './GameConfigPanel'
import T1merConfig from '../../games/t1mer/GameConfig'
import L3trasConfig from '../../games/l3tras/GameConfig'
import InfocardsConfig from '../../games/infocards/GameConfig'
import Rulet4Config from '../../games/rulet4/GameConfig'
import StackConfig from '../../games/stack/GameConfig'
import ImpostorConfig from '../../games/impostor/GameConfig'
import Empareja2Config from '../../games/empareja2/GameConfig'
import { DEFAULT_STACK_CONFIG } from '../../games/stack/stackLogic'
import { GAME_ACCESS_CAPABILITIES } from './gameAccess'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({
  kivlyApi: { getAccountConnection: vi.fn(), get: vi.fn(), listRewards: vi.fn(), saveReward: vi.fn() },
}))

const colors = { primary: '#000', accent: '#000', background: '#000', surface: '#000', textMain: '#fff', textSub: '#fff' }
function definition(id: string, GameConfigComponent?: React.ComponentType<GameConfigProps>): GameDefinition {
  return { id, name: id, colors, GameScreen: () => null, GameConfigComponent }
}

function gameResponse(game: Record<string, unknown> = {}) {
  return { ok: true, game: { playMode: 'master', joinChannel: 'instagram', participantFields: { email: { required: true } }, ...game } }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({ connected: false, locationId: null, locations: [] })
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url.startsWith('/v1/game/infocards')) return { ok: true, cards: [{ id: 'c1', title: 'Hola', body: 'Texto', order: 0 }] }
    return gameResponse()
  })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
})
afterEach(cleanup)

function mount(def: GameDefinition, settings: any = {}) {
  const onSaved = vi.fn()
  const onSettingsChange = vi.fn()
  const onSavingChange = vi.fn()
  render(
    <GameConfigPanel gameId="ABC123" gameDefinition={def} settings={settings}
      onSaved={onSaved} onSettingsChange={onSettingsChange} onSavingChange={onSavingChange} />,
  )
  return { onSaved, onSettingsChange, onSavingChange }
}

const footer = () => screen.getByRole('button', { name: GAME_CONFIG_SAVE_LABEL })

describe('mobile event links', () => {
  const configs = { EMPAREJA2: Empareja2Config, T1MER: T1merConfig, STACK: StackConfig }
  const cases = Object.entries(configs).flatMap(([id, Config]) => {
    const capabilities = GAME_ACCESS_CAPABILITIES[id]
    return capabilities.playModes.flatMap((playMode) =>
      capabilities.joinChannels.map((joinChannel) => ({ id, Config, playMode, joinChannel })),
    )
  })

  it.each(cases)('shows one event link set for $id / $playMode / $joinChannel', async ({ id, Config, playMode, joinChannel }) => {
    vi.mocked(api.get).mockResolvedValue(gameResponse({
      playMode, joinChannel, type: { STACK: DEFAULT_STACK_CONFIG },
    }))
    mount(definition(id, Config))
    await waitFor(() => expect(footer()).toBeEnabled())
    const participant = screen.getByRole('link', { name: 'Participante' })
    const validator = screen.getByRole('link', { name: 'Validador de premios' })
    expect(participant).toHaveAttribute('href', `${window.location.origin}/play/ABC123`)
    expect(validator).toHaveAttribute('href', `${window.location.origin}/redeem/ABC123`)
    for (const link of [participant, validator]) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
    const qr = screen.getByRole('img', { name: 'QR validador de premios' })
    expect(new URL(qr.getAttribute('src')!).searchParams.get('data')).toBe(validator.getAttribute('href'))
    expect(new URL(qr.getAttribute('src')!).searchParams.get('size')).toBe('80x80')
    const participantQr = screen.getByRole('img', { name: 'QR participante' })
    expect(new URL(participantQr.getAttribute('src')!).searchParams.get('data')).toBe(participant.getAttribute('href'))
    expect(participant.parentElement).toContainElement(participantQr)
    expect(validator.parentElement).toContainElement(qr)
    const section = screen.getByRole('region', { name: 'Enlaces del evento' })
    expect(section).toHaveClass('grid', 'grid-cols-3')
    expect(section.children).toHaveLength(3)
    expect(within(section).getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.queryByText('Enlaces del evento')).not.toBeInTheDocument()
    expect(screen.getByText('∞ móviles')).toBeInTheDocument()
    expect(screen.getByText('Web')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Instagram' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 pantalla' })).not.toBeInTheDocument()
    const accessInfo = screen.getByRole('group', { name: 'Acceso del participante' }).parentElement!.parentElement!
    expect(accessInfo).toContainElement(section)
    if (id !== 'T1MER') {
      const rules = id === 'STACK' ? screen.getByLabelText('Velocidad inicial') : screen.getByText('Dificultad para encontrar a tu pareja')
      expect(section.compareDocumentPosition(rules) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
    }
  })

  it.each(Object.keys(GAME_ACCESS_CAPABILITIES))('shows mobile links for %s', async (id) => {
    mount(definition(id))
    await waitFor(() => expect(footer()).toBeEnabled())
    expect(screen.getByRole('region', { name: 'Enlaces del evento' })).toBeInTheDocument()
  })
})

describe('unified game configuration save', () => {
  it('loads RULET4 rules from the server and persists them through the shared save action', async () => {
    const rules = { panels: [{ id: 'red', label: 'Rojo', color: '#DC2626', count: 4 }] }
    vi.mocked(api.get).mockResolvedValue(gameResponse({
      playMode: 'mobile', joinChannel: 'web', type: { RULET4: rules },
    }))
    const { onSaved } = mount(definition('RULET4', Rulet4Config))
    await waitFor(() => expect(footer()).toBeEnabled())
    expect(await screen.findByDisplayValue('Rojo')).toBeInTheDocument()
    fireEvent.click(footer())
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'ABC123', settings: { rulet4: rules },
    })
  })

  it('keeps Kivly setup out of non-STACK game configuration', async () => {
    mount(definition('T1MER'))
    await waitFor(() => expect(footer()).toBeEnabled())
    expect(screen.queryByRole('region', { name: 'Kivly' })).not.toBeInTheDocument()
    expect(kivlyApi.getAccountConnection).not.toHaveBeenCalled()
    expect(kivlyApi.get).not.toHaveBeenCalled()
  })

  it('saves the STACK completion reward with the existing game footer', async () => {
    const clubSettings = { clubName: 'Club', privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms' }
    vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
      connected: true, locationId: 'location1', locations: [{ id: 'location1', name: 'Club' }], clubSettings,
    })
    vi.mocked(kivlyApi.get).mockResolvedValue({ ok: true, connection: { connected: true }, settings: { enabled: true, ...clubSettings } })
    vi.mocked(kivlyApi.listRewards).mockResolvedValue([{ id: 'reward1', name: 'Coffee' }])
    vi.mocked(kivlyApi.saveReward).mockResolvedValue()
    const { onSaved } = mount(definition('STACK'))
    const select = await screen.findByLabelText('Premio Kivly al terminar')
    fireEvent.change(select, { target: { value: 'reward1' } })
    expect(kivlyApi.saveReward).not.toHaveBeenCalled()
    fireEvent.click(footer())
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(kivlyApi.saveReward).toHaveBeenCalledWith('ABC123', 'reward1')
    expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
      participantFields: { email: { required: true }, phone: { required: false, enabled: false } },
    }))
  })

  it.each(['EMPAREJA2', 'T1MER', 'STACK'])('loads and saves all participant fields centrally for %s', async (id) => {
    const participantFields = { email: { required: false }, phone: { required: true } }
    vi.mocked(api.get).mockResolvedValue(gameResponse({
      playMode: 'mobile', joinChannel: 'web', participantFields,
    }))
    const { onSaved } = mount(definition(id, id === 'EMPAREJA2' ? Empareja2Config : id === 'T1MER' ? T1merConfig : undefined))
    await waitFor(() => expect(footer()).toBeEnabled())
    expect(screen.getByText('Nombre completo y email obligatorios')).toBeInTheDocument()
    expect(screen.queryByLabelText('Instagram')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Mostrar teléfono (opcional)')).toBeChecked()
    expect(within(screen.getByRole('region', { name: 'Enlaces del evento' })).getAllByRole('checkbox')).toHaveLength(1)
    const expectedFields = { email: { required: true }, phone: { required: false, enabled: true } }
    fireEvent.click(footer())
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ participantFields: expectedFields })))
    expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'ABC123', playMode: 'mobile', joinChannel: 'web',
      participantFields: expectedFields,
    })
    const writes = vi.mocked(api.put).mock.calls.filter(([, body]) => 'participantFields' in (body as Record<string, unknown>))
    expect(writes).toHaveLength(1)
  })

  it('disables participant fields while loading and saving and reports persistence failures', async () => {
    vi.mocked(api.get).mockResolvedValue(gameResponse({ playMode: 'mobile' }))
    let resolvePut: (value: unknown) => void = () => {}
    vi.mocked(api.put).mockImplementationOnce(() => new Promise((resolve) => { resolvePut = resolve }))
    const { onSaved } = mount(definition('STACK'))
    expect(screen.getByLabelText('Mostrar teléfono (opcional)')).toBeDisabled()
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(screen.getByLabelText('Mostrar teléfono (opcional)'))
    fireEvent.click(footer())
    expect(screen.getByLabelText('Mostrar teléfono (opcional)')).toBeDisabled()
    await act(async () => { resolvePut({ ok: false }) })
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Mostrar teléfono (opcional)')).toBeChecked()
    expect(screen.getByLabelText('Mostrar teléfono (opcional)')).toBeEnabled()
  })

  it('pairs L3TRAS short fields without changing their draft or validation', async () => {
    mount(definition('L3TRAS', L3trasConfig))
    await waitFor(() => expect(footer()).toBeEnabled())
    const word = screen.getByRole('textbox', { name: 'Palabra objetivo' })
    const time = screen.getByRole('spinbutton', { name: 'Tiempo para completar la palabra (segundos)' })
    const grid = word.parentElement?.parentElement
    expect(grid).toBe(time.parentElement?.parentElement)
    expect(grid).toHaveClass('grid', 'grid-cols-2')
    fireEvent.change(word, { target: { value: 'PIZZA' } })
    fireEvent.change(time, { target: { value: '90' } })
    expect(api.put).not.toHaveBeenCalled()
    fireEvent.click(footer())
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'ABC123', settings: { l3tras: { objectiveWord: 'PIZZA', validationTimeLimitSeconds: 90 } },
    }))
  })

  it('pairs all four STACK parameters and omits redundant introductory copy', async () => {
    vi.mocked(api.get).mockResolvedValue(gameResponse({
      playMode: 'mobile', type: { STACK: DEFAULT_STACK_CONFIG },
    }))
    mount(definition('STACK', StackConfig))
    await waitFor(() => expect(screen.getByLabelText('Velocidad inicial')).toBeEnabled())
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs).toHaveLength(4)
    const grid = inputs[0].parentElement?.parentElement
    expect(grid).toHaveClass('grid', 'grid-cols-2')
    inputs.forEach((input) => expect(input.parentElement?.parentElement).toBe(grid))
    expect(screen.queryByText('STACK · Móviles')).not.toBeInTheDocument()
    expect(screen.queryByText(/Un único intento por participante/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /guardar/i })).toHaveLength(1)
  })

  it('keeps the IMPOSTOR player limit compact and its long word editor full width', async () => {
    mount(definition('IMPOSTOR', ImpostorConfig))
    await waitFor(() => expect(footer()).toBeEnabled())
    const grid = screen.getByLabelText('Jugadores máximos (3-25)').parentElement?.parentElement
    expect(grid).toHaveClass('grid', 'grid-cols-2')
    expect(grid).not.toContainElement(screen.getByLabelText('Palabras (una por línea)'))
    expect(screen.getByLabelText('Palabras (una por línea)')).toHaveClass('w-full')
  })

  it('pairs INFOCARDS generation counts without narrowing the description editor', async () => {
    mount(definition('INFOCARDS', InfocardsConfig))
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'IA' }))
    const grid = screen.getByLabelText('Nº de tarjetas').parentElement?.parentElement
    expect(grid).toHaveClass('grid', 'grid-cols-2')
    fireEvent.click(screen.getByLabelText('Generar Quiz'))
    expect(screen.getByLabelText('Nº preguntas').parentElement?.parentElement).toBe(grid)
    expect(screen.getByLabelText('Nº respuestas').parentElement?.parentElement).toBe(grid)
    expect(grid).not.toContainElement(screen.getByPlaceholderText('Describe tu producto, servicio o marca aquí...'))
    expect(api.put).not.toHaveBeenCalled()
  })

  it.each([
    ['T1MER', T1merConfig],
    ['L3TRAS', L3trasConfig],
    ['RULET4', Rulet4Config],
    ['INFOCARDS', InfocardsConfig],
    ['CUPIDO', undefined],
  ] as const)('renders a single footer save button for %s', async (id, Config) => {
    mount(definition(id, Config))
    await waitFor(() => expect(footer()).toBeEnabled())
    expect(screen.queryByRole('button', { name: 'Guardar modo y acceso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar configuración' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /guardar/i })).toHaveLength(1)
  })

  it('does not autosave selections and persists access plus rules together', async () => {
    const { onSaved, onSettingsChange } = mount(definition('T1MER', T1merConfig))
    await waitFor(() => expect(footer()).toBeEnabled())
    await waitFor(() => expect(screen.queryByText('Cargando configuración...')).not.toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Mostrar teléfono (opcional)'))
    expect(screen.getByText('Participante')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
    expect(onSettingsChange).not.toHaveBeenCalled()

    fireEvent.click(footer())
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'ABC123', playMode: 'mobile', joinChannel: 'web',
      participantFields: { email: { required: true }, phone: { required: false, enabled: true } },
    })
    expect(onSaved).toHaveBeenCalledWith({
      playMode: 'mobile', joinChannel: 'web',
      participantFields: { email: { required: true }, phone: { required: false, enabled: true } },
    })
    expect(onSettingsChange).not.toHaveBeenCalled()
  })

  it('saves access for games without a custom config component', async () => {
    const { onSaved } = mount(definition('CUPIDO'))
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(footer())
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({
      playMode: 'mobile', joinChannel: 'web',
    })))
    expect(api.put).toHaveBeenCalledTimes(1)
  })

  it('blocks saving when access fails to load and allows retry', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Sin conexión'))
    const { onSaved } = mount(definition('CUPIDO'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(footer()).toBeDisabled()
    fireEvent.click(footer())
    expect(api.put).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    await waitFor(() => expect(footer()).toBeEnabled())
  })

  it('reports rule save failures explicitly and does not apply or close', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('Servidor caído'))
    const { onSaved, onSettingsChange } = mount(definition('EMPAREJA2', Empareja2Config))
    await waitFor(() => expect(footer()).toBeEnabled())
    await waitFor(() => expect(screen.queryByText('Cargando configuración...')).not.toBeInTheDocument())
    fireEvent.click(footer())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El modo y acceso se guardaron, pero la configuración del juego no: Servidor caído',
    )
    expect(onSaved).not.toHaveBeenCalled()
    expect(onSettingsChange).not.toHaveBeenCalled()
    expect(footer()).toBeEnabled()
  })

  it('reports access save failures without saving rules', async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Acceso rechazado'))
    const { onSaved } = mount(definition('T1MER', T1merConfig))
    await waitFor(() => expect(footer()).toBeEnabled())
    await waitFor(() => expect(screen.queryByText('Cargando configuración...')).not.toBeInTheDocument())
    fireEvent.click(footer())
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el modo y acceso: Acceso rechazado')
    expect(api.put).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('refuses to save when the game rules failed to load', async () => {
    // The child rules component loads first (React runs child effects before parent effects).
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Reglas no disponibles'))
    const { onSaved } = mount(definition('T1MER', T1merConfig))
    expect(await screen.findByRole('alert')).toHaveTextContent('Reglas no disponibles')
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(footer())
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(api.put).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('keeps rule validation and persists nothing when it fails', async () => {
    mount(definition('L3TRAS', L3trasConfig), { objectiveWord: 'STAND' })
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.change(screen.getByPlaceholderText('STAND'), { target: { value: '' } })
    fireEvent.click(footer())
    expect(await screen.findByRole('alert')).toHaveTextContent('La palabra objetivo no puede estar vacía')
    expect(api.put).not.toHaveBeenCalled()
  })

  it('disables the form and footer while saving', async () => {
    let resolvePut: (value: unknown) => void = () => {}
    vi.mocked(api.put).mockImplementationOnce(() => new Promise((resolve) => { resolvePut = resolve }))
    const { onSaved, onSavingChange } = mount(definition('L3TRAS', L3trasConfig), { objectiveWord: 'STAND' })
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(footer())
    const busy = await screen.findByRole('button', { name: 'Guardando...' })
    expect(busy).toBeDisabled()
    expect(screen.getByPlaceholderText('STAND')).toBeDisabled()
    expect(onSavingChange).toHaveBeenLastCalledWith(true)
    fireEvent.click(busy)
    expect(api.put).toHaveBeenCalledTimes(1)
    await act(async () => { resolvePut({ ok: true }) })
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved.mock.calls[0][0]).toMatchObject({ objectiveWord: 'STAND', playMode: 'mobile', joinChannel: 'web' })
    expect(onSavingChange).toHaveBeenLastCalledWith(false)
  })

  it('keeps INFOCARDS layout edits as a draft until the footer save', async () => {
    const { onSaved, onSettingsChange } = mount(definition('INFOCARDS', InfocardsConfig))
    const layout = await screen.findByDisplayValue('Arriba')
    fireEvent.change(layout, { target: { value: 'left' } })
    expect(onSettingsChange).not.toHaveBeenCalled()
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(footer())
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved.mock.calls[0][0]).toMatchObject({ cardLayouts: { c1: 'left' }, playMode: 'mobile', joinChannel: 'web' })
    expect(api.put).toHaveBeenCalledTimes(1)
  })

  it('saves edited INFOCARDS cards through their endpoint before applying', async () => {
    const { onSaved } = mount(definition('INFOCARDS', InfocardsConfig))
    fireEvent.change(await screen.findByDisplayValue('Hola'), { target: { value: 'Nuevo' } })
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(footer())
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(api.put).toHaveBeenCalledWith('/v1/game/infocards', expect.objectContaining({
      gameId: 'ABC123',
      cards: [expect.objectContaining({ id: 'c1', title: 'Nuevo' })],
    }))
  })
})
