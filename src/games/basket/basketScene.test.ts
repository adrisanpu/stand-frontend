import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { BasketSceneController } from './basketScene'
import { hoopXAt, simulateBasketShotDetailed } from './basketLogic'

const renderer = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn() }))
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three')
  return { ...actual, WebGLRenderer: class {
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    render = renderer.render
    dispose = renderer.dispose
    forceContextLoss() {}
  } }
})

type SceneState = { hoop: THREE.Group; ball: THREE.Group; net: THREE.Group; feedbackUntil: number }

describe('BASKET procedural scene timing and lifecycle', () => {
  let now: number
  let frame: FrameRequestCallback | undefined
  let controller: BasketSceneController
  let canvas: HTMLCanvasElement
  let reduced: boolean
  beforeEach(() => {
    now = 0
    reduced = false
    frame = undefined
    renderer.render.mockClear()
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1 }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn(() => { frame = undefined }))
    vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced } }))
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    canvas = document.createElement('canvas')
  })
  afterEach(() => {
    controller?.dispose()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
  })
  const renderAt = (time: number) => {
    now = time
    const callback = frame
    frame = undefined
    callback?.(time)
  }

  it('interpolates hoop and ball every render and triggers net feedback only once at crossing', () => {
    controller = new BasketSceneController(canvas)
    const state = controller as unknown as SceneState
    const shot = { atMs: 0, vx: 1600, vy: 7800, vz: -7700 }
    controller.setElapsedMs(0)
    controller.setActiveShot(shot, 0)
    const simulation = simulateBasketShotDetailed(shot)
    renderAt(505)
    expect(state.hoop.position.x).toBeCloseTo(hoopXAt(505), 10)
    expect(state.ball.position.x).toBeCloseTo((simulation.trajectory[50].x + simulation.trajectory[51].x) / 2, 10)
    expect(state.feedbackUntil).toBe(0)
    renderAt(1_012)
    expect(state.feedbackUntil).toBeGreaterThan(1_012)
    const end = state.feedbackUntil
    renderAt(1_200)
    expect(state.feedbackUntil).toBe(end)
  })

  it('does not render hidden or context-lost scenes and resumes on restoration with continuing time', () => {
    const lost = vi.fn()
    const restored = vi.fn()
    controller = new BasketSceneController(canvas, { onContextLost: lost, onContextRestored: restored })
    controller.setElapsedMs(0)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    renderAt(500)
    expect(renderer.render).not.toHaveBeenCalled()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    renderAt(1_000)
    expect((controller as unknown as SceneState).hoop.position.x).toBeCloseTo(hoopXAt(1_000))
    const event = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(lost).toHaveBeenCalledOnce()
    renderer.render.mockClear()
    renderAt(2_000)
    expect(renderer.render).not.toHaveBeenCalled()
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    renderAt(2_500)
    expect(restored).toHaveBeenCalledOnce()
    expect(renderer.render).toHaveBeenCalledOnce()
  })

  it('suppresses celebratory net motion with reduced motion enabled', () => {
    reduced = true
    controller = new BasketSceneController(canvas)
    controller.setActiveShot({ atMs: 0, vx: 1600, vy: 7800, vz: -7700 }, 0)
    renderAt(1_100)
    const state = controller as unknown as SceneState
    expect(state.feedbackUntil).toBe(0)
    expect(state.net.rotation.z).toBe(0)
  })
})
