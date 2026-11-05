import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { api } from '../../api/api'
import { DEFAULT_STACK_CONFIG } from '../../games/stack/stackLogic'
import type { StackPrizeSettingsResponse } from '../../api/stackPrizes'
import type { OperatorGameConfiguration } from '../../api/operatorGames'
import GameConfigurationDialog from './GameConfigurationDialog'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { getAccountConnection: async () => ({ connected: false, locationId: null, locations: [] }) } }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ plan: 'event', loading: false }) }))
vi.mock('../../games/stack/BlockPreview', () => ({ default: () => <div /> }))
let snapshot: OperatorGameConfiguration
let prizes: StackPrizeSettingsResponse
beforeEach(() => {
  vi.clearAllMocks()
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
  vi.mocked(api.get).mockImplementation(async url => structuredClone(url.startsWith('/v1/game/stack/prizes') ? prizes : snapshot))
  vi.mocked(api.put).mockImplementation(async (_, body) => {
    const request = body as { settings?: { stack: Record<string, unknown> }; rules?: StackPrizeSettingsResponse['program']['rules'] }
    if (request.settings) {
      snapshot.configuration = { ...snapshot.configuration, ...request.settings.stack }
      return { ok: true, game: snapshot.game }
    }
    return { ok: true, program: { ...prizes.program, rules: request.rules }, programRevision: 'new-revision' }
  })
})
afterEach(() => { cleanup(); localStorage.clear() })
function mount() {
  const onClose = vi.fn()
  render(<MemoryRouter><GameConfigurationDialog gameId="SELECTED" onClose={onClose} /></MemoryRouter>)
  return onClose
}
async function ready() {
  fireEvent.click(await screen.findByRole('tab', { name: 'Condiciones' }))
  await screen.findByLabelText('Cantidad de Pizza · 1.1')
  fireEvent.click(screen.getByRole('tab', { name: 'Configuración' }))
}

it('loads the selected instance and links its catalog to the dedicated admin panel', async () => {
  localStorage.setItem('gameId', 'OTHER')
  mount()
  await ready()
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=SELECTED&configuration=true')
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Selected event')
  expect(screen.queryByLabelText(/teléfono/)).not.toBeInTheDocument()
  expect(screen.getByRole('tablist', { name: 'Secciones de configuración' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Premios y sorteo' }))
  expect(screen.getByRole('link', { name: 'Abrir catálogo de premios' })).toHaveAttribute(
    'href', '/admin/prizes',
  )
  expect(screen.getByRole('tabpanel', { name: 'Premios y sorteo' })).toBeInTheDocument()
  expect(screen.queryAllByRole('heading', { name: 'Premios y sorteo' })).toHaveLength(0)
  expect(screen.queryByRole('article', { name: /Pizza/ })).not.toBeInTheDocument()
  expect(localStorage.getItem('gameId')).toBe('OTHER')
})

it('opens raffle operations from the selected event administration panel', async () => {
  mount()
  await ready()
  fireEvent.click(screen.getByRole('tab', { name: 'Premios y sorteo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Abrir controles del sorteo' }))
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
  fireEvent.click(screen.getByRole('tab', { name: 'Condiciones' }))
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

it.each(['inactive', 'closing'] as const)('makes %s events entirely read only', async state => {
  snapshot.game.isActive = false
  snapshot.game.lifecycleState = state
  mount()
  await ready()
  expect(screen.getByLabelText('Velocidad inicial')).toBeDisabled()
  fireEvent.click(screen.getByRole('tab', { name: 'Condiciones' }))
  expect(screen.getByLabelText('Cantidad de Pizza · 1.1')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Añadir regla' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Guardar configuración' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar condiciones' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Premios y sorteo' }))
  expect(screen.queryByRole('button', { name: 'Abrir controles del sorteo' })).not.toBeInTheDocument()
  expect(api.put).not.toHaveBeenCalled()
})

it('warns before discarding drafts and prevents closing during writes', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(api.put).mockImplementation(() => new Promise(done => { resolve = done }))
  const onClose = mount()
  await ready()
  fireEvent.click(screen.getByRole('tab', { name: 'Condiciones' }))
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
  fireEvent.click(screen.getByRole('tab', { name: 'Condiciones' }))
  fireEvent.change(screen.getByLabelText('Cantidad de Pizza · 1.1'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Recarga las condiciones')
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
  expect(screen.queryByText(/Condiciones guardadas/)).not.toBeInTheDocument()
})

it('edits only existing T1MER ranking conditions and retains the returned revision', async () => {
  snapshot.game.gameType = 'T1MER'
  snapshot.game.type = {}
  snapshot.configuration = {}
  snapshot.prizeCatalog = { ranking: { name: 'Medal', topX: 3, limit: 10 } }
  vi.mocked(api.put).mockResolvedValue({
    ok: true, gameId: 'SELECTED', message: 'Reward conditions updated successfully', rewardConditionsRevision: 'next',
  })
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Condiciones' }))
  const top = await screen.findByLabelText('Puestos premiados (top)')
  expect(screen.queryByRole('button', { name: 'Guardar configuración' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  fireEvent.change(top, { target: { value: '101' } })
  expect(screen.getByRole('button', { name: 'Guardar condiciones' })).toBeDisabled()
  fireEvent.change(top, { target: { value: '7' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await screen.findByText('Condiciones guardadas.')
  expect(api.put).toHaveBeenCalledWith('/v1/game', {
    gameId: 'SELECTED', rewardConditions: { rankingTopX: 7, expectedRevision: 'native-revision' },
  })
  fireEvent.change(top, { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar condiciones' }))
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.put).mock.calls[1][1]).toMatchObject({ rewardConditions: { rankingTopX: 5, expectedRevision: 'next' } })
})

it('shows unsupported conditions honestly rather than inventing game rules', async () => {
  snapshot.game.gameType = 'SEMAFORO'
  snapshot.configuration = {}
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Condiciones' }))
  expect(await screen.findByText('Esta partida no tiene recompensas configuradas.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Guardar condiciones' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Añadir regla' })).not.toBeInTheDocument()
})

it('retains L3TRAS drafts across parent renders and allows correcting validation errors', async () => {
  snapshot.game.gameType = 'L3TRAS'
  snapshot.game.type = {}
  snapshot.configuration = { objectiveWord: 'ORIGINAL', validationTimeLimitSeconds: 60 }
  mount()
  fireEvent.click(await screen.findByRole('tab', { name: 'Configuración' }))
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
  fireEvent.click(screen.getByRole('tab', { name: 'Premios y sorteo' }))
  const last = screen.getByRole('button', { name: 'Abrir controles del sorteo' })
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
