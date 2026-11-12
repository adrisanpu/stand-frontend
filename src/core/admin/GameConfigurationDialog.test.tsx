import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../../api/api'
import { DEFAULT_STACK_CONFIG } from '../../games/stack/stackLogic'
import type { StackPrizeSettingsResponse } from '../../api/stackPrizes'
import type { OperatorGameConfiguration } from '../../api/operatorGames'
import GameConfigurationDialog from './GameConfigurationDialog'
import type { GameFormResponse } from '../formConfig'
import { initialHomeCanvas } from '../home/canvasModel'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { getAccountConnection: async () => ({ connected: false, locationId: null, locations: [] }) } }))
const userPlan = vi.hoisted(() => ({ plan: 'event' }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ plan: userPlan.plan, loading: false }) }))
vi.mock('../../games/stack/BlockPreview', () => ({ default: () => <div /> }))
vi.mock('./GamePlayPreview', () => ({ default: () => <p>Local trial</p> }))
let snapshot: OperatorGameConfiguration
let prizes: StackPrizeSettingsResponse
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  userPlan.plan = 'event'
  snapshot = {
    ok: true, game: { gameId: 'SELECTED', gameName: 'Selected event', gameType: 'STACK', isActive: true, lifecycleState: 'active',
      type: { STACK: { ...DEFAULT_STACK_CONFIG } } },
    configuration: { ...DEFAULT_STACK_CONFIG }, rewardConditionsRevision: 'native-revision',
  }
  prizes = {
    globalInventory: null,
    ok: true, state: 'open', enabled: true, programRevision: 'original-revision', awards: [], allocations: [], pendingPlayers: [], inventory: [],
    program: { version: 3, storefrontUrl: '', catalog: [{ id: 'pizza', name: 'Pizza', source: 'stand', stockTotal: 100 }],
      rules: [{ id: 'rule', condition: 'completed', groups: [{ allocations: [{ prizeId: 'pizza', quantity: 1 }] }] }] },
  }
  vi.mocked(api.get).mockImplementation(async url => structuredClone(
    url === '/v1/prizes/catalog' ? { ok: true, catalog: [], revision: 1 }
      : url === '/v1/prizes/inventory' ? { ok: true, mode: 'reservations', catalog: [], imports: {}, unresolved: 0 }
      : url.startsWith('/v1/game/stack/prizes') ? prizes
      : url.endsWith('&home=true') ? {
        ok: true, gameId: 'SELECTED', gameType: 'STACK', readOnly: false, homeRevision: 'home-r1',
        homeCanvas: initialHomeCanvas(true, true), homeBackgroundUrls: { landscape: null, portrait: null },
      } : url.endsWith('&form=true') ? {
        ok: true, gameId: 'SELECTED', gameType: 'STACK', revision: 'form-r1', locked: false, readOnly: false,
        joinUrl: '/play/SELECTED', logoUrl: null, bannerUrl: null,
        formConfig: { registrationTitle: '', registrationDescription: '', quizTitle: '', quizDescription: '',
          logoKey: null, bannerKey: null, appearance: null, quizMoment: 'disabled' },
        participantFields: { email: { required: true }, phone: { enabled: true, required: true } }, questions: [],
      } : snapshot))
  vi.mocked(api.put).mockImplementation(async (_, body) => {
    const request = body as { settings?: { stack: Record<string, unknown> }; rules?: StackPrizeSettingsResponse['program']['rules'] }
    if (request.settings) {
      snapshot.configuration = { ...snapshot.configuration, ...request.settings.stack }
      return { ok: true, game: snapshot.game }
    }
    return { ok: true, program: { ...prizes.program, rules: request.rules }, programRevision: 'new-revision' }
  })
})
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })
function mount() {
  const onClose = vi.fn()
  render(<MemoryRouter><GameConfigurationDialog gameId="SELECTED" initialSection="configuration" onClose={onClose} /></MemoryRouter>)
  return onClose
}
it.each(['STACK', 'T1MER', 'EMPAREJA2', 'RULET4', 'L3TRAS', 'IMPOSTOR', 'SEMAFORO', 'INFOCARDS'])(
  'uses shared responsive configuration and preview columns for %s', async gameType => {
    snapshot.game.gameType = gameType
    snapshot.game.type = {}
    const originalGet = vi.mocked(api.get).getMockImplementation()!
    vi.mocked(api.get).mockImplementation(path => path.startsWith('/v1/game/infocards?')
      ? Promise.resolve({ ok: true, gameId: 'SELECTED', cards: [] })
      : originalGet(path))
    mount()
    const preview = await screen.findByRole('complementary', { name: 'Prueba del juego' })
    const grid = preview.parentElement!
    expect(grid).toHaveClass('grid', 'lg:grid-cols-2')
    expect(grid.children).toHaveLength(2)
    expect(grid.lastElementChild).toBe(preview)
    expect(grid.firstElementChild).not.toContainElement(preview)
  },
)

it('keeps form drafts across sections and guards closing until discard is explicit', async () => {
  const form: GameFormResponse = {
    ok: true, gameId: 'SELECTED', gameType: 'STACK', revision: 'form-r1', locked: false, readOnly: false,
    joinUrl: 'https://playstand.app/play/SELECTED', logoUrl: null, bannerUrl: null,
    formConfig: { registrationTitle: 'Join us', registrationDescription: '', quizTitle: '', quizDescription: '',
      logoKey: null, bannerKey: null, appearance: null, quizMoment: 'disabled' },
    participantFields: { email: { required: true }, phone: { enabled: true, required: true } }, questions: [],
  }
  const originalGet = vi.mocked(api.get).getMockImplementation()!
  vi.mocked(api.get).mockImplementation(path => path.endsWith('&form=true') ? Promise.resolve(form) : originalGet(path))
  const close = mount()
  await screen.findByRole('tab', { name: 'Game' })
  expect(screen.getByRole('tab', { name: 'Game' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tabpanel', { name: 'Game' })).not.toHaveTextContent('Imágenes y colores de esta partida')
  await screen.findByText('Lienzo sin cambios pendientes')
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Home' })).toBeEnabled())
  fireEvent.click(screen.getByRole('tab', { name: 'Home' }))
  await screen.findByRole('combobox', { name: 'Añadir componente' })
  expect(screen.getByRole('tabpanel', { name: 'Home' })).toHaveTextContent('Lienzo del Home')
  expect(screen.queryByText('Aspecto de la partida')).not.toBeInTheDocument()
  expect(screen.queryByText('Imágenes y colores de esta partida')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar aspecto' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Vista previa del formulario')).not.toBeInTheDocument()
  fireEvent.click(await screen.findByRole('tab', { name: 'Formulario de registro' }))
  fireEvent.change(await screen.findByLabelText('Título del registro'), { target: { value: 'Unsaved heading' } })
  expect(screen.queryByLabelText('Título del cuestionario')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Momento del cuestionario')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Color principal')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Cuestionario' }))
  expect(screen.getByRole('tabpanel', { name: 'Cuestionario' })).toBeVisible()
  expect(screen.queryByLabelText('Título del registro')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Solicitar teléfono')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Momento del cuestionario')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Título del cuestionario'), { target: { value: 'Unsaved questionnaire' } })
  expect(screen.getByRole('region', { name: 'Vista previa' })).toHaveTextContent('Unsaved questionnaire')
  fireEvent.click(screen.getByRole('tab', { name: 'Home' }))
  expect(screen.getByRole('button', { name: 'Guardar lienzo' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Vista previa del formulario')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Formulario de registro' }))
  expect(screen.getByLabelText('Título del registro')).toHaveValue('Unsaved heading')
  expect(screen.getByRole('region', { name: 'Vista previa' })).toHaveTextContent('Unsaved heading')
  fireEvent.click(screen.getByRole('tab', { name: 'Cuestionario' }))
  expect(screen.getByLabelText('Título del cuestionario')).toHaveValue('Unsaved questionnaire')
  fireEvent.click(screen.getByRole('tab', { name: 'Formulario de registro' }))
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=SELECTED&form=true')
  expect(vi.mocked(api.get).mock.calls.filter(([url]) => url.endsWith('&form=true'))).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  expect(screen.getByRole('alertdialog', { name: 'Descartar cambios' })).toBeInTheDocument()
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))
  expect(screen.getByLabelText('Título del registro')).toHaveValue('Unsaved heading')
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Descartar y cerrar' }))
  expect(close).toHaveBeenCalled()
  expect(api.put).not.toHaveBeenCalled()
})
async function ready() {
  fireEvent.click(await screen.findByRole('tab', { name: 'Premios' }))
  await screen.findByLabelText('Cantidad de Pizza · 1.1')
  fireEvent.click(screen.getByRole('tab', { name: 'Game' }))
}

it.each(['STACK', 'T1MER'])('shows the event validator QR and link above prize settings for %s', async gameType => {
  snapshot.game.gameType = gameType
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Premios' }))
  const link = screen.getByRole('link', { name: 'Abrir validador de premios' })
  const url = `${window.location.origin}/redeem/SELECTED`
  expect(link).toHaveAttribute('href', url)
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noreferrer')
  const qr = screen.getByRole('img', { name: 'QR validador de premios' })
  expect(qr).toHaveAttribute('data-qr-value', url)
  const panel = screen.getByRole('tabpanel', { name: 'Premios' })
  expect(panel.firstElementChild).toContainElement(link)
  expect(panel.firstElementChild).toContainElement(qr)
  expect(api.put).not.toHaveBeenCalled()
})

it('preserves canvas drafts across tabs and includes them in the discard guard', async () => {
  const close = mount()
  await screen.findByText('Lienzo sin cambios pendientes')
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Home' })).toBeEnabled())
  fireEvent.click(screen.getByRole('tab', { name: 'Home' }))
  await screen.findByRole('combobox', { name: 'Añadir componente' })
  fireEvent.click(screen.getByRole('button', { name: 'Mover Logo / nombre' }))
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar componente' }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Añadir componente' }), { target: { value: 'text' } })
  fireEvent.change(screen.getByLabelText('Texto', { selector: 'textarea' }), { target: { value: 'Canvas draft' } })
  fireEvent.click(screen.getByRole('tab', { name: 'Formulario de registro' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Home' }))
  expect(screen.getByLabelText('Texto', { selector: 'textarea' })).toHaveValue('Canvas draft')
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  expect(screen.getByRole('alertdialog', { name: 'Descartar cambios' })).toBeInTheDocument()
  expect(close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Descartar y cerrar' }))
  expect(close).toHaveBeenCalledOnce()
  expect(api.put).not.toHaveBeenCalled()
})

it('loads the selected instance and shows a raffle-only tab', async () => {

  localStorage.setItem('gameId', 'OTHER')
  mount()
  await ready()
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=SELECTED&configuration=true')
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Selected event')
  expect(screen.queryByLabelText(/teléfono/)).not.toBeInTheDocument()
  expect(screen.getByRole('tablist', { name: 'Secciones de configuración' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Sorteo' }))
  expect(screen.queryByRole('link', { name: 'Abrir catálogo de premios' })).not.toBeInTheDocument()
  expect(screen.queryByText(/El catálogo de premios se configura/)).not.toBeInTheDocument()
  expect(screen.getByRole('tabpanel', { name: 'Sorteo' })).toBeInTheDocument()
  expect(screen.queryByRole('article', { name: /Pizza/ })).not.toBeInTheDocument()
  expect(localStorage.getItem('gameId')).toBe('OTHER')
})

it('always shows raffle conditions, manual launch and the periodic timer', async () => {
  mount()
  await ready()
  fireEvent.click(screen.getByRole('tab', { name: 'Sorteo' }))
  expect(screen.getByRole('region', { name: 'Condiciones para participar' })).toBeInTheDocument()
  expect(screen.getByLabelText('Aplicable a')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ejecutar sorteo' })).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Activar sorteo automático' })).toBeInTheDocument()
  expect(await screen.findByLabelText('Número de ganadores')).toBeInTheDocument()
  expect(screen.getByLabelText('Intervalo en minutos')).toBeInTheDocument()
})

it('saves only mechanics, verifies persistence and leaves conditions and registration untouched', async () => {
  mount()
  await ready()
  fireEvent.change(screen.getByLabelText('Velocidad inicial'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
  expect(await screen.findByText('Configuración guardada.')).toBeInTheDocument()
  expect(api.put).toHaveBeenCalledTimes(1)
  expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'SELECTED', settings: { stack: {
    initialSpeed: 3, speedIncrement: DEFAULT_STACK_CONFIG.speedIncrement, maxSpeed: DEFAULT_STACK_CONFIG.maxSpeed,
    perfectTolerance: DEFAULT_STACK_CONFIG.perfectTolerance, skin: 'blocks',
  } } })
})

it('saves rules only with the server revision and refreshes the revision for subsequent edits', async () => {
  mount()
  await ready()
  fireEvent.click(screen.getByRole('tab', { name: 'Premios' }))
  fireEvent.change(screen.getByLabelText('Cantidad de Pizza · 1.1'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await screen.findByText(/Condiciones guardadas/)
  expect(api.put).toHaveBeenCalledWith('/v1/game/stack/prizes', {
    gameId: 'SELECTED', action: 'rules', expectedRevision: 'original-revision',
    rules: [expect.objectContaining({ id: expect.any(String), groups: [{ allocations: [{ prizeId: 'pizza', quantity: 2 }] }] })],
  })
  fireEvent.change(screen.getByLabelText('Cantidad de Pizza · 1.1'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.put).mock.calls[1][1]).toMatchObject({ expectedRevision: 'new-revision' })
})

it('syncs an edited sub-stock through the event catalog without rewriting unchanged rules', async () => {
  vi.mocked(api.put).mockImplementation(async (_, body) => {
    const request = body as { action: string; program: StackPrizeSettingsResponse['program'] }
    prizes = { ...prizes, program: { ...request.program, rules: prizes.program.rules }, programRevision: 'stock-revision' }
    return { ok: true, program: prizes.program }
  })
  mount()
  await ready()
  fireEvent.click(screen.getByRole('tab', { name: 'Premios' }))
  expect(screen.getByLabelText('Substock Pizza')).toHaveValue('100')
  fireEvent.change(screen.getByLabelText('Substock Pizza'), { target: { value: 'x' } })
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Substock Pizza'), { target: { value: '40' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await screen.findByText(/Condiciones guardadas/)
  expect(api.put).toHaveBeenCalledTimes(1)
  expect(vi.mocked(api.put).mock.calls[0][1]).toMatchObject({
    action: 'catalog', program: { catalog: [expect.objectContaining({ id: 'pizza', stockTotal: 40 })] },
  })
  expect(screen.getByLabelText('Substock Pizza')).toHaveValue('40')
})

it.each(['inactive', 'closing'] as const)('makes %s events entirely read only', async state => {
  snapshot.game.isActive = false
  snapshot.game.lifecycleState = state
  mount()
  await ready()
  expect(screen.getByLabelText('Velocidad inicial')).toBeDisabled()
  fireEvent.click(screen.getByRole('tab', { name: 'Premios' }))
  expect(screen.getByLabelText('Cantidad de Pizza · 1.1')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Añadir regla' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Guardar configuración' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar condiciones' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Sorteo' }))
  expect(screen.queryByRole('button', { name: 'Ejecutar sorteo' })).not.toBeInTheDocument()
  expect(api.put).not.toHaveBeenCalled()
})

it('warns before discarding drafts and prevents closing during writes', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(api.put).mockImplementation(() => new Promise(done => { resolve = done }))
  const onClose = mount()
  await ready()
  fireEvent.click(screen.getByRole('tab', { name: 'Premios' }))
  fireEvent.change(screen.getByLabelText('Cantidad de Pizza · 1.1'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Cerrar configuración' })).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => resolve({ ok: true, program: prizes.program, programRevision: 'new' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('does not announce success when persistence or responses cannot be confirmed', async () => {
  vi.mocked(api.put).mockResolvedValue({ ok: false })
  mount()
  await ready()
  fireEvent.change(screen.getByLabelText('Velocidad inicial'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar')
  expect(screen.queryByText('Configuración guardada.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
})

it('shows load failures, rejects mismatched identity and allows retry', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ ...snapshot, game: { ...snapshot.game, gameId: 'OTHER' } })
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar')
  expect(screen.queryByLabelText('Velocidad inicial')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  await ready()
})

it('rejects a stale conditions response and requires reload before retry', async () => {
  vi.mocked(api.put).mockRejectedValue(new Error('RewardConditionsChanged'))
  mount()
  await ready()
  fireEvent.click(screen.getByRole('tab', { name: 'Premios' }))
  fireEvent.change(screen.getByLabelText('Cantidad de Pizza · 1.1'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Recarga las condiciones')
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
  expect(screen.queryByText(/Condiciones guardadas/)).not.toBeInTheDocument()
})

it('assigns catalog prizes and ranking conditions together for a new T1MER event', async () => {
  snapshot.game.gameType = 'T1MER'
  snapshot.game.type = {}
  snapshot.configuration = {}
  snapshot.prizeCatalog = {}
  vi.mocked(api.get).mockImplementation(async url => structuredClone(
    url === '/v1/prizes/catalog' ? { ok: true, catalog: [{ id: 'medal', name: 'Medal', imageKey: null }], revision: 1 }
      : url === '/v1/prizes/inventory' ? { ok: true, mode: 'reservations', catalog: [], imports: {}, unresolved: 0 } : snapshot,
  ))
  vi.mocked(api.put).mockImplementation(async (_, body) => {
    snapshot.prizeCatalog = (body as { prizeCatalog: OperatorGameConfiguration['prizeCatalog'] }).prizeCatalog
    return { ok: true }
  })
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Premios' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Añadir regla' }))
  const top = screen.getByLabelText('Puestos premiados (top)')
  expect(screen.queryByRole('button', { name: 'Guardar configuración' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Premio de la regla 1'), { target: { value: 'medal' } })
  fireEvent.change(top, { target: { value: '7' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
  await screen.findByText('Guardado.')
  expect(api.put).toHaveBeenCalledWith('/v1/game', expect.objectContaining({
    gameId: 'SELECTED', preserveRewardConditions: false,
    prizeCatalog: expect.objectContaining({ ranking: expect.objectContaining({ sharedPrizeId: 'medal', topX: 7 }) }),
  }))
})

it('offers only native-compatible conditions and cannot add rules without catalog prizes', async () => {
  snapshot.game.gameType = 'SEMAFORO'
  snapshot.configuration = {}
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Premios' }))
  expect(await screen.findByText('Añade premios en Administración > Premios antes de asignarlos a esta partida.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar condiciones' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Añadir regla' })).toBeDisabled()
  expect(screen.queryByText('consiga una puntuación')).not.toBeInTheDocument()
})

it('retains L3TRAS drafts across parent renders and allows correcting validation errors', async () => {
  snapshot.game.gameType = 'L3TRAS'
  snapshot.game.type = {}
  snapshot.configuration = { objectiveWord: 'ORIGINAL', validationTimeLimitSeconds: 60 }
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Game' }))
  const word = await screen.findByPlaceholderText('STAND')
  fireEvent.change(word, { target: { value: 'NEW' } })
  expect(word).toHaveValue('NEW')
  fireEvent.change(word, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('La palabra objetivo no puede estar vacía')
  expect(word).toBeEnabled()
  fireEvent.change(word, { target: { value: 'CORRECTED' } })
  expect(word).toHaveValue('CORRECTED')
  expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled()
  expect(api.put).not.toHaveBeenCalled()
})

it('traps keyboard focus, restores the trigger and blocks background interaction', async () => {
  const trigger = document.createElement('button')
  document.body.appendChild(trigger)
  trigger.focus()
  const onClose = mount()
  await ready()
  const close = screen.getByRole('button', { name: 'Cerrar configuración' })
  fireEvent.click(screen.getByRole('tab', { name: 'Sorteo' }))
  const last = screen.getByRole('switch', { name: 'Activar sorteo automático' })
  expect(trigger).toHaveAttribute('inert')
  close.focus()
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(last).toHaveFocus()
  fireEvent.keyDown(last, { key: 'Tab' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(close, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
  cleanup()
  expect(trigger).toHaveFocus()
  expect(trigger).not.toHaveAttribute('inert')
  trigger.remove()
})

it.each([true, false])('guards INFOCARDS generation and custom interactions with active=%s', async active => {
  snapshot.game.gameType = 'INFOCARDS'
  snapshot.game.type = {}
  snapshot.game.isActive = active
  snapshot.game.lifecycleState = active ? 'active' : 'inactive'
  snapshot.configuration = {}
  vi.mocked(api.get).mockImplementation(async url => structuredClone(
    url.startsWith('/v1/game/infocards') ? { ok: true, gameId: 'SELECTED', cards: [] } : snapshot,
  ))
  let finish!: (value: unknown) => void
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const onClose = mount()
  const text = await screen.findByPlaceholderText('Describe tu producto, servicio o marca aquí...')
  await screen.findByText(/Aún no hay tarjetas/)
  const generate = screen.getByRole('button', { name: 'Generar tarjetas' })
  if (!active) {
    expect(text).toBeDisabled()
    expect(generate).toBeDisabled()
    const pdf = screen.getByRole('button', { name: /PDF/ })
    expect(pdf).toHaveAttribute('aria-disabled', 'true')
    fireEvent.drop(pdf, { dataTransfer: { files: [new File(['pdf'], 'a.pdf', { type: 'application/pdf' })] } })
    expect(api.post).not.toHaveBeenCalled()
    return
  }
  fireEvent.change(text, { target: { value: 'Product description' } })
  fireEvent.click(generate)
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Cerrar configuración' })).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => finish({ ok: true, gameId: 'SELECTED', cards: [], quizGenerated: false }))
  expect(screen.getByRole('button', { name: 'Cerrar configuración' })).toBeEnabled()
  expect(onClose).not.toHaveBeenCalled()
})

it('blocks closing throughout the persistence confirmation', async () => {
  const onClose = mount()
  fireEvent.change(await screen.findByLabelText('Velocidad inicial'), { target: { value: '3' } })
  let confirm!: (value: unknown) => void
  vi.mocked(api.get).mockImplementation(async () => structuredClone(snapshot))
    .mockImplementationOnce(async () => structuredClone(snapshot))
    .mockImplementationOnce(() => new Promise(resolve => { confirm = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledOnce())
  expect(screen.getByRole('button', { name: 'Cerrar configuración' })).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => confirm(structuredClone(snapshot)))
  await screen.findByText('Configuración guardada.')
  expect(screen.getByRole('button', { name: 'Cerrar configuración' })).toBeEnabled()
})

it('keeps the normal tabs without editable mechanics or a raffle plan', async () => {
  snapshot.game.gameType = 'T1MER'
  userPlan.plan = 'free'
  mount()
  await screen.findByText('Este juego no tiene ajustes de mecánica editables.')
  fireEvent.click(screen.getByRole('tab', { name: 'Premios' }))
  await screen.findByText('Añade premios en Administración > Premios antes de asignarlos a esta partida.')
  fireEvent.click(screen.getByRole('tab', { name: 'Sorteo' }))
  expect(screen.getByText('Disponible en el plan Event 24h.')).toBeInTheDocument()
  expect(api.put).not.toHaveBeenCalled()
  expect(api.post).not.toHaveBeenCalled()
})

it.each(['visibility', 'launch'])('blocks closing during raffle %s', async action => {
  snapshot.game.gameType = 'T1MER'
  const onClose = mount()
  await screen.findByText('Este juego no tiene ajustes de mecánica editables.')
  fireEvent.click(screen.getByRole('tab', { name: 'Sorteo' }))
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Mostrar sorteo en el home' })).toBeEnabled())
  let finish!: (value: unknown) => void
  if (action === 'visibility') {
    vi.mocked(api.put).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    fireEvent.click(screen.getByRole('switch', { name: 'Mostrar sorteo en el home' }))
  } else {
    vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'Ejecutar sorteo' }))
  }
  expect(screen.getByRole('button', { name: 'Cerrar configuración' })).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => finish({ ok: true, winners: [] }))
  expect(screen.getByRole('button', { name: 'Cerrar configuración' })).toBeEnabled()
})
