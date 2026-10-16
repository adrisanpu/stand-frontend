import {
  AmbientLight,
  DirectionalLight,
  Group,
  Mesh,
  AdditiveBlending,
  MeshBasicMaterial,
  OrthographicCamera,
  RingGeometry,
  Scene,
  WebGLRenderer,
} from 'three'
import { followStackHeight, StackEngine } from './stackLogic'
import type { StackConfig, StackLayer, StackRectangle, StackSnapshot } from './stackLogic'
import { createPizzaVisuals } from './stackPizzaVisuals'

export type StackSceneOptions = {
  config: StackConfig
  onContextLost: () => void
  onContextRestored: () => void
  onError: (cause: unknown) => void
  onUpdate?: (snapshot: StackSnapshot) => void
  onPauseChange?: (paused: boolean) => void
}

export type StackSceneController = {
  start(config?: StackConfig): void
  place(): void
  setPaused(paused: boolean): void
  dispose(): void
}

const MAX_RENDER_LAYERS = 64
const MAX_RENDER_FRAGMENTS = 12
type Fragment = { pizza: Group; age: number; velocity: number; spin: number; driftX: number; driftZ: number }

/** Owns GPU resources only; the caller confirms the backend attempt before calling start. */
export function createStackScene(canvas: HTMLCanvasElement, options: StackSceneOptions): StackSceneController {
  const engine = new StackEngine(options.config)
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false })
  if (!context) throw new Error('Este dispositivo no permite crear una escena WebGL 2.')
  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: false })
  const scene = new Scene()
  const camera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 200)
  const visuals = createPizzaVisuals()
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const perfectGeometry = new RingGeometry(0.94, 1, 48)
  const perfectMaterial = new MeshBasicMaterial({
    color: '#f4cf72', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending,
  })
  const perfectHalo = new Mesh(perfectGeometry, perfectMaterial)
  perfectHalo.name = 'stack-perfect'
  perfectHalo.rotation.x = -Math.PI / 2
  perfectHalo.visible = false
  scene.add(perfectHalo)
  let perfectAge = 1
  let perfectWidth = 1
  let perfectDepth = 1
  const perfectDuration = reducedMotion ? 0.16 : 0.48
  scene.add(new AmbientLight('#fff1dc', 1.65))
  const light = new DirectionalLight('#fff0d5', 2.3)
  light.position.set(-3, 8, 5)
  scene.add(light)
  const rim = new DirectionalLight('#e85d32', 0.65)
  rim.position.set(4, 3, -5)
  scene.add(rim)

  const pool: Group[] = []
  const layers: Group[] = []
  const fragments: Fragment[] = []
  let moving: Group | null = null
  let disposed = false
  let lost = false
  let failed = false
  let manualPaused = false
  let hidden = document.hidden
  let blurred = !document.hasFocus()
  let paused = hidden || blurred
  let frame: number | null = null
  let lastTime: number | null = null
  let cameraHeight = 0
  let cameraX = 0
  let cameraZ = 0
  let viewHeight = 4
  let slowFrames = 0
  let fastFrames = 0
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
  let width = 0
  let height = 0
  let appliedRatio = 0

  function acquire(layer: StackLayer, source: StackRectangle = layer): Group {
    const pizza = pool.pop() ?? visuals.create()
    visuals.update(pizza, layer, source, engine.config.layerHeight)
    scene.add(pizza)
    return pizza
  }

  function release(pizza: Group): void {
    scene.remove(pizza)
    pool.push(pizza)
  }

  function addLayer(layer: StackLayer, source: StackRectangle = layer): void {
    // Only presentation is bounded. Gameplay retains full precision and the entire placement log.
    if (layers.length >= MAX_RENDER_LAYERS) release(layers.shift()!)
    layers.push(acquire(layer, source))
  }

  function syncMoving(): void {
    const layer = engine.moving
    if (!layer) {
      if (moving) release(moving)
      moving = null
      return
    }
    if (!moving) moving = acquire(layer)
    moving.position.set(layer.x, layer.y, layer.z)
  }

  function updateCamera(deltaTime: number): void {
    const target = engine.top.y
    cameraHeight = followStackHeight(cameraHeight, target, deltaTime)
    cameraX = followStackHeight(cameraX, engine.top.x, deltaTime)
    cameraZ = followStackHeight(cameraZ, engine.top.z, deltaTime)
    camera.position.set(7 + cameraX, 7 + cameraHeight, 7 + cameraZ)
    camera.lookAt(cameraX, cameraHeight, cameraZ)
    while (layers.length > 1 && layers[0].position.y < cameraHeight - viewHeight * 2) {
      release(layers.shift()!)
    }
  }

  function render(): void {
    if (disposed || lost) return
    const nextWidth = Math.max(1, canvas.clientWidth)
    const nextHeight = Math.max(1, canvas.clientHeight)
    const cap = Math.min(window.devicePixelRatio || 1, 1.5)
    pixelRatio = Math.min(pixelRatio, cap)
    if (width !== nextWidth || height !== nextHeight || appliedRatio !== pixelRatio) {
      width = nextWidth
      height = nextHeight
      appliedRatio = pixelRatio
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(width, height, false)
      const aspect = width / height
      viewHeight = Math.max(4.3, (engine.config.movementRange + Math.max(engine.config.initialWidth, engine.config.initialDepth)) * 0.75 / aspect)
      camera.left = -viewHeight * aspect
      camera.right = viewHeight * aspect
      camera.top = viewHeight
      camera.bottom = -viewHeight
      camera.updateProjectionMatrix()
    }
    renderer.render(scene, camera)
  }

  function emit(): void {
    if (!disposed) options.onUpdate?.(engine.snapshot)
  }

  function cancelFrame(): void {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    lastTime = null
  }

  function animate(): boolean {
    return engine.state === 'PLAYING' || engine.state === 'PLACING' || fragments.length > 0 ||
      perfectHalo.visible || Math.abs(cameraHeight - engine.top.y) > 0.001 ||
      Math.abs(cameraX - engine.top.x) > 0.001 || Math.abs(cameraZ - engine.top.z) > 0.001
  }

  function schedule(): void {
    if (!disposed && !paused && !lost && !failed && frame === null && animate()) {
      frame = requestAnimationFrame(tick)
    }
  }

  function refreshPause(): void {
    const next = manualPaused || hidden || blurred || lost || failed
    engine.setPaused(next)
    if (next === paused) return
    paused = next
    cancelFrame()
    slowFrames = 0
    fastFrames = 0
    options.onPauseChange?.(paused)
    schedule()
  }

  function fail(cause: unknown): void {
    failed = true
    refreshPause()
    cancelFrame()
    options.onError(cause)
  }

  function adaptResolution(deltaTime: number): void {
    if (deltaTime <= 0) return
    slowFrames = deltaTime > 1 / 40 ? slowFrames + 1 : 0
    fastFrames = deltaTime < 1 / 55 ? fastFrames + 1 : 0
    const cap = Math.min(window.devicePixelRatio || 1, 1.5)
    if (slowFrames >= 45) {
      pixelRatio = Math.max(Math.min(0.75, cap), pixelRatio - 0.15)
      slowFrames = 0
    } else if (fastFrames >= 240) {
      pixelRatio = Math.min(cap, pixelRatio + 0.1)
      fastFrames = 0
    }
  }

  function tick(timestamp: number): void {
    frame = null
    if (disposed || paused || lost || failed) return
    const deltaTime = lastTime === null ? 0 : Math.max(0, (timestamp - lastTime) / 1000)
    lastTime = timestamp
    try {
      const changed = engine.update(deltaTime)
      syncMoving()
      if (perfectHalo.visible) {
        perfectAge += deltaTime
        const progress = Math.min(1, perfectAge / perfectDuration)
        const expansion = reducedMotion ? 1 : 1 + 0.24 * (1 - (1 - progress) ** 3)
        perfectHalo.scale.set(perfectWidth * expansion, perfectDepth * expansion, 1)
        perfectMaterial.opacity = 0.85 * (1 - progress) ** 2
        perfectHalo.visible = progress < 1
      }
      for (let i = fragments.length - 1; i >= 0; i--) {
        const fragment = fragments[i]
        fragment.age += deltaTime
        fragment.pizza.position.y += fragment.velocity * deltaTime - 4.9 * deltaTime * deltaTime
        fragment.velocity -= 9.8 * deltaTime
        fragment.pizza.position.x += fragment.driftX * deltaTime
        fragment.pizza.position.z += fragment.driftZ * deltaTime
        fragment.pizza.rotation.x += fragment.spin * deltaTime
        fragment.pizza.rotation.z += fragment.spin * 0.7 * deltaTime
        if (fragment.age > 2.5 || fragment.pizza.position.y < cameraHeight - viewHeight * 2) {
          release(fragment.pizza)
          fragments.splice(i, 1)
        }
      }
      updateCamera(deltaTime)
      adaptResolution(deltaTime)
      if (changed) emit()
      render()
    } catch (cause) {
      fail(cause)
    }
    schedule()
  }

  const onResize = () => {
    try { render() } catch (cause) { fail(cause) }
  }
  const onVisibility = () => { hidden = document.hidden; refreshPause() }
  const onBlur = () => { blurred = true; refreshPause() }
  const onFocus = () => { blurred = false; hidden = document.hidden; refreshPause() }
  const onLost = (event: Event) => {
    if (disposed) return
    event.preventDefault()
    lost = true
    refreshPause()
    options.onContextLost()
  }
  const onRestored = () => {
    if (disposed) return
    lost = false
    try {
      // Three reuploads the shared resources. World objects and the consumed attempt are unchanged.
      width = 0
      render()
      failed = false
      hidden = document.hidden
      refreshPause()
      options.onContextRestored()
      schedule()
    } catch (cause) {
      lost = true
      fail(cause)
    }
  }
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize)

  function dispose(): void {
    if (disposed) return
    disposed = true
    cancelFrame()
    observer?.disconnect()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('webglcontextlost', onLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
    scene.clear()
    layers.length = 0
    fragments.length = 0
    pool.length = 0
    moving = null
    visuals.dispose()
    perfectGeometry.dispose()
    perfectMaterial.dispose()
    renderer.dispose()
  }

  const controller: StackSceneController = {
    start(config) {
      if (disposed || failed) return
      try {
        if (!engine.start(config)) return
        for (const layer of layers) release(layer)
        layers.length = 0
        addLayer(engine.top)
        width = 0
        syncMoving()
        emit()
        render()
        schedule()
      } catch (cause) { fail(cause) }
    },
    place() {
      if (disposed || paused || failed || lost) return
      try {
        const original = engine.moving ? { ...engine.moving } : null
        const cut = engine.place()
        if (!cut) return
        syncMoving()
        if (cut.retained) {
          // Perfect snaps translate the whole pizza; imperfect cuts keep the source's UV frame.
          addLayer(engine.top, cut.placement.perfect ? engine.top : original!)
        }
        if (cut.placement.perfect) {
          perfectAge = 0
          perfectWidth = engine.top.width * 0.65
          perfectDepth = engine.top.depth * 0.75
          perfectHalo.position.set(engine.top.x, cut.y + engine.config.layerHeight * 0.5 + 0.025, engine.top.z)
          perfectHalo.scale.set(perfectWidth, perfectDepth, 1)
          perfectMaterial.opacity = 0.85
          perfectHalo.visible = true
        }
        for (const fragment of cut.fragments) {
          if (fragments.length >= MAX_RENDER_FRAGMENTS) release(fragments.shift()!.pizza)
          fragments.push({
            pizza: acquire({ ...fragment, y: cut.y }, original!),
            age: 0,
            velocity: -0.3,
            spin: reducedMotion ? 0 : cut.placement.offset < 0 ? -2.1 : 2.1,
            driftX: cut.placement.axis === 'x' ? Math.sign(cut.placement.offset) * 0.45 : 0,
            driftZ: cut.placement.axis === 'z' ? Math.sign(cut.placement.offset) * 0.45 : 0,
          })
        }
        emit()
        render()
        schedule()
      } catch (cause) { fail(cause) }
    },
    setPaused(value) {
      if (disposed) return
      manualPaused = value
      refreshPause()
    },
    dispose,
  }

  try {
    engine.setPaused(paused)
    addLayer(engine.top)
    updateCamera(0)
    render()
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    window.addEventListener('resize', onResize)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    observer?.observe(canvas)
    emit()
    if (paused) options.onPauseChange?.(true)
  } catch (cause) {
    dispose()
    throw cause
  }
  return controller
}
