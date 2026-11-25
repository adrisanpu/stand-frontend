import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publicApi, PublicApiError, type BasketAssignment } from '../../api/publicApi'
import BasketParticipantPlay from './ParticipantPlay'
import { DEFAULT_BASKET_CONFIG } from './basketLogic'
import { basketAttemptStorageKey } from './basketAttemptStorage'

const scene = vi.hoisted(() => ({ setActiveShot: vi.fn(), dispose: vi.fn(),
  options: {} as { onContextLost?: () => void; onContextRestored?: () => void } }))
vi.mock('./basketScene', () => ({
  BasketSceneController: class {
    constructor(_canvas: HTMLCanvasElement, options: typeof scene.options) { scene.options = options }
    setElapsedMs() {}
    setActiveShot(...args: unknown[]) { scene.setActiveShot(...args) }
    clearShot() {}
    dispose() { scene.dispose() }
  },
}))

const startedAt = '2026-11-25T10:00:00.000Z'
const expiresAt = '2026-11-25T10:00:30.000Z'
const key = basketAttemptStorageKey('GAME', 42)
const emptyAssignment: BasketAssignment = { gameType: 'BASKET', playerId: 42, attempt: null }
const mount = (assignment = emptyAssignment) => render(<BasketParticipantPlay gameId="GAME" playerToken="secret"
  config={DEFAULT_BASKET_CONFIG} assignment={assignment} startSupported finishSupported />)
const flush = () => act(async () => {})

describe('official BASKET participant lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    localStorage.clear()
    scene.setActiveShot.mockClear()
    vi.spyOn(publicApi, 'startBasketAttempt').mockImplementation(async body => ({
      ok: true, gameId: 'GAME', playerId: 42, attemptId: body.attemptId, status: 'started',
      configVersion: '1', startedAt, serverNow: startedAt, expiresAt, configSnapshot: DEFAULT_BASKET_CONFIG,
    }))
    vi.spyOn(publicApi, 'finishBasketAttempt').mockImplementation(async body => ({
      ok: true, gameId: 'GAME', playerId: 42, attemptId: body.attemptId, status: 'finished',
      configVersion: '1', score: 0, rank: 1, scoreUpdatedAt: expiresAt, finishedAt: expiresAt,
    }))
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('persists start evidence and does not finish before thirty seconds', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }))
    await flush()
    expect(publicApi.startBasketAttempt).toHaveBeenCalledOnce()
    expect(localStorage.getItem(key)).toContain('"phase":"started"')
    expect(localStorage.getItem(key)).not.toContain('secret')
    act(() => vi.advanceTimersByTime(29_900))
    expect(publicApi.finishBasketAttempt).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(100))
    await flush()
    expect(publicApi.finishBasketAttempt).toHaveBeenCalledWith(expect.objectContaining({ shots: [] }))
    expect(screen.getByText('Resultado confirmado')).toBeInTheDocument()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('recovers in-flight evidence and waits for its technical end', async () => {
    const shots = [{ atMs: 29_000, vx: 1600, vy: 7800, vz: -7700 }]
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1, gameId: 'GAME', playerId: 42, attemptId: 'existing', phase: 'started',
      configVersion: '1', startedAt, serverNow: startedAt, expiresAt, shots,
    }))
    mount({ ...emptyAssignment, attempt: {
      attemptId: 'existing', status: 'started', startedAt, configVersion: '1',
      configSnapshot: DEFAULT_BASKET_CONFIG, expiresAt, serverNow: '2026-11-25T10:00:29.500Z',
    } })
    expect(scene.setActiveShot).toHaveBeenCalledWith(shots[0], 500)
    expect(publicApi.startBasketAttempt).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1_400))
    expect(publicApi.finishBasketAttempt).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(100))
    await flush()
    expect(publicApi.finishBasketAttempt).toHaveBeenCalledWith({
      gameId: 'GAME', playerToken: 'secret', attemptId: 'existing', shots,
    })
  })

  it('never grants a replacement attempt when local evidence is absent', () => {
    mount({ ...emptyAssignment, attempt: {
      attemptId: 'existing', status: 'started', startedAt, configVersion: '1',
      configSnapshot: DEFAULT_BASKET_CONFIG, expiresAt, serverNow: startedAt,
    } })
    expect(screen.getByText(/No encontramos la evidencia local/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Empezar partida' })).not.toBeInTheDocument()
    expect(publicApi.startBasketAttempt).not.toHaveBeenCalled()
  })

  it('does not request an official attempt when synchronous persistence fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }))
    expect(screen.getByText(/No se pudo guardar este intento/)).toBeInTheDocument()
    expect(publicApi.startBasketAttempt).not.toHaveBeenCalled()
  })

  it.each([29_999, 30_000])('uses fresh release time at %i milliseconds, not the last interval', async releaseAt => {
    let now = 0
    vi.mocked(performance.now).mockImplementation(() => now)
    vi.stubGlobal('PointerEvent', MouseEvent)
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }))
    await flush()
    const area = view.container.querySelector('.basket-shot-area')!
    vi.spyOn(area, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 150 } as DOMRect)
    now = 29_800
    fireEvent.pointerDown(area, { clientX: 150, clientY: 130 })
    now = releaseAt
    fireEvent.pointerUp(area, { clientX: 150, clientY: 30 })
    const shots = JSON.parse(localStorage.getItem(key)!).shots
    expect(shots).toHaveLength(releaseAt < 30_000 ? 1 : 0)
    if (shots.length) expect(shots[0].atMs).toBe(29_999)
    vi.unstubAllGlobals()
  })

  it('does not display a predicted basket until the crossing time', () => {
    localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1, gameId: 'GAME', playerId: 42, attemptId: 'existing', phase: 'started',
      configVersion: '1', shots: [{ atMs: 0, vx: 1600, vy: 7800, vz: -7700 }],
    }))
    mount({ ...emptyAssignment, attempt: {
      attemptId: 'existing', status: 'started', startedAt, configVersion: '1',
      configSnapshot: DEFAULT_BASKET_CONFIG, expiresAt, serverNow: '2026-11-25T10:00:00.500Z',
    } })
    expect(screen.getByLabelText('Puntuación: 0')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByLabelText('Puntuación: 0')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(100))
    expect(screen.getByLabelText('Puntuación: 1')).toBeInTheDocument()
  })

  it('keeps evidence and stops retrying when the server reports AttemptExpired', async () => {
    vi.mocked(publicApi.finishBasketAttempt).mockRejectedValue(new PublicApiError('Expired', 409, 'AttemptExpired'))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }))
    await flush()
    act(() => vi.advanceTimersByTime(30_000))
    await flush()
    expect(screen.getByText(/El plazo de envío terminó/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar envío' })).not.toBeInTheDocument()
    expect(localStorage.getItem(key)).not.toBeNull()
  })

  it('shows context loss and restoration without stopping the attempt clock', async () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }))
    await flush()
    act(() => scene.options.onContextLost?.())
    expect(screen.getByText(/Se perdió la cancha 3D/)).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByRole('timer')).toHaveTextContent('00:29')
    act(() => scene.options.onContextRestored?.())
    expect(screen.queryByText(/Se perdió la cancha 3D/)).not.toBeInTheDocument()
  })

  it.each(['invalid', '2026-11-25T10:00:31.000Z'])('blocks invalid recovery expiration %s', expiration => {
    mount({ ...emptyAssignment, attempt: {
      attemptId: 'existing', status: 'started', startedAt, configVersion: '1',
      configSnapshot: DEFAULT_BASKET_CONFIG, expiresAt: expiration, serverNow: startedAt,
    } })
    expect(screen.getByText(/Las reglas guardadas no son compatibles/)).toBeInTheDocument()
    expect(publicApi.startBasketAttempt).not.toHaveBeenCalled()
  })

  it('shows a confirmed server result even when local storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('unavailable') })
    mount({ ...emptyAssignment, score: 2, rank: 1, attempt: {
      attemptId: 'existing', status: 'finished', startedAt, configVersion: '1',
      configSnapshot: DEFAULT_BASKET_CONFIG, expiresAt, serverNow: expiresAt,
    } })
    expect(screen.getByText('Resultado confirmado')).toBeInTheDocument()
    expect(screen.getByText(/no se pudo limpiar el registro local/)).toBeInTheDocument()
  })

  it.each([
    { playerId: 99 },
    { expiresAt: '2026-11-25T10:00:31.000Z' },
    { serverNow: '2026-11-25T09:59:59.000Z' },
  ])('rejects a mismatched start response %j', async override => {
    vi.mocked(publicApi.startBasketAttempt).mockImplementation(async body => ({
      ok: true, gameId: 'GAME', playerId: 42, attemptId: body.attemptId, status: 'started',
      configVersion: '1', startedAt, serverNow: startedAt, expiresAt, configSnapshot: DEFAULT_BASKET_CONFIG,
      ...override,
    }))
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }))
    await flush()
    expect(screen.getByText(/La respuesta de inicio no coincide/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(key)!).phase).toBe('pending')
  })

  it.each([{ score: NaN }, { rank: 0 }, { playerId: 99 }, { finishedAt: 'invalid' }])(
    'retains evidence for a malformed finish response %j', async override => {
      vi.mocked(publicApi.finishBasketAttempt).mockImplementation(async body => ({
        ok: true, gameId: 'GAME', playerId: 42, attemptId: body.attemptId, status: 'finished',
        configVersion: '1', score: 0, rank: 1, scoreUpdatedAt: expiresAt, finishedAt: expiresAt, ...override,
      }))
      mount()
      fireEvent.click(screen.getByRole('button', { name: 'Empezar partida' }))
      await flush()
      act(() => vi.advanceTimersByTime(30_000))
      await flush()
      expect(screen.getByRole('button', { name: 'Reintentar envío' })).toBeInTheDocument()
      expect(localStorage.getItem(key)).not.toBeNull()
    },
  )
})
