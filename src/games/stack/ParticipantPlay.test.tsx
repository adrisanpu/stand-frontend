import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicApiError, publicApi, type StackAssignment, type StackFinishResponse } from '../../api/publicApi'
import { ParticipantLanguageProvider, ParticipantLanguageSelector } from '../../core/participant/participantLanguage'
import { loadAssignment } from '../../core/participant/playerSession'
import type { StackSnapshot } from './stackLogic'
import { DEFAULT_STACK_CONFIG } from './stackLogic'
import type { StackSceneController } from './stackScene'
import StackParticipantPlay from './ParticipantPlay'
import { loadPendingStackResult, savePendingStackResult } from './stackResultStorage'

const { createScene, controller } = vi.hoisted(() => ({
  createScene: vi.fn(),
  controller: { start: vi.fn(), place: vi.fn(), setPaused: vi.fn(), dispose: vi.fn() },
}))
vi.mock('./stackScene', () => ({ createStackScene: createScene }))
vi.mock('../../api/publicApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/publicApi')>(),
  publicApi: { startStackAttempt: vi.fn(), finishStackAttempt: vi.fn(), score: vi.fn() },
}))

const assignment: StackAssignment = {
  gameType: 'STACK', playerId: 1, displayName: '@rekete', profilePicUrl: '/profile.jpg', attempt: null,
}
type Options = Parameters<typeof import('./stackScene').createStackScene>[1]

function renderGame(player: StackAssignment = assignment, config = DEFAULT_STACK_CONFIG) {
  return render(<StackParticipantPlay gameId="GAME1234" playerToken="token" assignment={player} config={config} startSupported finishSupported />)
}
async function ready(): Promise<Options> {
  await waitFor(() => expect(createScene).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.queryByText('Cargando escena 3D...')).not.toBeInTheDocument())
  return createScene.mock.calls[0][1] as Options
}
function startResponse(attemptId: string) {
  return {
    ok: true as const, gameId: 'GAME1234', playerId: 1, attemptId,
    status: 'started' as const, configVersion: '1' as const,
    startedAt: '2026-10-16T10:00:00Z', configSnapshot: DEFAULT_STACK_CONFIG,
  }
}
function update(options: Options, patch: Partial<StackSnapshot>) {
  act(() => options.onUpdate?.({ state: 'PLAYING', score: 0, perfect: false, placements: [], ...patch }))
}
const placements: StackSnapshot['placements'] = [
  ...Array.from({ length: 7 }, (_, index) => ({ axis: index % 2 === 0 ? 'x' as const : 'z' as const, offset: 0, perfect: true })),
  { axis: 'z', offset: 4, perfect: false },
]
function finishResponse(attemptId: string): StackFinishResponse {
  return {
    ok: true, gameId: 'GAME1234', playerId: 1, attemptId, status: 'finished', configVersion: '1',
    score: 7, scoreUpdatedAt: '2026-10-16T10:01:00Z', rank: 2,
  }
}
async function startGame() {
  const view = renderGame()
  const options = await ready()
  fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
  await waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
  const attemptId = vi.mocked(publicApi.startStackAttempt).mock.calls[0][0].attemptId
  return { ...view, options, attemptId }
}

describe('STACK participant gameplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    createScene.mockReturnValue(controller satisfies StackSceneController)
    vi.mocked(publicApi.startStackAttempt).mockImplementation(async ({ attemptId }) => startResponse(attemptId))
    vi.mocked(publicApi.finishStackAttempt).mockImplementation(async ({ attemptId }) => finishResponse(attemptId))
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('loads the scene without consuming an attempt and keeps the centered identity header', async () => {
    const { unmount } = renderGame()
    await ready()
    const header = screen.getByText('@rekete').closest('header')
    expect(header).toHaveClass('justify-center')
    expect(header).toContainElement(screen.getByText('@rekete'))
    expect(header?.querySelector('img[src="/profile.jpg"]')).not.toBeNull()
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
    expect(controller.start).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'EMPEZAR' })).toBeEnabled()
    unmount()
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })

  it('does not offer an available attempt when the server reports it consumed', async () => {
    renderGame({ ...assignment, attempt: { attemptId: 'old', status: 'started', startedAt: '2026-10-16T10:00:00Z', configVersion: '1' } })
    await ready()
    expect(screen.queryByRole('button', { name: 'EMPEZAR' })).not.toBeInTheDocument()
    expect(screen.getByText(/Tu intento no está disponible/)).toBeInTheDocument()
    expect(controller.start).not.toHaveBeenCalled()
  })

  it('does not consume attempts against the old phase-one backend', async () => {
    render(<StackParticipantPlay gameId="GAME1234" playerToken="token" assignment={assignment} config={DEFAULT_STACK_CONFIG} />)
    await ready()
    expect(screen.getByRole('alert')).toHaveTextContent('actualización de Fase 3')
    const startButton = screen.getByRole('button', { name: 'EMPEZAR' })
    expect(startButton).toBeDisabled()
    fireEvent.click(startButton)
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
  })

  it('refreshes a ranking prize image in results without recreating the scene or consuming another attempt', async () => {
    const scored = { ...assignment, score: 7, rank: 2 }
    const { rerender } = render(
      <StackParticipantPlay gameId="GAME1234" playerToken="token" assignment={scored}
        config={DEFAULT_STACK_CONFIG} startSupported finishSupported
        prizeCatalog={{ ranking: { name: 'Consola', limit: null, topX: 3, imageUrl: '/first.png' } }} />
    )
    await ready()
    expect(screen.getByRole('img', { name: 'Consola' })).toHaveAttribute('src', '/first.png')
    rerender(
      <StackParticipantPlay gameId="GAME1234" playerToken="token" assignment={scored}
        config={DEFAULT_STACK_CONFIG} startSupported finishSupported
        prizeCatalog={{ ranking: { name: 'Consola', limit: null, topX: 3, imageUrl: '/fresh.png' } }} />
    )
    expect(screen.getByRole('img', { name: 'Consola' })).toHaveAttribute('src', '/fresh.png')
    expect(createScene).toHaveBeenCalledTimes(1)
    expect(controller.start).not.toHaveBeenCalled()
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
  })

  it('does not start against a phase-two backend without finish support', async () => {
    render(<StackParticipantPlay gameId="GAME1234" playerToken="token" assignment={assignment} config={DEFAULT_STACK_CONFIG} startSupported />)
    await ready()
    expect(screen.getByRole('button', { name: 'EMPEZAR' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('actualización de Fase 3')
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
  })

  it('blocks an already scored assignment even when its attempt is absent', async () => {
    renderGame({ ...assignment, score: 0 })
    await ready()
    expect(screen.queryByRole('button', { name: 'EMPEZAR' })).not.toBeInTheDocument()
    expect(screen.getByText(/Resultado validado y guardado/)).toBeInTheDocument()
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
  })

  it('only starts after the backend confirms, and uses its config snapshot', async () => {
    let resolve!: (value: ReturnType<typeof startResponse>) => void
    vi.mocked(publicApi.startStackAttempt).mockReturnValue(new Promise((done) => { resolve = done }))
    renderGame()
    const options = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    expect(screen.getByRole('button', { name: 'Confirmando intento...' })).toBeDisabled()
    expect(controller.start).not.toHaveBeenCalled()
    const id = vi.mocked(publicApi.startStackAttempt).mock.calls[0][0].attemptId
    const response = { ...startResponse(id), configSnapshot: { ...DEFAULT_STACK_CONFIG, initialSpeed: 3 } }
    await act(async () => { resolve(response) })
    expect(controller.start).toHaveBeenCalledWith(response.configSnapshot)
    expect(loadAssignment('GAME1234')).toEqual(expect.objectContaining({ attempt: expect.objectContaining({ attemptId: id }) }))
    update(options, {})
    expect(screen.getByRole('button', { name: 'COLOCAR' })).toBeEnabled()
  })

  it('switches languages during play without recreating the scene, duplicating requests, or losing the snapshot', async () => {
    render(
      <ParticipantLanguageProvider>
        <ParticipantLanguageSelector />
        <StackParticipantPlay gameId="GAME1234" playerToken="token" assignment={assignment} config={DEFAULT_STACK_CONFIG} startSupported finishSupported />
      </ParticipantLanguageProvider>,
    )
    const options = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    await waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    update(options, { state: 'PLAYING', score: 4 })

    const languageSelector = screen.getByRole('combobox')
    fireEvent.change(languageSelector, { target: { value: 'en' } })
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'PLACE' })).toBeEnabled()
    expect(screen.getByText('4', { selector: 'span' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))

    fireEvent.change(languageSelector, { target: { value: 'es' } })
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'COLOCAR' })).toBeEnabled()
    expect(screen.getByText('4', { selector: 'span' })).toBeInTheDocument()
    expect(createScene).toHaveBeenCalledTimes(1)
    expect(controller.start).toHaveBeenCalledTimes(1)
    expect(controller.dispose).not.toHaveBeenCalled()
    expect(publicApi.startStackAttempt).toHaveBeenCalledTimes(1)
    expect(publicApi.score).not.toHaveBeenCalled()
    expect(publicApi.finishStackAttempt).not.toHaveBeenCalled()
  })

  it('retries the same identifier after a network error, never creating another attempt', async () => {
    vi.mocked(publicApi.startStackAttempt).mockRejectedValueOnce(new Error('Sin conexión'))
    renderGame()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar confirmación' }))
    await waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    const calls = vi.mocked(publicApi.startStackAttempt).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1][0]).toEqual(calls[0][0])
  })

  it('blocks a rejected or conflicting attempt rather than retrying with a new identifier', async () => {
    vi.mocked(publicApi.startStackAttempt).mockRejectedValue(new PublicApiError('AttemptAlreadyStarted', 409))
    renderGame()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('AttemptAlreadyStarted')
    expect(screen.queryByRole('button', { name: /EMPEZAR|Reintentar confirmación/ })).not.toBeInTheDocument()
    expect(controller.start).not.toHaveBeenCalled()
  })

  it('does not start with mismatched authoritative response metadata', async () => {
    vi.mocked(publicApi.startStackAttempt).mockImplementation(async ({ attemptId }) => ({ ...startResponse(attemptId), playerId: 99 }))
    renderGame()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('reglas del intento')
    expect(controller.start).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'EMPEZAR' })).not.toBeInTheDocument()
  })

  it('explicitly reports consumption if the local engine cannot start after server confirmation', async () => {
    controller.start.mockImplementationOnce(() => { throw new Error('Fallo al iniciar la escena') })
    renderGame()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El backend ya ha consumido tu intento')
    expect(screen.getByRole('alert')).toHaveTextContent('Fallo al iniciar la escena')
    expect(screen.queryByRole('button', { name: /EMPEZAR|Reintentar confirmación/ })).not.toBeInTheDocument()
  })

  it('only places through the canvas primary pointer or the placement button', async () => {
    renderGame()
    const options = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    await waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    update(options, {})
    const canvas = screen.getByLabelText('Escena 3D de bloques apilados')
    const primary = new Event('pointerdown', { bubbles: true, cancelable: true })
    Object.defineProperties(primary, { isPrimary: { value: true }, pointerType: { value: 'touch' }, button: { value: 0 } })
    fireEvent(canvas, primary)
    fireEvent.click(canvas)
    expect(controller.place).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('@rekete'))
    expect(controller.place).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'COLOCAR' }))
    expect(controller.place).toHaveBeenCalledTimes(2)
    update(options, { state: 'PLACING', score: 1, perfect: true })
    expect(screen.getByText('PERFECT!')).toBeInTheDocument()
    expect(screen.getByText('Sin perder superficie')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Colocando...' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Colocando...' }))
    expect(controller.place).toHaveBeenCalledTimes(2)
  })

  it('clears Perfect feedback for the next block without changing the score or submitting a result', async () => {
    const { options } = await startGame()
    update(options, { state: 'PLACING', score: 1, perfect: true })
    expect(screen.getByText('PERFECT!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(screen.getByText('PERFECT!').parentElement).toHaveStyle({ animationPlayState: 'paused' })
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }))
    expect(screen.getByText('PERFECT!').parentElement).toHaveStyle({ animationPlayState: 'running' })
    update(options, { state: 'PLAYING', score: 1, perfect: false })
    expect(screen.queryByText('PERFECT!')).not.toBeInTheDocument()
    expect(screen.getByText('Toca para apilar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'COLOCAR' })).toBeEnabled()
    expect(publicApi.finishStackAttempt).not.toHaveBeenCalled()
  })

  it('ignores secondary fingers and non-primary mouse buttons on the play surface', async () => {
    const { options } = await startGame()
    update(options, {})
    const canvas = screen.getByLabelText('Escena 3D de bloques apilados')
    for (const input of [
      { isPrimary: false, pointerType: 'touch', button: 0 },
      { isPrimary: true, pointerType: 'mouse', button: 1 },
      { isPrimary: true, pointerType: 'mouse', button: 2 },
    ]) {
      const event = new Event('pointerdown', { bubbles: true, cancelable: true })
      Object.defineProperties(event, Object.fromEntries(Object.entries(input).map(([key, value]) => [key, { value }])))
      fireEvent(canvas, event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(controller.place).not.toHaveBeenCalled()
    expect(publicApi.finishStackAttempt).not.toHaveBeenCalled()
  })

  it('pauses without placing and disables input during context loss or an automatic pause', async () => {
    renderGame()
    const options = await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    await waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    update(options, {})
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(controller.setPaused).toHaveBeenCalledWith(true)
    expect(controller.place).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'COLOCAR' })).toBeDisabled()
    act(() => options.onPauseChange?.(true))
    expect(screen.getByRole('button', { name: 'COLOCAR' })).toBeDisabled()
    act(() => options.onContextLost())
    expect(screen.getByRole('alert')).toHaveTextContent('perdido el contexto')
    act(() => options.onContextRestored())
    act(() => options.onPauseChange?.(false))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'COLOCAR' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }))
    expect(controller.setPaused).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('button', { name: 'COLOCAR' })).toBeEnabled()
  })

  it('submits Game Over evidence and only confirms persistence after the server responds', async () => {
    let resolve!: (value: StackFinishResponse) => void
    vi.mocked(publicApi.finishStackAttempt).mockReturnValue(new Promise((done) => { resolve = done }))
    const { options, attemptId } = await startGame()
    update(options, { state: 'GAME_OVER', score: 7, placements })
    expect(screen.getByRole('heading', { name: 'Fin de la partida' })).toBeInTheDocument()
    expect(screen.getByText('7', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText(/Resultado local pendiente/)).toBeInTheDocument()
    expect(screen.getByText('Validando y guardando resultado...')).toBeInTheDocument()
    expect(publicApi.finishStackAttempt).toHaveBeenCalledWith({ gameId: 'GAME1234', playerToken: 'token', attemptId, placements })
    expect(loadPendingStackResult('GAME1234', 1, attemptId)?.placements).toEqual(placements)
    expect(publicApi.score).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /EMPEZAR|COLOCAR|reiniciar/i })).not.toBeInTheDocument()
    await act(async () => { resolve(finishResponse(attemptId)) })
    expect(screen.getByText(/Resultado validado y guardado/)).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(loadAssignment('GAME1234')).toEqual(expect.objectContaining({
      score: 7, rank: 2, attempt: expect.objectContaining({ status: 'finished' }),
    }))
    expect(loadPendingStackResult('GAME1234', 1, attemptId)).toBeNull()
  })

  it('retries exactly the same evidence after a lost finish response without starting again', async () => {
    vi.mocked(publicApi.finishStackAttempt).mockRejectedValueOnce(new Error('Sin conexión'))
    const { options } = await startGame()
    update(options, { state: 'GAME_OVER', score: 7, placements })
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByText(/Resultado local pendiente/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar guardado' }))
    expect(await screen.findByText(/Resultado validado y guardado/)).toBeInTheDocument()
    const calls = vi.mocked(publicApi.finishStackAttempt).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1][0]).toEqual(calls[0][0])
    expect(publicApi.startStackAttempt).toHaveBeenCalledTimes(1)
  })

  it('shows a definitive finish rejection without claiming saved success or a new attempt', async () => {
    vi.mocked(publicApi.finishStackAttempt).mockRejectedValue(new PublicApiError('InvalidStackReplay', 400))
    const { options } = await startGame()
    update(options, { state: 'GAME_OVER', score: 7, placements })
    expect(await screen.findByRole('alert')).toHaveTextContent('InvalidStackReplay')
    expect(screen.getByText(/Resultado local pendiente/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reintentar guardado|EMPEZAR/ })).not.toBeInTheDocument()
  })

  it('does not trust mismatched finish metadata', async () => {
    vi.mocked(publicApi.finishStackAttempt).mockImplementation(async ({ attemptId }) => ({ ...finishResponse(attemptId), playerId: 99 }))
    const { options } = await startGame()
    update(options, { state: 'GAME_OVER', score: 7, placements })
    expect(await screen.findByRole('alert')).toHaveTextContent('no confirmó un resultado válido')
    expect(screen.queryByText(/Resultado validado y guardado/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar guardado' })).toBeEnabled()
  })

  it('recovers pending final evidence after reload without resuming gameplay', async () => {
    const consumed: StackAssignment = {
      ...assignment, attempt: { attemptId: 'old', status: 'started', startedAt: '2026-10-16T10:00:00Z', configVersion: '1' },
    }
    savePendingStackResult('GAME1234', { playerId: 1, attemptId: 'old', placements })
    renderGame(consumed)
    expect(await screen.findByText(/Resultado validado y guardado/)).toBeInTheDocument()
    expect(publicApi.finishStackAttempt).toHaveBeenCalledWith({ gameId: 'GAME1234', playerToken: 'token', attemptId: 'old', placements })
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
    expect(controller.start).not.toHaveBeenCalled()
  })

  it('does not duplicate a pending result submission during StrictMode setup', async () => {
    const consumed: StackAssignment = {
      ...assignment, attempt: { attemptId: 'old', status: 'started', startedAt: '2026-10-16T10:00:00Z', configVersion: '1' },
    }
    savePendingStackResult('GAME1234', { playerId: 1, attemptId: 'old', placements })
    render(
      <StrictMode>
        <StackParticipantPlay gameId="GAME1234" playerToken="token" assignment={consumed} config={DEFAULT_STACK_CONFIG} startSupported finishSupported />
      </StrictMode>,
    )
    expect(await screen.findByText(/Resultado validado y guardado/)).toBeInTheDocument()
    expect(publicApi.finishStackAttempt).toHaveBeenCalledTimes(1)
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
  })

  it.each([408, 429, 500, 503])('allows idempotent retry of a transient HTTP %s finish error', async (status) => {
    vi.mocked(publicApi.finishStackAttempt).mockRejectedValueOnce(new PublicApiError('Servidor temporalmente no disponible', status))
    const { options } = await startGame()
    update(options, { state: 'GAME_OVER', score: 7, placements })
    expect(await screen.findByRole('button', { name: 'Reintentar guardado' })).toBeEnabled()
    expect(screen.queryByText(/Resultado validado y guardado/)).not.toBeInTheDocument()
  })

  it('does not submit stale pending evidence belonging to a different attempt', async () => {
    savePendingStackResult('GAME1234', { playerId: 1, attemptId: 'other', placements })
    renderGame({
      ...assignment, attempt: { attemptId: 'old', status: 'started', startedAt: '2026-10-16T10:00:00Z', configVersion: '1' },
    })
    await ready()
    expect(screen.getByText(/Tu intento no está disponible/)).toBeInTheDocument()
    expect(publicApi.finishStackAttempt).not.toHaveBeenCalled()
  })

  it('displays a malformed pending-record error without offering another attempt', async () => {
    sessionStorage.setItem('stand_stack_pending_result_GAME1234', '{"playerId":1,"attemptId":"old","placements":[]}')
    renderGame({
      ...assignment, attempt: { attemptId: 'old', status: 'started', startedAt: '2026-10-16T10:00:00Z', configVersion: '1' },
    })
    await ready()
    expect(screen.getByRole('alert')).toHaveTextContent('no contiene colocaciones')
    expect(screen.queryByRole('button', { name: 'EMPEZAR' })).not.toBeInTheDocument()
    expect(publicApi.finishStackAttempt).not.toHaveBeenCalled()
  })

  it('shows a server-recovered final result without submitting or replaying again', async () => {
    renderGame({
      ...assignment, score: 7, rank: 3,
      attempt: { attemptId: 'old', status: 'finished', startedAt: '2026-10-16T10:00:00Z', configVersion: '1' },
    })
    await ready()
    expect(screen.getByText(/Resultado validado y guardado/)).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(publicApi.finishStackAttempt).not.toHaveBeenCalled()
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
  })

  it('keeps pending evidence when unmounted before finish confirmation', async () => {
    let resolve!: (value: StackFinishResponse) => void
    vi.mocked(publicApi.finishStackAttempt).mockReturnValue(new Promise((done) => { resolve = done }))
    const { options, attemptId, unmount } = await startGame()
    update(options, { state: 'GAME_OVER', score: 7, placements })
    await waitFor(() => expect(publicApi.finishStackAttempt).toHaveBeenCalledTimes(1))
    unmount()
    await act(async () => { resolve(finishResponse(attemptId)) })
    expect(loadPendingStackResult('GAME1234', 1, attemptId)?.placements).toEqual(placements)
    expect(loadAssignment('GAME1234')).toEqual(expect.objectContaining({ attempt: expect.objectContaining({ status: 'started' }) }))
  })

  it('reports storage failure but still sends the in-memory result to the server', async () => {
    const { options } = await startGame()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    update(options, { state: 'GAME_OVER', score: 7, placements })
    expect(await screen.findByText(/Resultado validado y guardado/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('no se pudo actualizar la copia')
    expect(publicApi.finishStackAttempt).toHaveBeenCalledTimes(1)
  })

  it('does not discard a server-confirmed start if local session storage becomes unavailable', async () => {
    renderGame()
    await ready()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    await waitFor(() => expect(controller.start).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('alert')).toHaveTextContent('intento ya está confirmado en el servidor')
    expect(screen.queryByRole('button', { name: /EMPEZAR|Reintentar confirmación/ })).not.toBeInTheDocument()
  })

  it('does not consume the attempt if scene initialization fails', async () => {
    createScene.mockImplementationOnce(() => { throw new Error('WebGL no disponible') })
    renderGame()
    expect(await screen.findByRole('alert')).toHaveTextContent('WebGL no disponible')
    expect(screen.getByRole('button', { name: 'EMPEZAR' })).toBeDisabled()
    expect(publicApi.startStackAttempt).not.toHaveBeenCalled()
  })

  it('does not start a disposed scene after a late network confirmation', async () => {
    let resolve!: (value: ReturnType<typeof startResponse>) => void
    vi.mocked(publicApi.startStackAttempt).mockReturnValue(new Promise((done) => { resolve = done }))
    const { unmount } = renderGame()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'EMPEZAR' }))
    const id = vi.mocked(publicApi.startStackAttempt).mock.calls[0][0].attemptId
    unmount()
    await act(async () => { resolve(startResponse(id)) })
    expect(controller.start).not.toHaveBeenCalled()
    expect(controller.dispose).toHaveBeenCalledTimes(1)
  })
})
