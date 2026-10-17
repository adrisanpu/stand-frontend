import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BufferGeometry, DataTexture, Group, Material, Mesh, MeshBasicMaterial, OrthographicCamera, Scene, Texture, Vector3 } from 'three'
import { DEFAULT_STACK_CONFIG, STACK_PLACING_SECONDS, stackSpeed } from './stackLogic'
import type { StackConfig, StackSnapshot } from './stackLogic'
import { createStackScene } from './stackScene'
import type { StackSceneController } from './stackScene'

const { renderer, createRenderer } = vi.hoisted(() => {
  const renderer = { setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn() }
  return { renderer, createRenderer: vi.fn(() => renderer) }
})
vi.mock('three', async (importOriginal) => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: createRenderer,
}))

describe('STACK scene controller', () => {
  let frames: Map<number, FrameRequestCallback>
  let frameId: number
  let time: number
  let hidden: boolean
  let canvas: HTMLCanvasElement
  let snapshots: StackSnapshot[]
  let controller: StackSceneController | undefined
  let onContextLost: ReturnType<typeof vi.fn>
  let onContextRestored: ReturnType<typeof vi.fn>
  let onError: ReturnType<typeof vi.fn>
  let onPauseChange: ReturnType<typeof vi.fn>

  function setup(config: StackConfig = DEFAULT_STACK_CONFIG, onSnapshot?: (snapshot: StackSnapshot) => void) {
    controller = createStackScene(canvas, {
      config, onContextLost, onContextRestored, onError, onPauseChange,
      onUpdate: (snapshot) => { snapshots.push(snapshot); onSnapshot?.(snapshot) },
    })
    return controller
  }

  function step(seconds: number) {
    time += seconds * 1000
    const callbacks = [...frames.values()]
    frames.clear()
    for (const callback of callbacks) callback(time)
  }

  function latest(): StackSnapshot { return snapshots[snapshots.length - 1] }
  function world(): Scene { return renderer.render.mock.lastCall![0] as Scene }
  function camera(): OrthographicCamera { return renderer.render.mock.lastCall![1] as OrthographicCamera }
  function pizzas(): Group[] { return world().children.filter((child): child is Group => child instanceof Group) }
  function active(): Group { return pizzas().reduce((a, b) => a.position.y > b.position.y ? a : b) }
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
    snapshots = []
    onContextLost = vi.fn()
    onContextRestored = vi.fn()
    onError = vi.fn()
    onPauseChange = vi.fn()
    vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as WebGL2RenderingContext)
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++frameId, callback)
      return frameId
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
    canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'clientWidth', { value: 320 })
    Object.defineProperty(canvas, 'clientHeight', { value: 640 })
  })

  afterEach(() => {
    controller?.dispose()
    controller = undefined
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders one static preview, exposes only the controller API, and never starts implicitly', () => {
    const scene = setup()
    expect(Object.keys(scene).sort()).toEqual(['dispose', 'place', 'setPaused', 'start'])
    expect(latest()).toEqual({ state: 'IDLE', score: 0, perfect: false, placements: [] })
    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    expect(pizzas()).toHaveLength(1)
    const pizza = pizzas()[0]
    expect(pizza.name).toBe('stack-piece')
    expect(pizza.children).toHaveLength(1)
    const mesh = pizza.children[0] as Mesh
    expect(mesh.geometry.getAttribute('position').count).toBe(384)
    expect(mesh.geometry.drawRange.count).toBeLessThan(300)
    expect(mesh.geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1])
    scene.place()
    step(10)
    expect(snapshots).toHaveLength(1)
    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5)
  })

  it('accepts authoritative start config, emits discrete transitions only, and locks reentrant/duplicate input', () => {
    const scene = setup()
    scene.start({ ...DEFAULT_STACK_CONFIG, initialWidth: 4, initialSpeed: 4 })
    expect(latest().state).toBe('PLAYING')
    expect(active().scale.x).toBe(4)
    step(0)
    for (let i = 0; i < 60; i++) step(1 / 60)
    expect(snapshots).toHaveLength(2)
    scene.place()
    expect(latest()).toMatchObject({ state: 'PLACING', score: 1, perfect: true })
    expect(latest().placements[0].offset).toBeCloseTo(0, 12)
    scene.place()
    scene.place()
    expect(latest().placements).toHaveLength(1)
    const count = snapshots.length
    step(STACK_PLACING_SECONDS - 0.001)
    scene.place()
    expect(snapshots).toHaveLength(count)
    step(0.0011)
    expect(latest().state).toBe('PLAYING')
    expect(latest().perfect).toBe(false)
    expect(latest().placements[0].perfect).toBe(true)
    expect(latest().score).toBe(1)
    expect(snapshots).toHaveLength(count + 1)
    expect(active().position.z).toBeLessThan(-3.9)
    expect(active().position.x).toBe(0)
    const before = latest()
    scene.start()
    expect(latest()).toBe(before)
    expect(onError).not.toHaveBeenCalled()
  })

  it('marks GAME_OVER immediately, animates the whole missed pizza falling and rotating, then stops RAF', () => {
    const scene = setup()
    scene.start()
    step(0)
    const falling = active()
    const y = falling.position.y
    scene.place()
    expect(latest()).toMatchObject({ state: 'GAME_OVER', score: 0, perfect: false })
    expect(latest().placements).toEqual([{ axis: 'x', offset: -4, perfect: false }])
    scene.place()
    expect(snapshots).toHaveLength(3)
    const fragment = active()
    step(0.1)
    expect(fragment.position.y).toBeLessThan(y)
    expect(Math.abs(fragment.rotation.x)).toBeGreaterThan(0)
    step(3)
    expect(pizzas()).toHaveLength(1)
    expect(frames.size).toBe(0)
    expect(snapshots).toHaveLength(3)
    scene.start()
    expect(latest().state).toBe('GAME_OVER')
  })

  it('enters PLACING before calling the update callback, rejecting reentrant placement', () => {
    const scene = setup(DEFAULT_STACK_CONFIG, (snapshot) => {
      if (snapshot.state === 'PLACING') controller!.place()
    })
    scene.start()
    step(0)
    step(2)
    scene.place()
    expect(latest().placements).toHaveLength(1)
    expect(latest()).toMatchObject({ state: 'PLACING', score: 1 })
    expect(snapshots).toHaveLength(3)
  })

  it('creates a separate cut fragment, preserving the retained layer while it falls', () => {
    const scene = setup()
    scene.start()
    step(0)
    step(2.25)
    scene.place()
    expect(latest()).toMatchObject({ state: 'PLACING', score: 1, perfect: false })
    expect(pizzas()).toHaveLength(3)
    const fragment = pizzas().find((pizza) => pizza.scale.x < 1)!
    const retained = pizzas().find((pizza) => pizza.scale.x === 2.5)!
    expect(fragment).not.toBe(retained)
    const retainedY = retained.position.y
    step(0.1)
    expect(fragment.position.y).toBeLessThan(retainedY)
    expect(retained.position.y).toBe(retainedY)
    step(0.12)
    expect(latest().state).toBe('PLAYING')
    expect(active().scale.x).toBe(2.5)
  })

  it('combines manual, blur and visibility pauses and discards elapsed time after resume', () => {
    const scene = setup()
    scene.start()
    step(0)
    step(0.5)
    const x = active().position.x
    scene.setPaused(true)
    expect(frames.size).toBe(0)
    window.dispatchEvent(new Event('blur'))
    visibility(true)
    window.dispatchEvent(new Event('focus'))
    scene.setPaused(false)
    expect(frames.size).toBe(0)
    visibility(false)
    expect(frames.size).toBe(1)
    step(500)
    expect(active().position.x).toBe(x)
    step(0.1)
    expect(active().position.x).toBeCloseTo(x + 0.2)
    window.dispatchEvent(new Event('blur'))
    scene.setPaused(true)
    window.dispatchEvent(new Event('focus'))
    expect(frames.size).toBe(0)
    scene.place()
    expect(latest().score).toBe(0)
    scene.setPaused(false)
    expect(frames.size).toBe(1)
    expect(onPauseChange.mock.calls.map((args) => args[0])).toEqual([true, false, true, false])
  })

  it('allows backend-confirmed start while hidden and preserves the pause', () => {
    hidden = true
    const scene = setup()
    scene.start()
    expect(latest().state).toBe('PLAYING')
    expect(onPauseChange).toHaveBeenCalledWith(true)
    expect(frames.size).toBe(0)
    scene.place()
    expect(latest().placements).toHaveLength(0)
    visibility(false)
    step(999)
    expect(active().position.x).toBe(-4)
    step(0.25)
    expect(active().position.x).toBe(-3.5)
  })

  it('restores context without resetting the attempt or overriding a manual pause', () => {
    const scene = setup()
    scene.start()
    step(0)
    step(2)
    scene.place()
    const snapshot = latest()
    scene.setPaused(true)
    const lost = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(lost)
    expect(lost.defaultPrevented).toBe(true)
    expect(onContextLost).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(onContextRestored).toHaveBeenCalledTimes(1)
    expect(latest()).toBe(snapshot)
    expect(frames.size).toBe(0)
    scene.setPaused(false)
    step(100)
    expect(latest().state).toBe('PLACING')
    step(STACK_PLACING_SECONDS)
    expect(latest()).toMatchObject({ state: 'PLAYING', score: 1 })
    expect(onError).not.toHaveBeenCalled()
  })

  it('records an authoritative start confirmed during context loss and resumes the same game', () => {
    const scene = setup()
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    scene.start()
    expect(latest().state).toBe('PLAYING')
    expect(frames.size).toBe(0)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    step(100)
    expect(active().position.x).toBe(-4)
    expect(latest().score).toBe(0)
  })

  it('reports restoration and frame-render errors, freezing input instead of silently continuing', () => {
    const scene = setup()
    scene.start()
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    renderer.render.mockImplementationOnce(() => { throw new Error('restore failed') })
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'restore failed' }))
    expect(onContextRestored).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
    scene.setPaused(false)
    scene.place()
    expect(latest().placements).toHaveLength(0)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(onContextRestored).toHaveBeenCalledTimes(1)
    renderer.render.mockImplementationOnce(() => { throw new Error('frame failed') })
    step(0)
    expect(onError).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'frame failed' }))
    expect(frames.size).toBe(0)
  })

  it('emits a completed logical transition even if rendering that transition fails', () => {
    const scene = setup()
    scene.start()
    step(0)
    step(2)
    scene.place()
    renderer.render.mockImplementationOnce(() => { throw new Error('spawn render failed') })
    step(STACK_PLACING_SECONDS)
    expect(latest()).toMatchObject({ state: 'PLAYING', score: 1 })
    expect(onError).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    step(100)
    expect(latest()).toMatchObject({ state: 'PLAYING', score: 1 })
    expect(active().position.z).toBe(-4)
  })

  it('keeps discarded fragments bounded during a long sequence of imperfect placements', () => {
    const config = { ...DEFAULT_STACK_CONFIG, initialWidth: 1000, initialDepth: 1000, initialSpeed: 1000, maxSpeed: 1000, speedIncrement: 0, perfectTolerance: 0 }
    const scene = setup(config)
    scene.start()
    step(0)
    for (let score = 0; score < 100; score++) {
      step(0.0045)
      scene.place()
      expect(latest().score).toBe(score + 1)
      expect(latest().perfect).toBe(false)
      step(STACK_PLACING_SECONDS)
      expect(pizzas().length).toBeLessThanOrEqual(64 + 12 + 1)
    }
    expect(latest().placements).toHaveLength(100)
    expect(active().scale.x).toBeCloseTo(975, 7)
    expect(active().scale.z).toBeCloseTo(975, 7)
  })

  it('smoothly follows the tower at a fixed angle and bounds rendered resources without a gameplay limit', () => {
    const disposeGeometry = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const disposeMaterial = vi.spyOn(Material.prototype, 'dispose')
    const disposeTexture = vi.spyOn(Texture.prototype, 'dispose')
    const geometries = new Set<BufferGeometry>()
    const attributes = new Set<unknown>()
    const scene = setup({ ...DEFAULT_STACK_CONFIG, skin: 'pizza' })
    scene.start()
    step(0)
    for (let score = 0; score < 250; score++) {
      step(DEFAULT_STACK_CONFIG.movementRange / stackSpeed(DEFAULT_STACK_CONFIG, score))
      scene.place()
      expect(latest()).toMatchObject({ state: 'PLACING', score: score + 1, perfect: true })
      step(STACK_PLACING_SECONDS)
      expect(pizzas().length).toBeLessThanOrEqual(65)
      for (const pizza of pizzas()) {
        const geometry = (pizza.children[0] as Mesh).geometry
        geometries.add(geometry)
        attributes.add(geometry.getAttribute('position'))
      }
    }
    expect(latest().placements).toHaveLength(250)
    expect(latest().score).toBe(250)
    expect(camera().position.y).toBeGreaterThan(60)
    expect(camera().position.x).toBe(7)
    expect(camera().position.z).toBe(7)
    expect(disposeGeometry).not.toHaveBeenCalled()
    expect(disposeMaterial).not.toHaveBeenCalled()
    expect(geometries.size).toBeLessThanOrEqual(65)
    expect(attributes.size).toBe(geometries.size)
    scene.dispose()
    expect(disposeGeometry).toHaveBeenCalledTimes(geometries.size + 1)
    expect(disposeMaterial).toHaveBeenCalledTimes(3)
    expect(disposeTexture).toHaveBeenCalledTimes(1)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
    scene.dispose()
    scene.place()
    scene.start()
    scene.setPaused(false)
    expect(renderer.dispose).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })

  it('preserves the moving surface UV frame in the retained pizza and its offcut', () => {
    const scene = setup()
    scene.start()
    step(0)
    step(2.25)
    const source = active()
    const originalX = source.position.x
    const originalWidth = source.scale.x
    const material = (source.children[0] as Mesh).material
    scene.place()
    const slices = pizzas().filter((pizza) => pizza.position.y === DEFAULT_STACK_CONFIG.layerHeight)
    expect(slices).toHaveLength(2)
    for (const slice of slices) {
      const mesh = slice.children[0] as Mesh
      expect(mesh.material).toBe(material)
      const position = mesh.geometry.getAttribute('position')
      const uv = mesh.geometry.getAttribute('uv')
      const top = mesh.geometry.groups[1]
      for (let i = top.start; i < top.start + top.count; i++) {
        const worldX = position.getX(i) * slice.scale.x + slice.position.x
        expect(uv.getX(i)).toBeCloseTo((worldX - originalX) / originalWidth + 0.5, 6)
      }
    }
    const offcut = slices.find((pizza) => pizza.scale.x < 1)!
    const top = (offcut.children[0] as Mesh).geometry.groups[1]
    const uv = (offcut.children[0] as Mesh).geometry.getAttribute('uv')
    expect(Math.min(...Array.from({ length: top.count }, (_, i) => uv.getX(top.start + i)))).toBeGreaterThan(0.8)
  })

  it('renders baklava slices twice as tall without changing placements', () => {
    const scene = setup({ ...DEFAULT_STACK_CONFIG, skin: 'baklava' })
    scene.start({ ...DEFAULT_STACK_CONFIG, skin: 'baklava' })
    step(0)
    step(2)
    scene.place()
    expect(latest().placements[0]).toMatchObject({ axis: 'x', perfect: true })
    const height = DEFAULT_STACK_CONFIG.layerHeight * 2
    expect(pizzas().map((piece) => piece.scale.y)).toEqual(pizzas().map(() => height))
    expect(pizzas().some((piece) => piece.position.y === height)).toBe(true)
  })

  it('uses a shared procedural surface, warm directional lighting and no shadow rendering', () => {
    const scene = setup({ ...DEFAULT_STACK_CONFIG, skin: 'baklava' })
    scene.start()
    const meshes = pizzas().map((pizza) => pizza.children[0] as Mesh)
    expect(meshes[0].material).toBe(meshes[1].material)
    const materials = meshes[0].material as Material[]
    expect((materials[1] as Material & { map: Texture }).map).toBeInstanceOf(DataTexture)
    expect(world().children.filter((child) => child.type === 'DirectionalLight')).toHaveLength(2)
    expect(meshes.every((mesh) => !mesh.castShadow && !mesh.receiveShadow)).toBe(true)
  })

  it('runs one time-based Perfect halo, freezes it during pause and retires it without allocations', () => {
    const scene = setup()
    scene.start()
    step(0)
    step(2)
    scene.place()
    const halo = world().getObjectByName('stack-perfect') as Mesh
    const material = halo.material as MeshBasicMaterial
    expect(halo.visible).toBe(true)
    expect(material.color.getHexString()).toBe('f4cf72')
    expect(material.depthWrite).toBe(false)
    const initialScale = halo.scale.x
    step(0.1)
    expect(halo.scale.x).toBeGreaterThan(initialScale)
    expect(material.opacity).toBeGreaterThan(0)
    expect(material.opacity).toBeLessThan(0.85)
    const opacity = material.opacity
    scene.setPaused(true)
    step(10)
    expect(material.opacity).toBe(opacity)
    scene.setPaused(false)
    step(10)
    expect(material.opacity).toBe(opacity)
    step(0.5)
    expect(halo.visible).toBe(false)
    expect(material.opacity).toBe(0)
    expect(world().getObjectByName('stack-perfect')).toBe(halo)
    expect(latest().score).toBe(1)
  })

  it('reduces nonessential Perfect motion without changing placement timing or speed', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const scene = setup()
    scene.start()
    step(0)
    step(2)
    scene.place()
    const halo = world().getObjectByName('stack-perfect') as Mesh
    const scale = halo.scale.clone()
    step(0.1)
    expect(halo.scale).toEqual(scale)
    expect(latest().state).toBe('PLACING')
    step(0.12)
    expect(halo.visible).toBe(false)
    expect(latest()).toMatchObject({ state: 'PLAYING', score: 1 })
    expect(active().position.z).toBe(-4)
  })

  it('follows a shrinking off-centre support while maintaining the camera angle and visible support bounds', () => {
    const scene = setup()
    scene.start()
    step(0)
    step(2.25)
    scene.place()
    step(STACK_PLACING_SECONDS)
    step(1)
    const support = pizzas().find((pizza) => pizza.scale.x === 2.5 && pizza.position.y === 0.24)!
    expect(camera().position.x).toBeGreaterThan(7)
    const direction = camera().getWorldDirection(new Vector3())
    expect(direction.x).toBeCloseTo(direction.y, 6)
    expect(direction.y).toBeCloseTo(direction.z, 6)
    camera().updateMatrixWorld()
    for (const x of [-0.5, 0.5]) {
      for (const z of [-0.5, 0.5]) {
        const projected = new Vector3(support.position.x + x * support.scale.x, support.position.y, support.position.z + z * support.scale.z).project(camera())
        expect(Math.abs(projected.x)).toBeLessThan(1)
        expect(Math.abs(projected.y)).toBeLessThan(1)
      }
    }
  })

  it('caps pixel ratio and lowers it on sustained slow frames, without resizing every frame', () => {
    const scene = setup()
    scene.start()
    step(0)
    const initialSizes = renderer.setSize.mock.calls.length
    for (let i = 0; i < 20; i++) step(1 / 60)
    expect(renderer.setSize).toHaveBeenCalledTimes(initialSizes)
    for (let i = 0; i < 400; i++) step(1 / 30)
    expect(renderer.setPixelRatio.mock.calls.some(([ratio]) => ratio < 1.5)).toBe(true)
    expect(renderer.setPixelRatio.mock.calls.every(([ratio]) => ratio >= 0.75 && ratio <= 1.5)).toBe(true)
    expect(snapshots).toHaveLength(2)
    for (let i = 0; i < 241; i++) step(1 / 60)
    expect(renderer.setPixelRatio.mock.lastCall![0]).toBeGreaterThan(0.75)
  })

  it.each([[320, 844], [390, 844], [844, 390], [1920, 1080]])(
    'keeps the base and active pizza inside the %sx%s viewport without changing gameplay',
    (width, height) => {
      canvas = document.createElement('canvas')
      Object.defineProperty(canvas, 'clientWidth', { value: width })
      Object.defineProperty(canvas, 'clientHeight', { value: height })
      const scene = setup()
      scene.start()
      camera().updateMatrixWorld()
      expect(renderer.setSize).toHaveBeenLastCalledWith(width, height, false)
      for (const pizza of pizzas()) {
        for (const x of [-0.5, 0.5]) {
          for (const z of [-0.5, 0.5]) {
            const projected = new Vector3(
              pizza.position.x + x * pizza.scale.x,
              pizza.position.y + pizza.scale.y / 2,
              pizza.position.z + z * pizza.scale.z,
            ).project(camera())
            expect(Math.abs(projected.x)).toBeLessThan(1)
            expect(Math.abs(projected.y)).toBeLessThan(1)
          }
        }
      }
      expect(latest()).toMatchObject({ state: 'PLAYING', score: 0, placements: [] })
    },
  )

  it('reframes on orientation resize without ResizeObserver or resetting the attempt', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    canvas = document.createElement('canvas')
    let width = 390
    let height = 844
    Object.defineProperty(canvas, 'clientWidth', { get: () => width })
    Object.defineProperty(canvas, 'clientHeight', { get: () => height })
    const scene = setup()
    scene.start()
    step(0)
    step(2)
    scene.place()
    const before = latest()
    const originalProjection = camera().projectionMatrix.clone()
    width = 844
    height = 390
    window.dispatchEvent(new Event('resize'))
    expect(renderer.setSize).toHaveBeenLastCalledWith(844, 390, false)
    expect(camera().projectionMatrix.equals(originalProjection)).toBe(false)
    expect(latest()).toBe(before)
    step(STACK_PLACING_SECONDS)
    expect(latest()).toMatchObject({ state: 'PLAYING', score: 1 })
    expect(frames.size).toBe(1)
    expect(onError).not.toHaveBeenCalled()
  })

  it('releases listeners, observer, RAF and shared resources on dispose and initialization failure', () => {
    const disconnect = vi.fn()
    const observe = vi.fn()
    vi.stubGlobal('ResizeObserver', vi.fn(() => ({ observe, disconnect })))
    const scene = setup()
    scene.start()
    expect(observe).toHaveBeenCalledWith(canvas)
    scene.dispose()
    expect(disconnect).toHaveBeenCalledTimes(1)
    const renderCount = renderer.render.mock.calls.length
    const snapshotCount = snapshots.length
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
    visibility(true)
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    step(10)
    expect(renderer.render).toHaveBeenCalledTimes(renderCount)
    expect(snapshots).toHaveLength(snapshotCount)
    expect(onContextLost).not.toHaveBeenCalled()
    expect(onContextRestored).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)

    renderer.render.mockImplementationOnce(() => { throw new Error('init failed') })
    expect(() => setup()).toThrow('init failed')
    expect(renderer.dispose).toHaveBeenCalledTimes(2)
    expect(disconnect).toHaveBeenCalledTimes(2)
    expect(frames.size).toBe(0)
  })

  it('supports the StrictMode setup-cleanup-setup lifecycle without duplicate RAF or listeners', () => {
    const first = setup()
    first.start()
    first.dispose()
    const second = setup()
    second.start()
    expect(frames.size).toBe(1)
    window.dispatchEvent(new Event('blur'))
    expect(frames.size).toBe(0)
    expect(onPauseChange).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('focus'))
    expect(frames.size).toBe(1)
    expect(onPauseChange).toHaveBeenCalledTimes(2)
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    expect(onContextLost).toHaveBeenCalledTimes(1)
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    expect(onContextRestored).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(1)
    second.dispose()
    expect(frames.size).toBe(0)
    expect(renderer.dispose).toHaveBeenCalledTimes(2)
  })

  it('throws before constructing a renderer when WebGL2 or authoritative config is missing', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    expect(() => setup()).toThrow('WebGL 2')
    expect(createRenderer).not.toHaveBeenCalled()
    expect(() => setup({ ...DEFAULT_STACK_CONFIG, movementRange: 0 })).toThrow('Configuración')
    expect(createRenderer).not.toHaveBeenCalled()
  })
})
