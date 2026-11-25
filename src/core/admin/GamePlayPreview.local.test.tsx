import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import { publicApi } from '../../api/publicApi'
import { DEFAULT_STACK_CONFIG, type StackEngine } from '../../games/stack/stackLogic'
import { DEFAULT_RULET4_CONFIG } from '../../games/rulet4/rulet4Logic'
import GamePlayPreview from './GamePlayPreview'
import { previewConfigurationError } from './PlayableGamePreview'
import { getGameForm } from '../../api/gameForms'
import type { GameFormResponse } from '../formConfig'

vi.mock('../../api/gameForms', () => ({ getGameForm: vi.fn() }))

const scenes = vi.hoisted(() => ({ dispose: vi.fn(), fail: false }))
const basketScenes = vi.hoisted(() => ({ dispose: vi.fn() }))
vi.mock('../../games/stack/stackScene', async () => {
  const { StackEngine: Engine } = await import('../../games/stack/stackLogic')
  return {
    createStackScene: (_canvas: HTMLCanvasElement, options: {
      config: typeof DEFAULT_STACK_CONFIG; onUpdate: (value: StackEngine['snapshot']) => void
    }) => {
      if (scenes.fail) throw new Error('WebGL unavailable')
      const engine = new Engine(options.config)
      return {
        start: () => { engine.start(); options.onUpdate(engine.snapshot) },
        place: () => { engine.place(); options.onUpdate(engine.snapshot) },
        dispose: scenes.dispose,
      }
    },
  }
})
vi.mock('../../games/basket/basketScene', () => ({
  BasketSceneController: class {
    constructor(_canvas: HTMLCanvasElement) {}
    setElapsedMs(_elapsed: number) {}
    setActiveShot(_shot: unknown, _elapsed: number) {}
    clearShot() {}
    dispose() { basketScenes.dispose() }
  },
}))
vi.mock('../../games/rulet4/Rulet4Wheel', () => ({
  default: ({ spin, onReadyChange, onComplete }: {
    spin: { id: number } | null; onReadyChange: (ready: boolean) => void; onComplete: (id: number) => void
  }) => <div>
    <button onClick={() => onReadyChange(true)}>Escena lista</button>
    <button disabled={!spin} onClick={() => onComplete(spin!.id)}>Terminar giro</button>
  </div>,
}))

describe('isolated playable previews', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    scenes.fail = false
    scenes.dispose.mockClear()
    vi.mocked(getGameForm).mockReset()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    for (const key of Object.keys(publicApi)) {
      if (typeof publicApi[key as keyof typeof publicApi] === 'function') vi.spyOn(publicApi, key as keyof typeof publicApi)
    }
    vi.spyOn(api, 'put')
    vi.spyOn(api, 'post')
    vi.spyOn(api, 'get')
    vi.spyOn(Storage.prototype, 'setItem')
  })
  afterEach(() => {
    cleanup()
    expect(api.put).not.toHaveBeenCalled()
    expect(api.post).not.toHaveBeenCalled()
    expect(api.get).not.toHaveBeenCalled()
    for (const method of Object.values(publicApi)) if (typeof method === 'function') expect(method).not.toHaveBeenCalled()
    expect(Storage.prototype.setItem).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  const reset = () => fireEvent.click(screen.getByRole('button', { name: 'Reiniciar prueba' }))

  it('keeps the existing Home caller inert without settings', () => {
    render(<GamePlayPreview gameType="T1MER" />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('timer')).toHaveTextContent('00:00.0')
    expect(screen.queryByRole('button', { name: 'Reiniciar prueba' })).not.toBeInTheDocument()
  })

  it('renders the trial inside the participant phone shell with the event look', () => {
    render(<GamePlayPreview gameType="T1MER" settings={{}} frame={{
      appearance: { themeMode: 'light', colors: { primary: '#123456', accent: '#654321' } },
      logoUrl: '/event-logo.png', bannerUrl: '/event-banner.png',
    }} />)
    const phone = screen.getByRole('group', { name: 'Vista en el móvil del participante' })
    expect(phone).toHaveAttribute('data-participant-theme', 'light')
    expect(phone).toHaveStyle('--color-primary: #123456')
    expect(phone.querySelector('.play-shell .play-card img[src="/event-banner.png"]')).not.toBeNull()
    expect(phone.querySelector('.play-logo')).toHaveAttribute('src', '/event-logo.png')
    expect(phone).toContainElement(screen.getByRole('button', { name: 'Empezar' }))
    const reset = screen.getByRole('button', { name: 'Reiniciar prueba' })
    expect(reset.querySelector('svg')).toBeInTheDocument()
    expect(phone).not.toContainElement(reset)
  })

  it('plays T1MER with the real target, hidden clock and local result; resets', () => {
    render(<GamePlayPreview gameType="T1MER" settings={{}} />)
    expect(screen.getByRole('timer')).toHaveTextContent('00:00.0')
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))
    act(() => vi.advanceTimersByTime(4990))
    expect(screen.getByRole('timer')).not.toHaveTextContent('??:??.?')
    act(() => vi.advanceTimersByTime(1010))
    expect(screen.getByRole('timer')).toHaveTextContent('??:??.?')
    expect(screen.getByRole('timer')).toHaveClass('t1mer-clock__digits--counting')
    act(() => vi.advanceTimersByTime(4000))
    fireEvent.click(screen.getByRole('button', { name: 'Detener' }))
    expect(screen.getByRole('timer')).not.toHaveClass('t1mer-clock__digits--counting')
    expect(screen.getByText(/Resultado simulado: 10.000 s/)).toHaveTextContent('Diferencia: 0.000 s')
    reset()
    expect(screen.getByRole('timer')).toHaveTextContent('00:00.0')
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeEnabled()
  })

  it('runs STACK through its real engine/scene controller and disposes on reset and exit', () => {
    const view = render(<GamePlayPreview gameType="STACK" settings={DEFAULT_STACK_CONFIG} />)
    view.rerender(<GamePlayPreview gameType="STACK" settings={{ ...DEFAULT_STACK_CONFIG }} />)
    expect(scenes.dispose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Colocar' }))
    expect(screen.getByText('Resultado simulado: 0 bloques')).toBeInTheDocument()
    reset()
    expect(scenes.dispose).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeEnabled()
    view.unmount()
    expect(scenes.dispose).toHaveBeenCalledTimes(2)
  })

  it('runs the local BASKET preview without official APIs and disposes its scene', () => {
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    const view = render(<GamePlayPreview gameType="BASKET" settings={{}} />)
    expect(previewConfigurationError('BASKET', {})).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Empezar prueba local' }))
    act(() => vi.advanceTimersByTime(32_100))
    expect(screen.getByText('Resultado simulado')).toBeInTheDocument()
    expect(screen.getByText('Prueba local, sin ranking ni premios.')).toBeInTheDocument()
    reset()
    expect(basketScenes.dispose).toHaveBeenCalledOnce()
    view.unmount()
    expect(basketScenes.dispose).toHaveBeenCalledTimes(2)
  })

  it('spins the actual RULET4 segments locally, reports simulation and resets', () => {
    render(<GamePlayPreview gameType="RULET4" settings={DEFAULT_RULET4_CONFIG} />)
    fireEvent.click(screen.getByRole('button', { name: 'Escena lista' }))
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Terminar giro' }))
    expect(screen.getByText(/Resultado simulado:/)).toHaveTextContent('No se reserva')
    reset()
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeInTheDocument()
  })

  it('validates EMPAREJA2 with a simulated partner, not another player; resets', () => {
    render(<GamePlayPreview gameType="EMPAREJA2" settings={{ numPairs: 4 }} />)
    fireEvent.change(screen.getByLabelText('Código de tu pareja'), { target: { value: '1002' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    expect(screen.getByRole('alert')).toHaveTextContent('no es el de tu pareja')
    fireEvent.change(screen.getByLabelText('Código de tu pareja'), { target: { value: '1001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    expect(screen.getByText(/¡Pareja validada!/)).toBeInTheDocument()
    reset()
    expect(screen.getByLabelText('Código de tu pareja')).toHaveValue('')
  })

  it('collects repeated letters from different local players in the real L3TRAS presentation; resets', async () => {
    render(<GamePlayPreview gameType="L3TRAS" settings={{ objectiveWord: 'AA', validationTimeLimitSeconds: 15 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }))
    await act(async () => {})
    fireEvent.change(screen.getByLabelText('Código de participante'), { target: { value: '1001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }))
    await act(async () => {})
    expect(screen.getByText('¡Palabra completada!')).toBeInTheDocument()
    reset()
    expect(screen.getByRole('button', { name: 'Añadir letra' })).toBeInTheDocument()
  })

  it('plays the SEMAFORO partner quiz for both local participants and resets', () => {
    render(<GamePlayPreview gameType="SEMAFORO" settings={{}} />)
    fireEvent.change(screen.getByLabelText('Código de tu pareja'), { target: { value: '1001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    for (let turn = 0; turn < 4; turn++) {
      fireEvent.click(screen.getByRole('button', { name: 'Estoy listo: empezar turno' }))
      fireEvent.click(screen.getByRole('button', { name: turn % 2 ? 'Montaña' : 'Playa' }))
    }
    expect(screen.getByText('¡Pareja validada!')).toBeInTheDocument()
    reset()
    expect(screen.getByLabelText('Código de tu pareja')).toBeInTheDocument()
  })

  it('counts SEMAFORO timeouts as mistakes and releases its timer on unmount', () => {
    const view = render(<GamePlayPreview gameType="SEMAFORO" settings={{}} />)
    fireEvent.change(screen.getByLabelText('Código de tu pareja'), { target: { value: '1001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    for (let turn = 0; turn < 3; turn++) {
      fireEvent.click(screen.getByRole('button', { name: 'Estoy listo: empezar turno' }))
      act(() => vi.advanceTimersByTime(5200))
    }
    expect(screen.getByText(/Habéis llegado a tres fallos/)).toBeInTheDocument()
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses the configured SEMAFORO questionnaire and simulated participant answers', () => {
    render(<GamePlayPreview gameType="SEMAFORO" settings={{}} content={{
      quizMoment: 'after_registration',
      questions: [
        { id: 'q1', text: 'Estado', options: [{ title: 'Verde', payload: 'green' }] },
        { id: 'q2', text: '¿Café o té?', options: [{ title: 'Café', payload: 'coffee' }, { title: 'Té', payload: 'tea' }] },
      ],
    }} />)
    fireEvent.change(screen.getByLabelText('Código de tu pareja'), { target: { value: '1001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    fireEvent.click(screen.getByRole('button', { name: 'Estoy listo: empezar turno' }))
    expect(screen.getByRole('heading', { name: '¿Café o té?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Café' }))
    fireEvent.click(screen.getByRole('button', { name: 'Estoy listo: empezar turno' }))
    fireEvent.click(screen.getByRole('button', { name: 'Té' }))
    expect(screen.getByText('¡Pareja validada!')).toBeInTheDocument()
    expect(getGameForm).not.toHaveBeenCalled()
  })

  it('loads SEMAFORO content through only the existing read-only form service when gameId is provided', async () => {
    vi.mocked(getGameForm).mockResolvedValue({
      questions: [], formConfig: { quizMoment: 'disabled' },
    } as unknown as GameFormResponse)
    render(<GamePlayPreview gameType="SEMAFORO" settings={{}} gameId="DEMO" />)
    expect(screen.getByText('Cargando cuestionario de SEMAFORO…')).toBeInTheDocument()
    await act(async () => {})
    expect(getGameForm).toHaveBeenCalledOnce()
    expect(getGameForm).toHaveBeenCalledWith('DEMO')
    fireEvent.change(screen.getByLabelText('Código de tu pareja'), { target: { value: '1001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    expect(screen.getByText('¡Pareja validada!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Estoy listo: empezar turno' })).not.toBeInTheDocument()
  })

  it('does not silently replace unavailable SEMAFORO content with sample questions and allows read retry', async () => {
    vi.mocked(getGameForm).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({
      questions: [], formConfig: { quizMoment: 'disabled' },
    } as unknown as GameFormResponse)
    render(<GamePlayPreview gameType="SEMAFORO" settings={{}} gameId="DEMO" />)
    await act(async () => {})
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar')
    expect(screen.queryByLabelText('Código de tu pareja')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    await act(async () => {})
    expect(screen.getByLabelText('Código de tu pareja')).toBeInTheDocument()
  })

  it('navigates the configured INFOCARDS with the real presentation without writing progress', () => {
    render(<GamePlayPreview gameType="INFOCARDS" settings={{ cards: [
      { id: 'a', title: 'Primera', body: 'Contenido uno' }, { id: 'b', title: 'Segunda', body: 'Contenido dos' },
    ] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('heading', { name: 'Segunda' })).toBeInTheDocument()
    reset()
    expect(screen.getByRole('heading', { name: 'Primera' })).toBeInTheDocument()
  })

  it('plays an IMPOSTOR local round with the configured word/player count, votes and resets', () => {
    render(<GamePlayPreview gameType="IMPOSTOR" settings={{ words: ['Conferencia'], maxPlayers: 3 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Empezar ronda' }))
    expect(screen.getByText('Conferencia')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'He dicho mi palabra' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular siguiente jugador' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular siguiente jugador' }))
    fireEvent.click(screen.getByRole('button', { name: 'Señalar al impostor' }))
    expect(screen.getByText('Ganan los jugadores')).toBeInTheDocument()
    reset()
    expect(screen.getByRole('button', { name: 'Empezar ronda' })).toBeInTheDocument()
  })

  it('restarts on unsaved rule changes and rejects invalid rules without silently using defaults', () => {
    const view = render(<GamePlayPreview gameType="L3TRAS" settings={{ objectiveWord: 'ABC' }} />)
    view.rerender(<GamePlayPreview gameType="L3TRAS" settings={{ objectiveWord: 'XYZ' }} />)
    expect(screen.getByText(/La configuración ha cambiado/)).toBeInTheDocument()
    expect(screen.getByText('XYZ')).toBeInTheDocument()
    view.rerender(<GamePlayPreview gameType="L3TRAS" settings={{ objectiveWord: '' }} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa la palabra')
    expect(screen.queryByRole('button', { name: 'Añadir letra' })).not.toBeInTheDocument()
  })

  it('shows WebGL errors and keeps CUPIDO unavailable', () => {
    scenes.fail = true
    const view = render(<GamePlayPreview gameType="STACK" settings={DEFAULT_STACK_CONFIG} />)
    expect(screen.getByRole('alert')).toHaveTextContent('WebGL 2')
    view.rerender(<GamePlayPreview gameType="CUPIDO" settings={{}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('en desarrollo')
  })

  it('unmounts timers and scenes when leaving the browser tab and restarts on return', () => {
    const view = render(<GamePlayPreview gameType="T1MER" settings={{}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    fireEvent(document, new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(0)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument()
    view.rerender(<GamePlayPreview gameType="STACK" settings={DEFAULT_STACK_CONFIG} />)
    fireEvent(window, new Event('pagehide'))
    expect(scenes.dispose).toHaveBeenCalledOnce()
  })

  it.each([
    ['STACK', {}], ['RULET4', { panels: [] }], ['L3TRAS', { objectiveWord: 'A', validationTimeLimitSeconds: 0 }],
    ['IMPOSTOR', { maxPlayers: 2, words: [] }], ['EMPAREJA2', { numPairs: -1 }], ['INFOCARDS', { cards: [] }],
  ])('rejects invalid %s mechanics', (type, settings) => {
    expect(previewConfigurationError(type as string, settings as Record<string, unknown>)).toBeTruthy()
  })
})
