import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { api } from '../../api/api'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../../core/shell/operatorLanguage'
import GameScreen from './GameScreen'
import { createRulet4Scene } from './rulet4Scene'
import { DEFAULT_RULET4_CONFIG } from './rulet4Logic'

const { createScene, controllers } = vi.hoisted(() => ({
  createScene: vi.fn(),
  controllers: [] as { spin: ReturnType<typeof vi.fn>; showResult: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[],
}))
vi.mock('./rulet4Scene', () => ({ createRulet4Scene: createScene }))
vi.mock('../../api/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

type Options = Parameters<typeof import('./rulet4Scene').createRulet4Scene>[1]
function options(index = createScene.mock.calls.length - 1): Options {
  return createScene.mock.calls[index][1] as Options
}
function view(orientation: 'portrait' | 'landscape' = 'portrait', gameId = 'roulette') {
  return <GameScreen gameId={gameId} orientation={orientation} logoElement={<div>Logo</div>} sidebarElement={<div>Sidebar</div>} />
}
async function ready() {
  await waitFor(() => expect(createScene).toHaveBeenCalled())
}
async function validate() {
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
  await screen.findByText('¡Bienvenido, Ana!')
}
const spinButton = () => screen.getByRole('button', { name: 'GIRAR RULETA' })
async function spin() {
  fireEvent.click(spinButton())
  await waitFor(() => expect(controllers[controllers.length - 1].spin).toHaveBeenCalledWith(8))
}

describe('RULET4 3D integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    controllers.length = 0
    localStorage.clear()
    vi.mocked(createRulet4Scene).mockImplementation((_canvas: HTMLCanvasElement, opts: Options) => {
      const controller = { spin: vi.fn(), showResult: vi.fn(), reset: vi.fn(), dispose: vi.fn() }
      controllers.push(controller)
      opts.onStatus('ready')
      return controller
    })
    vi.mocked(api.get).mockResolvedValue({ game: { type: { RULET4: DEFAULT_RULET4_CONFIG } } })
    vi.mocked(api.post).mockImplementation(async (path) => path === '/v1/game/validate'
      ? { valid: true, playerId: '1', username: 'Ana' }
      : { ok: true, result: {
        panel: DEFAULT_RULET4_CONFIG.panels[2], index: 8, configSnapshot: DEFAULT_RULET4_CONFIG,
        spunAt: '2026-10-26T12:00:00Z',
      } })
  })
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each(['portrait', 'landscape'] as const)('completes and submits the displayed prize once in %s', async (orientation) => {
    render(view(orientation))
    await ready()
    expect(screen.getAllByRole('img', { name: 'Ruleta de premios 3D' })).toHaveLength(1)
    expect(spinButton()).toBeDisabled()
    await validate()
    expect(spinButton()).toBeEnabled()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    await spin()
    fireEvent.click(spinButton())
    expect(controllers[0].spin).toHaveBeenCalledTimes(1)
    expect(controllers[0].spin).toHaveBeenCalledWith(8)
    expect(spinButton()).toBeDisabled()
    expect(api.post).toHaveBeenCalledTimes(2)
    act(() => { options().onComplete(); options().onComplete() })
    expect(screen.getByText('Verde')).toBeInTheDocument()
    expect(controllers[0].showResult).toHaveBeenCalledWith(8)
    expect(api.post).toHaveBeenCalledTimes(2)
    expect(api.post).toHaveBeenLastCalledWith('/v1/game/score', {
      gameId: 'roulette', playerId: '1',
    })
  })

  it('blocks a validated player while loading, losing context or failing', async () => {
    createScene.mockImplementationOnce((_canvas: HTMLCanvasElement, _opts: Options) => {
      const controller = { spin: vi.fn(), showResult: vi.fn(), reset: vi.fn(), dispose: vi.fn() }
      controllers.push(controller)
      return controller
    })
    render(view())
    await ready()
    await validate()
    expect(spinButton()).toBeDisabled()
    act(() => options().onStatus('ready'))
    expect(spinButton()).toBeEnabled()
    act(() => options().onStatus('lost'))
    expect(screen.getByRole('alert')).toHaveTextContent('Se ha perdido')
    expect(spinButton()).toBeDisabled()
    act(() => options().onStatus('ready'))
    expect(spinButton()).toBeEnabled()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => options().onError(new Error('GPU failed')))
    expect(spinButton()).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('WebGL 2')
  })

  it('recovers the same selected prize after failure, ignoring callbacks from the disposed scene', async () => {
    render(view())
    await ready()
    await validate()
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    await spin()
    const failedOptions = options()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => failedOptions.onError(new Error('render failed')))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar 3D' }))
    await waitFor(() => expect(createScene).toHaveBeenCalledTimes(2))
    expect(controllers[0].dispose).toHaveBeenCalledOnce()
    expect(controllers[1].spin).toHaveBeenCalledTimes(1)
    expect(controllers[1].spin).toHaveBeenCalledWith(8)
    expect(random).not.toHaveBeenCalled()
    act(() => failedOptions.onComplete())
    expect(api.post).toHaveBeenCalledTimes(2)
    act(() => options().onComplete())
    expect(screen.getByText('Verde')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('retains the selected target when switching layout during a spin and the final pose afterwards', async () => {
    const rendered = render(view())
    await ready()
    await validate()
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    await spin()
    const old = options()
    rendered.rerender(view('landscape'))
    await waitFor(() => expect(createScene).toHaveBeenCalledTimes(2))
    expect(controllers[1].spin).toHaveBeenCalledTimes(1)
    expect(controllers[1].spin).toHaveBeenCalledWith(8)
    act(() => old.onComplete())
    expect(api.post).toHaveBeenCalledTimes(2)
    act(() => options().onComplete())
    rendered.rerender(view('portrait'))
    await waitFor(() => expect(createScene).toHaveBeenCalledTimes(3))
    expect(controllers[2].spin).not.toHaveBeenCalled()
    expect(controllers[2].showResult).toHaveBeenCalledWith(8)
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('ignores late completion after reset or changing game', async () => {
    const rendered = render(view())
    await ready()
    await validate()
    await spin()
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
    act(() => options().onComplete())
    expect(screen.queryByText('¡Has ganado!')).not.toBeInTheDocument()
    expect(api.post).toHaveBeenCalledTimes(2)
    await validate()
    await spin()
    const old = options()
    rendered.rerender(view('portrait', 'another-game'))
    act(() => old.onComplete())
    expect(api.post).toHaveBeenCalledTimes(4)
    expect(screen.getByRole('spinbutton')).toHaveValue(null)
  })

  it('shows initialization errors without enabling a fallback wheel', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createScene.mockImplementationOnce(() => { throw new Error('No WebGL') })
    render(view())
    expect(await screen.findByRole('alert')).toHaveTextContent('WebGL 2')
    await validate()
    expect(spinButton()).toBeDisabled()
    expect(document.querySelector('svg[viewBox="0 0 400 400"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar 3D' }))
    await waitFor(() => expect(spinButton()).toBeEnabled())
  })

  it('ignores an old code validation when changing game', async () => {
    let resolve: ((value: { valid: boolean; playerId: string; username: string }) => void) | undefined
    vi.mocked(api.post).mockReturnValueOnce(new Promise((done) => { resolve = done }))
    const rendered = render(view())
    await ready()
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
    rendered.rerender(view('portrait', 'another-game'))
    await act(async () => { resolve?.({ valid: true, playerId: 'old-player', username: 'Old' }) })
    expect(screen.queryByText('¡Bienvenido, Old!')).not.toBeInTheDocument()
    expect(spinButton()).toBeDisabled()
    expect(screen.getByRole('spinbutton')).toHaveValue(null)
  })

  it('passes reduced motion and disposes the scene without late score submission', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const rendered = render(view())
    await ready()
    expect(options().reducedMotion).toBe(true)
    await validate()
    await spin()
    const old = options()
    rendered.unmount()
    act(() => old.onComplete())
    expect(controllers[0].dispose).toHaveBeenCalledOnce()
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('initializes only the live scene under StrictMode', async () => {
    const rendered = render(<StrictMode>{view()}</StrictMode>)
    await ready()
    expect(createScene).toHaveBeenCalledTimes(1)
    await validate()
    expect(spinButton()).toBeEnabled()
    rendered.unmount()
    expect(controllers[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('localizes scene failures and recovery controls in English', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<OperatorLanguageProvider><OperatorLanguageSelector />{view()}</OperatorLanguageProvider>)
    await ready()
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    act(() => options().onError(new Error('GPU failed')))
    expect(screen.getByRole('alert')).toHaveTextContent('This game requires WebGL 2')
    expect(screen.getByRole('button', { name: 'Retry 3D' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '3D prize wheel' })).toBeInTheDocument()
  })
})
