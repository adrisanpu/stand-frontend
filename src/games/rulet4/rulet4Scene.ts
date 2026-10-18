import {
  AmbientLight,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
  AdditiveBlending,
} from 'three'
import type { BufferGeometry, Material, Texture } from 'three'
import type { Rulet4PanelConfig } from './GameConfig'
import { sampleWheelAngle, SPIN_DURATION, targetWheelAngle, TAU } from './rulet4WheelMotion'

export type Rulet4SceneOptions = {
  segments: Rulet4PanelConfig[]
  accent: string
  reducedMotion: boolean
  onComplete: () => void
  onStatus: (status: 'ready' | 'lost') => void
  onError: (cause: unknown) => void
}

export type Rulet4SceneController = {
  spin(index: number): void
  showResult(index: number): void
  reset(): void
  dispose(): void
}

const RADIUS = 1
const FACE_SIZE = 1024
const FALLBACK_COLOR = '#DC2626'
const POINTER_KICK = 0.38
const POINTER_DECAY_MS = 90
// Half extent of the framed content (wheel, rim and pointer) in world units.
const FRAME = 1.32

function textColor(color: string): string {
  const match = /^#?([\da-f]{6})$/i.exec(color.trim())
  if (!match) return '#FFFFFF'
  const value = parseInt(match[1], 16)
  const luminance = (0.299 * (value >> 16) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)) / 255
  return luminance > 0.6 ? '#111827' : '#FFFFFF'
}

/** Segment i spans clockwise angles [i, i + 1) * TAU / count measured from the top; wheel.rotation.z = -angle. */
export function createRulet4Scene(canvas: HTMLCanvasElement, options: Rulet4SceneOptions): Rulet4SceneController {
  const { segments, reducedMotion } = options
  const count = segments.length
  if (count < 1) throw new Error('La ruleta necesita al menos un panel.')
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true })
  if (!context) throw new Error('Este dispositivo no permite crear una escena WebGL 2.')

  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const textures: Texture[] = []
  let faceCanvas: HTMLCanvasElement | null = null
  let renderer: WebGLRenderer | null = null
  let observer: ResizeObserver | null = null
  let disposed = false
  let lost = false
  let failed = false
  let hidden = document.hidden
  let frame: number | null = null
  let lastTime: number | null = null
  let width = 0
  let height = 0
  let ratio = 0
  // Active spin; null when idle. Completed spins keep their pose until reset.
  let spinState: { target: number; elapsed: number; ticks: number; tickAt: number } | null = null

  const step = TAU / count
  const scene = new Scene()
  const camera = new PerspectiveCamera(32, 1, 0.1, 50)
  const stand = new Group()
  const wheel = new Group()
  wheel.name = 'rulet4-wheel'
  const pointer = new Group()
  pointer.name = 'rulet4-pointer'
  let winner!: Mesh

  function geometry<T extends BufferGeometry>(value: T): T { geometries.push(value); return value }
  function material<T extends Material>(value: T): T { materials.push(value); return value }

  function release(): void {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    observer?.disconnect()
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibility)
    canvas.removeEventListener('webglcontextlost', onLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
    scene.clear()
    for (const value of geometries) value.dispose()
    for (const value of materials) value.dispose()
    for (const value of textures) value.dispose()
    geometries.length = 0
    materials.length = 0
    textures.length = 0
    if (faceCanvas) faceCanvas.width = faceCanvas.height = 0
    faceCanvas = null
    renderer?.dispose()
    renderer = null
  }

  function drawFace(): CanvasTexture {
    faceCanvas = document.createElement('canvas')
    faceCanvas.width = faceCanvas.height = FACE_SIZE
    const ctx = faceCanvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo crear la textura de etiquetas de la ruleta.')
    const center = FACE_SIZE / 2
    const radius = center
    const fontSize = Math.round(Math.max(18, Math.min(64, radius * step * 0.42)))
    ctx.translate(center, center)
    segments.forEach((segment, index) => {
      const color = segment.color || FALLBACK_COLOR
      // Canvas angles grow clockwise from +x, so the top is -PI/2.
      const start = index * step - Math.PI / 2
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, radius, start, start + step)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.stroke()
      ctx.save()
      ctx.rotate(start + step / 2)
      ctx.fillStyle = textColor(color)
      ctx.font = `700 ${fontSize}px system-ui, sans-serif`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(segment.label, radius * 0.86, 0, radius * 0.6)
      ctx.restore()
    })
    const texture = new CanvasTexture(faceCanvas)
    textures.push(texture)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 4
    return texture
  }

  function build(): void {
    scene.add(new HemisphereLight('#ffffff', '#3b3b46', 1.1))
    scene.add(new AmbientLight('#ffffff', 0.35))
    const key = new DirectionalLight('#fff4e0', 2.4)
    key.position.set(-2.5, 3, 4)
    scene.add(key)
    const rimLight = new DirectionalLight('#ffffff', 1.2)
    rimLight.position.set(3, -1.5, 2)
    scene.add(rimLight)

    // Slight backward lean and yaw so the rim thickness reads as a real wheel.
    stand.rotation.set(-0.14, 0.16, 0)
    scene.add(stand)
    stand.add(wheel)

    const metal = material(new MeshStandardMaterial({ color: '#d7dbe2', metalness: 0.85, roughness: 0.28 }))
    const body = new Mesh(
      geometry(new CylinderGeometry(RADIUS * 1.02, RADIUS * 1.02, 0.12, 96)),
      material(new MeshStandardMaterial({ color: '#2a2a33', metalness: 0.3, roughness: 0.6 })),
    )
    body.rotation.x = Math.PI / 2
    body.position.z = -0.065
    wheel.add(body)

    const face = new Mesh(
      geometry(new CircleGeometry(RADIUS, 128)),
      material(new MeshStandardMaterial({ map: drawFace(), metalness: 0.05, roughness: 0.55 })),
    )
    face.name = 'rulet4-face'
    wheel.add(face)

    const rim = new Mesh(geometry(new TorusGeometry(RADIUS * 1.02, 0.055, 20, 160)), metal)
    rim.position.z = -0.02
    wheel.add(rim)

    const pegGeometry = geometry(new CylinderGeometry(0.022, 0.022, 0.09, 12))
    for (let index = 0; index < count; index++) {
      const peg = new Mesh(pegGeometry, metal)
      const angle = index * step
      peg.position.set(Math.sin(angle) * RADIUS * 0.95, Math.cos(angle) * RADIUS * 0.95, 0.045)
      peg.rotation.x = Math.PI / 2
      wheel.add(peg)
    }

    const hub = new Mesh(
      geometry(new CylinderGeometry(0.12, 0.14, 0.08, 40)),
      material(new MeshStandardMaterial({ color: options.accent, metalness: 0.7, roughness: 0.3 })),
    )
    hub.rotation.x = Math.PI / 2
    hub.position.z = 0.04
    wheel.add(hub)

    // Wedge of segment 0, rotated clockwise onto the winning index.
    winner = new Mesh(geometry(new CircleGeometry(RADIUS * 0.995, 32, Math.PI / 2 - step, step)), material(new MeshBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false, blending: AdditiveBlending,
    })))
    winner.name = 'rulet4-winner'
    winner.position.z = 0.004
    winner.visible = false
    wheel.add(winner)

    const shape = new Shape()
    shape.moveTo(-0.085, 0)
    shape.lineTo(0.085, 0)
    shape.lineTo(0, -0.22)
    shape.closePath()
    const pointerMaterial = material(new MeshStandardMaterial({ color: options.accent, metalness: 0.45, roughness: 0.35 }))
    const blade = new Mesh(geometry(new ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false })), pointerMaterial)
    blade.position.z = 0.03
    pointer.add(blade)
    const pivot = new Mesh(geometry(new CylinderGeometry(0.045, 0.045, 0.1, 24)), metal)
    pivot.rotation.x = Math.PI / 2
    pivot.position.z = 0.05
    pointer.add(pivot)
    pointer.position.set(0, RADIUS + 0.1, 0.02)
    stand.add(pointer)
  }

  function render(): void {
    if (!renderer || lost) return
    const nextWidth = Math.max(1, canvas.clientWidth)
    const nextHeight = Math.max(1, canvas.clientHeight)
    const nextRatio = Math.min(window.devicePixelRatio || 1, 1.5)
    if (nextWidth !== width || nextHeight !== height || nextRatio !== ratio) {
      width = nextWidth
      height = nextHeight
      ratio = nextRatio
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      const tan = Math.tan((camera.fov * Math.PI) / 360)
      camera.position.set(0, 0, (FRAME / tan) * Math.max(1, 1 / camera.aspect))
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
    }
    renderer.render(scene, camera)
  }

  function pose(angle: number, pointerAngle: number): void {
    wheel.rotation.z = -angle
    pointer.rotation.z = pointerAngle
  }

  function schedule(): void {
    if (frame === null && spinState && !disposed && !lost && !failed && !hidden) frame = requestAnimationFrame(tick)
  }

  function pause(): void {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    lastTime = null
  }

  function fail(cause: unknown): void {
    failed = true
    pause()
    options.onError(cause)
  }

  function tick(timestamp: number): void {
    frame = null
    const active = spinState
    if (!active || disposed || lost || failed || hidden) return
    // The first frame after a start or resume contributes no time, so paused time is discarded.
    active.elapsed += lastTime === null ? 0 : Math.max(0, timestamp - lastTime)
    lastTime = timestamp
    try {
      if (active.elapsed >= SPIN_DURATION) {
        pose(active.target, 0)
        winner.visible = true
        render()
        spinState = null
        lastTime = null
        options.onComplete()
        return
      }
      const angle = sampleWheelAngle(active.target, active.elapsed, reducedMotion)
      const ticks = Math.floor(angle / step)
      if (ticks !== active.ticks) {
        active.ticks = ticks
        active.tickAt = active.elapsed
      }
      const kick = reducedMotion ? 0 : POINTER_KICK * Math.exp(-(active.elapsed - active.tickAt) / POINTER_DECAY_MS)
      pose(angle, kick)
      render()
    } catch (cause) {
      fail(cause)
      return
    }
    schedule()
  }

  function onResize(): void {
    if (disposed || failed) return
    try { render() } catch (cause) { fail(cause) }
  }
  function onVisibility(): void {
    hidden = document.hidden
    if (hidden) pause()
    else schedule()
  }
  function onLost(event: Event): void {
    if (disposed) return
    event.preventDefault()
    lost = true
    pause()
    options.onStatus('lost')
  }
  function onRestored(): void {
    if (disposed) return
    lost = false
    try {
      width = 0
      render()
    } catch (cause) {
      lost = true
      fail(cause)
      return
    }
    failed = false
    hidden = document.hidden
    options.onStatus('ready')
    schedule()
  }

  try {
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true })
    renderer.outputColorSpace = SRGBColorSpace
    build()
    render()
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    document.addEventListener('visibilitychange', onVisibility)
    if (typeof ResizeObserver === 'undefined') window.addEventListener('resize', onResize)
    else {
      observer = new ResizeObserver(onResize)
      observer.observe(canvas)
    }
  } catch (cause) {
    disposed = true
    release()
    throw cause
  }
  options.onStatus('ready')

  return {
    spin(index) {
      if (disposed || failed) return
      let target: number
      try {
        target = targetWheelAngle(index, count, reducedMotion)
      } catch (cause) {
        options.onError(cause)
        return
      }
      // A new spin always restarts from the initial pose; the previous one never completes.
      pause()
      winner.visible = false
      winner.rotation.z = -index * step
      spinState = { target, elapsed: 0, ticks: 0, tickAt: -Infinity }
      pose(0, 0)
      try { render() } catch (cause) { fail(cause); return }
      schedule()
    },
    showResult(index) {
      if (disposed || failed) return
      let target: number
      try {
        target = targetWheelAngle(index, count, reducedMotion)
      } catch (cause) {
        options.onError(cause)
        return
      }
      pause()
      spinState = null
      winner.rotation.z = -index * step
      winner.visible = true
      pose(target, 0)
      try { render() } catch (cause) { fail(cause) }
    },
    reset() {
      if (disposed) return
      pause()
      spinState = null
      winner.visible = false
      pose(0, 0)
      if (failed) return
      try { render() } catch (cause) { fail(cause) }
    },
    dispose() {
      if (disposed) return
      disposed = true
      spinState = null
      release()
    },
  }
}
