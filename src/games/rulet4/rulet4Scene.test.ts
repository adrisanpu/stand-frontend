import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BufferGeometry, CanvasTexture, Group, Material, Mesh, PerspectiveCamera, Scene, Texture } from 'three'
import { createRulet4Scene } from './rulet4Scene'
import type { Rulet4SceneController } from './rulet4Scene'
import { sampleWheelAngle, SPIN_DURATION, targetWheelAngle, TAU } from './rulet4WheelMotion'
import type { Rulet4PanelConfig } from './GameConfig'

const { renderer, createRenderer } = vi.hoisted(() => {
  const renderer = { setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), outputColorSpace: '' }
  return { renderer, createRenderer: vi.fn(() => renderer) }
})
vi.mock('three', async (importOriginal) => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: createRenderer,
}))

const SEGMENTS: Rulet4PanelConfig[] = [
  { id: 'a', label: 'Rojo', color: '#DC2626', count: 1 },
  { id: 'b', label: 'Negro', color: '#000000', count: 1 },
  { id: 'c', label: 'Verde', color: '#22C55E', count: 1 },
  { id: 'd', label: 'Amarillo', color: '#FACC15', count: 1 },
]
const STEP = TAU / SEGMENTS.length

describe('RULET4 scene controller', () => {
  let frames: Map<number, FrameRequestCallback>
  let frameId: number
  let time: number
  let hidden: boolean
  let canvas: HTMLCanvasElement
  let controller: Rulet4SceneController | undefined
  let onComplete: ReturnType<typeof vi.fn>
  let onStatus: ReturnType<typeof vi.fn>
  let onError: ReturnType<typeof vi.fn>
  let webgl: unknown
  let context2d: Record<string, unknown> | null
  let observers: { callback: () => void; disconnect: ReturnType<typeof vi.fn> }[]

  function setup(overrides: Partial<Parameters<typeof createRulet4Scene>[1]> = {}) {
    controller = createRulet4Scene(canvas, {
      segments: SEGMENTS, accent: '#FACC15', reducedMotion: false, onComplete, onStatus, onError, ...overrides,
    })
    return controller
  }

  function step(ms: number) {
    time += ms
    const callbacks = [...frames.values()]
    frames.clear()
    for (const callback of callbacks) callback(time)
  }

  function world(): Scene { return renderer.render.mock.lastCall![0] as Scene }
  function camera(): PerspectiveCamera { return renderer.render.mock.lastCall![1] as PerspectiveCamera }
  function wheel(): Group { return world().getObjectByName('rulet4-wheel') as Group }
  function pointer(): Group { return world().getObjectByName('rulet4-pointer') as Group }
  function winner(): Mesh { return world().getObjectByName('rulet4-winner') as Mesh }
  function visibility(value: boolean) {
    hidden = value
    document.dispatchEvent(new Event('visibilitychange'))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    renderer.render.mockReset()
    frames = new Map()
    frameId = 0
    time = 0
    hidden = false
    observers = []
    onComplete = vi.fn()
    onStatus = vi.fn()
    onError = vi.fn()
    webgl = {}
    context2d = new Proxy({} as Record<string, unknown>, {
      get: (target, key) => target[key as string] ??= vi.fn(),
      set: (target, key, value) => { target[key as string] = value; return true },
    })
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
      type === '2d' ? context2d : webgl) as unknown as HTMLCanvasElement['getContext'])
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++frameId, callback)
      return frameId
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
    vi.stubGlobal('ResizeObserver', vi.fn((callback: () => void) => {
      const observer = { callback, observe: vi.fn(), disconnect: vi.fn() }
      observers.push(observer)
      return observer
    }))
    canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'clientWidth', { value: 400, configurable: true })
    Object.defineProperty(canvas, 'clientHeight', { value: 600, configurable: true })
  })

  afterEach(() => {
    controller?.dispose()
    controller = undefined
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders one static ready frame with canvas labels, a tilted wheel and capped pixel ratio', () => {
    onStatus.mockImplementation(() => expect(renderer.render).toHaveBeenCalledTimes(1))
    const scene = setup()
    expect(Object.keys(scene).sort()).toEqual(['dispose', 'reset', 'showResult', 'spin'])
    expect(onStatus.mock.calls).toEqual([['ready']])
    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5)
    expect(renderer.setSize).toHaveBeenCalledWith(400, 600, false)
    expect(frames.size).toBe(0)
    expect(wheel().rotation.z).toBe(0)
    expect(wheel().parent!.rotation.x).not.toBe(0)
    expect(winner().visible).toBe(false)
    const labels = (context2d!.fillText as ReturnType<typeof vi.fn>).mock.calls.map(([text]) => text)
    expect(labels).toEqual(SEGMENTS.map((segment) => segment.label))
    const face = world().getObjectByName('rulet4-face') as Mesh
    expect((face.material as Material & { map: Texture }).map).toBeInstanceOf(CanvasTexture)
    step(1000)
    expect(renderer.render).toHaveBeenCalledTimes(1)
  })

  it('keeps configured colours, falls back to #DC2626 and supports a single full-disc segment', () => {
    const fills: unknown[] = []
    const base = context2d!
    context2d = new Proxy(base, {
      set: (target, key, value) => {
        if (key === 'fillStyle') fills.push(value)
        target[key as string] = value
        return true
      },
    })
    const scene = setup({ segments: [{ id: 'x', label: 'Único', count: 1 }] })
    expect(fills[0]).toBe('#DC2626')
    const arc = (base.arc as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(arc[4] - arc[3]).toBeCloseTo(TAU, 12)
    const wedge = winner().geometry as BufferGeometry & { parameters: { thetaLength: number } }
    expect(wedge.parameters.thetaLength).toBeCloseTo(TAU, 12)
    scene.showResult(0)
    expect(winner().visible).toBe(true)
    expect(winner().rotation.z).toBeCloseTo(0, 12)
    expect(Math.cos(wheel().rotation.z)).toBeCloseTo(-1, 10)
    scene.dispose()
    fills.length = 0
    setup({ segments: [{ id: 'a', label: 'A', color: '#123456', count: 1 }, { id: 'b', label: 'B', count: 1 }] })
    expect(fills.filter((fill) => fill === '#123456' || fill === '#DC2626')).toEqual(['#123456', '#DC2626'])
  })
  it('spins with the shared motion curve, ticks the pointer and completes once after the final render', () => {
    const scene = setup()
    const target = targetWheelAngle(2, SEGMENTS.length)
    let renderedFinal = false
    onComplete.mockImplementation(() => {
      renderedFinal = winner().visible && wheel().rotation.z === -target
    })
    scene.spin(2)
    expect(frames.size).toBe(1)
    step(0)
    step(100)
    expect(wheel().rotation.z).toBeCloseTo(-sampleWheelAngle(target, 100), 12)
    let maxKick = 0
    for (let elapsed = 100; elapsed < SPIN_DURATION - 16; elapsed += 16) {
      step(16)
      maxKick = Math.max(maxKick, pointer().rotation.z)
    }
    expect(maxKick).toBeGreaterThan(0.2)
    expect(onComplete).not.toHaveBeenCalled()
    step(100)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(renderedFinal).toBe(true)
    expect(pointer().rotation.z).toBe(0)
    expect(winner().rotation.z).toBeCloseTo(-2 * STEP, 12)
    // Clockwise centre of segment 2 plus the clockwise wheel angle lands on the top.
    expect(Math.cos(2.5 * STEP - wheel().rotation.z)).toBeCloseTo(1, 10)
    expect(frames.size).toBe(0)
    step(5000)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('reveals the final pose without spinning when reduced motion is requested', () => {
    const scene = setup({ reducedMotion: true })
    scene.spin(1)
    step(0)
    step(SPIN_DURATION - 1)
    expect(wheel().rotation.z).toBeCloseTo(0, 12)
    expect(pointer().rotation.z).toBe(0)
    step(1)
    expect(wheel().rotation.z).toBe(-targetWheelAngle(1, SEGMENTS.length, true))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('restarts on a new spin, reports invalid indices and cancels callbacks on reset', () => {
    const scene = setup()
    scene.spin(9)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(frames.size).toBe(0)
    scene.spin(0)
    step(0)
    step(1500)
    scene.spin(1)
    expect(wheel().rotation.z).toBeCloseTo(0, 12)
    step(0)
    step(SPIN_DURATION)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(wheel().rotation.z).toBe(-targetWheelAngle(1, SEGMENTS.length))
    scene.spin(3)
    step(0)
    step(1000)
    scene.reset()
    expect(frames.size).toBe(0)
    expect(wheel().rotation.z).toBeCloseTo(0, 12)
    expect(pointer().rotation.z).toBe(0)
    expect(winner().visible).toBe(false)
    step(SPIN_DURATION * 2)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('shows a completed result immediately without callbacks and cancels any running spin', () => {
    const scene = setup()
    scene.spin(0)
    step(0)
    step(1000)
    scene.showResult(2)
    expect(frames.size).toBe(0)
    expect(wheel().rotation.z).toBe(-targetWheelAngle(2, SEGMENTS.length))
    expect(pointer().rotation.z).toBe(0)
    expect(winner().visible).toBe(true)
    expect(winner().rotation.z).toBeCloseTo(-2 * STEP, 12)
    step(SPIN_DURATION * 2)
    expect(onComplete).not.toHaveBeenCalled()
    scene.showResult(7)
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    scene.reset()
    expect(winner().visible).toBe(false)
    expect(wheel().rotation.z).toBeCloseTo(0, 12)
    scene.spin(1)
    step(0)
    step(SPIN_DURATION)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('keeps a result shown during context loss and renders it on restore', () => {
    const scene = setup()
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    const renders = renderer.render.mock.calls.length
    scene.showResult(1)
    expect(renderer.render).toHaveBeenCalledTimes(renders)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(wheel().rotation.z).toBe(-targetWheelAngle(1, SEGMENTS.length))
    expect(winner().visible).toBe(true)
    expect(onComplete).not.toHaveBeenCalled()
  })
  it('pauses while the document is hidden and resumes the same spin without counting hidden time', () => {
    const scene = setup()
    scene.spin(0)
    step(0)
    step(1000)
    const angle = wheel().rotation.z
    visibility(true)
    expect(frames.size).toBe(0)
    visibility(false)
    expect(frames.size).toBe(1)
    step(60_000)
    expect(wheel().rotation.z).toBe(angle)
    expect(onComplete).not.toHaveBeenCalled()
    step(SPIN_DURATION - 1000)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('starts a spin requested while hidden only once visible', () => {
    hidden = true
    const scene = setup()
    scene.spin(0)
    expect(frames.size).toBe(0)
    visibility(false)
    step(0)
    step(SPIN_DURATION)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('reports lost and restored context and resumes the same spin once', () => {
    const scene = setup()
    scene.spin(3)
    step(0)
    step(1000)
    const angle = wheel().rotation.z
    const renders = renderer.render.mock.calls.length
    const lost = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(onStatus.mock.calls).toEqual([['ready'], ['lost']])
    expect(frames.size).toBe(0)
    step(10_000)
    expect(renderer.render).toHaveBeenCalledTimes(renders)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(onStatus.mock.calls).toEqual([['ready'], ['lost'], ['ready']])
    expect(renderer.render).toHaveBeenCalledTimes(renders + 1)
    step(0)
    expect(wheel().rotation.z).toBe(angle)
    step(SPIN_DURATION - 1000)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(wheel().rotation.z).toBe(-targetWheelAngle(3, SEGMENTS.length))
    expect(onError).not.toHaveBeenCalled()
  })

  it('reports render failures without completing and stops animating', () => {
    const scene = setup()
    scene.spin(0)
    step(0)
    renderer.render.mockImplementationOnce(() => { throw new Error('frame failed') })
    step(16)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'frame failed' }))
    expect(frames.size).toBe(0)
    step(SPIN_DURATION)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('does not complete when the final render fails', () => {
    const scene = setup()
    scene.spin(0)
    step(0)
    renderer.render.mockImplementationOnce(() => { throw new Error('final failed') })
    step(SPIN_DURATION)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('re-renders on resize and frames the wheel for portrait and landscape', () => {
    setup()
    const portrait = camera().position.z
    Object.defineProperty(canvas, 'clientWidth', { value: 900, configurable: true })
    Object.defineProperty(canvas, 'clientHeight', { value: 400, configurable: true })
    observers[0].callback()
    expect(renderer.render).toHaveBeenCalledTimes(2)
    expect(renderer.setSize).toHaveBeenLastCalledWith(900, 400, false)
    expect(camera().aspect).toBe(900 / 400)
    expect(camera().position.z).toBeLessThan(portrait)
    expect(frames.size).toBe(0)
  })

  it('throws explicit errors for missing WebGL 2, missing label context and empty segments', () => {
    const addListener = vi.spyOn(document, 'addEventListener')
    webgl = null
    expect(() => setup()).toThrow(/WebGL 2/)
    expect(createRenderer).not.toHaveBeenCalled()
    webgl = {}
    expect(() => setup({ segments: [] })).toThrow(/panel/)
    context2d = null
    const disposeGeometry = vi.spyOn(BufferGeometry.prototype, 'dispose')
    expect(() => setup()).toThrow(/etiquetas/)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(disposeGeometry).toHaveBeenCalled()
    expect(addListener).not.toHaveBeenCalled()
    expect(onStatus).not.toHaveBeenCalled()
  })

  it('releases every resource, listener, observer and frame on dispose', () => {
    const disposeGeometry = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const disposeMaterial = vi.spyOn(Material.prototype, 'dispose')
    const disposeTexture = vi.spyOn(Texture.prototype, 'dispose')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const removeCanvas = vi.spyOn(canvas, 'removeEventListener')
    const scene = setup()
    const geometries = new Set<BufferGeometry>()
    const materials = new Set<Material>()
    world().traverse((object) => {
      if (object instanceof Mesh) {
        geometries.add(object.geometry)
        materials.add(object.material as Material)
      }
    })
    scene.spin(1)
    step(0)
    scene.dispose()
    expect(frames.size).toBe(0)
    expect(disposeGeometry).toHaveBeenCalledTimes(geometries.size)
    expect(disposeMaterial).toHaveBeenCalledTimes(materials.size)
    expect(disposeTexture).toHaveBeenCalledTimes(1)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1)
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    expect(removeCanvas).toHaveBeenCalledWith('webglcontextlost', expect.any(Function))
    expect(removeCanvas).toHaveBeenCalledWith('webglcontextrestored', expect.any(Function))
    scene.dispose()
    scene.spin(0)
    scene.reset()
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    visibility(false)
    step(SPIN_DURATION * 2)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(renderer.render).toHaveBeenCalledTimes(3)
    expect(onComplete).not.toHaveBeenCalled()
    expect(onStatus.mock.calls).toEqual([['ready']])
  })
})