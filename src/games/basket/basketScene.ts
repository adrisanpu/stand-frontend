import * as THREE from 'three'
import { BASKET_PHYSICS, hoopXAt, simulateBasketShotDetailed } from './basketLogic'
import type { BasketShot, BasketShotSimulation } from './basketLogic'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
type SceneOptions = { onContextLost?: () => void; onContextRestored?: () => void }

export class BasketSceneController {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80)
  private readonly hoop = new THREE.Group()
  private readonly hoopRing = new THREE.Group()
  private readonly net = new THREE.Group()
  private readonly ball = new THREE.Group()
  private readonly ballShadow: THREE.Mesh
  private readonly resizeObserver: ResizeObserver | null
  private frame = 0
  private elapsedMs = 0
  private elapsedAt = performance.now()
  private activeSimulation: BasketShotSimulation | null = null
  private flightElapsedMs = 0
  private flightAt = performance.now()
  private scoreFeedbackPlayed = false
  private activeShotKey = ''
  private feedbackUntil = 0
  private disposed = false
  private contextLost = false
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')

  constructor(private readonly canvas: HTMLCanvasElement, private readonly options: SceneOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    this.renderer.setClearColor(0x10151a, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(0x10151a)
    this.scene.fog = new THREE.Fog(0x10151a, 20, 42)
    this.camera.position.set(0, 4.1, 11.6)
    this.camera.lookAt(0, 2.1, -0.5)
    this.scene.add(new THREE.HemisphereLight(0xdbeeff, 0x403326, 2.0))
    const keyLight = new THREE.DirectionalLight(0xffe6bd, 2.1)
    keyLight.position.set(-4, 8, 6)
    this.scene.add(keyLight)
    this.buildCourt()
    this.buildHoop()
    this.ballShadow = this.createBall()
    this.scene.add(this.hoop, this.ball)
    this.resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => this.resize())
    this.resizeObserver?.observe(canvas)
    window.addEventListener('resize', this.resize)
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    canvas.addEventListener('webglcontextrestored', this.onContextRestored)
    document.addEventListener('visibilitychange', this.onVisibilityChange)
    this.resize()
    this.scheduleFrame()
  }

  setElapsedMs(value: number) {
    this.elapsedMs = Math.max(0, value)
    this.elapsedAt = performance.now()
  }

  setActiveShot(shot: BasketShot, flightElapsedMs: number, _made = false) {
    const key = `${shot.atMs}:${shot.vx}:${shot.vy}:${shot.vz}`
    if (key !== this.activeShotKey) {
      this.activeShotKey = key
      this.activeSimulation = simulateBasketShotDetailed(shot)
      this.scoreFeedbackPlayed = false
    }
    this.flightElapsedMs = clamp(flightElapsedMs, 0, BASKET_PHYSICS.stepsPerShot * BASKET_PHYSICS.stepSeconds * 1_000)
    this.flightAt = performance.now()
  }

  clearShot() {
    this.activeShotKey = ''
    this.activeSimulation = null
    this.flightElapsedMs = 0
  }

  dispose = () => {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.frame)
    this.resizeObserver?.disconnect()
    window.removeEventListener('resize', this.resize)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored)
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach((material) => material.dispose())
    })
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }

  private scheduleFrame = () => {
    if (!this.disposed && !this.contextLost && !document.hidden) this.frame = requestAnimationFrame(this.renderFrame)
  }

  private onVisibilityChange = () => {
    cancelAnimationFrame(this.frame)
    this.scheduleFrame()
  }

  private onContextLost = (event: Event) => {
    event.preventDefault()
    this.contextLost = true
    cancelAnimationFrame(this.frame)
    this.options.onContextLost?.()
  }

  private onContextRestored = () => {
    this.contextLost = false
    this.resize()
    this.options.onContextRestored?.()
    this.scheduleFrame()
  }

  private buildCourt() {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.16, 22),
      new THREE.MeshStandardMaterial({ color: 0x263e43, roughness: 0.88 }),
    )
    floor.position.set(0, -0.08, -2.1)
    this.scene.add(floor)
    const paint = new THREE.MeshStandardMaterial({ color: 0xd58e50, roughness: 0.68, metalness: 0.02 })
    const stripe = (x: number, z: number, width: number, depth: number) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.018, depth), paint)
      line.position.set(x, 0.012, z)
      this.scene.add(line)
    }
    stripe(0, 3.2, 6.4, 0.035)
    stripe(-3.2, 0, 0.035, 6.4)
    stripe(3.2, 0, 0.035, 6.4)
    stripe(0, -3.2, 6.4, 0.035)
    const centerCircle = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.018, 4, 48), paint)
    centerCircle.rotation.x = Math.PI / 2
    centerCircle.position.set(0, 0.02, 0)
    this.scene.add(centerCircle)
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(10, 5, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x1b2a30, roughness: 0.9 }),
    )
    backWall.position.set(0, 2.4, -5.2)
    this.scene.add(backWall)
    for (let x = -4; x <= 4; x += 2) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.025, 4.2, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x32484d, roughness: 0.85 }),
      )
      panel.position.set(x, 2.35, -5.03)
      this.scene.add(panel)
    }
  }

  private buildHoop() {
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 1.35, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xe9f0e9, roughness: 0.48, metalness: 0.02 }),
    )
    board.position.set(0, 3.34, BASKET_PHYSICS.boardZ)
    this.hoop.add(board)
    const boardFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.58, 0.035),
      new THREE.MeshStandardMaterial({ color: 0xc85934, roughness: 0.55 }),
    )
    boardFrame.position.set(0, 3.02, BASKET_PHYSICS.boardZ + 0.055)
    this.hoop.add(boardFrame)
    const target = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.44, 0.035),
      new THREE.MeshStandardMaterial({ color: 0xe9f0e9, roughness: 0.5 }),
    )
    target.position.set(0, 3.02, BASKET_PHYSICS.boardZ + 0.082)
    this.hoop.add(target)

    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xff783e, roughness: 0.36, metalness: 0.22 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(BASKET_PHYSICS.rimRadius, BASKET_PHYSICS.rimTubeRadius, 8, 40), rimMaterial)
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, BASKET_PHYSICS.hoopY, BASKET_PHYSICS.hoopZ)
    this.hoopRing.add(ring)
    this.hoop.add(this.hoopRing, this.net)

    const netMaterial = new THREE.LineBasicMaterial({ color: 0xe5e2cf, transparent: true, opacity: 0.86 })
    const top: THREE.Vector3[] = []
    const bottom: THREE.Vector3[] = []
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI * 2 / 10
      top.push(new THREE.Vector3(Math.cos(angle) * 0.54, 2.34, BASKET_PHYSICS.hoopZ + Math.sin(angle) * 0.54))
      bottom.push(new THREE.Vector3(Math.cos(angle) * 0.32, 1.86, BASKET_PHYSICS.hoopZ + Math.sin(angle) * 0.32))
    }
    for (let i = 0; i < top.length; i++) {
      const next = (i + 1) % top.length
      this.net.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([top[i], bottom[i], bottom[next], top[next]]),
        netMaterial,
      ))
    }
    const baseNet = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(bottom), netMaterial)
    this.net.add(baseNet)

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.08, 3.2, 10),
      new THREE.MeshStandardMaterial({ color: 0x50636a, roughness: 0.55, metalness: 0.25 }),
    )
    pole.position.set(0, 1.62, -4.43)
    this.hoop.add(pole)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.16, 0.72),
      new THREE.MeshStandardMaterial({ color: 0x34474c, roughness: 0.75 }),
    )
    base.position.set(0, 0.04, -4.25)
    this.hoop.add(base)
  }

  private createBall() {
    const material = new THREE.MeshStandardMaterial({ color: 0xed6b2e, roughness: 0.74 })
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(BASKET_PHYSICS.ballRadius, 24, 18), material)
    sphere.castShadow = true
    const seamMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2420, roughness: 0.88 })
    for (let axis = 0; axis < 3; axis++) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(BASKET_PHYSICS.ballRadius * 0.99, 0.006, 4, 32), seamMaterial)
      if (axis === 0) seam.rotation.y = Math.PI / 2
      if (axis === 1) seam.rotation.x = Math.PI / 2
      this.ball.add(seam)
    }
    this.ball.add(sphere)
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 20),
      new THREE.MeshBasicMaterial({ color: 0x081015, transparent: true, opacity: 0.24, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(0, 0.018, 4.5)
    this.scene.add(shadow)
    this.ball.position.set(0, 0.65, 4.5)
    return shadow
  }

  private resize = () => {
    if (this.disposed) return
    const width = Math.max(1, this.canvas.clientWidth)
    const height = Math.max(1, this.canvas.clientHeight)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private renderFrame = () => {
    if (this.disposed || this.contextLost || document.hidden) return
    const now = performance.now()
    const hoopX = hoopXAt(this.elapsedMs + Math.max(0, now - this.elapsedAt))
    const shadowMaterial = this.ballShadow.material as THREE.MeshBasicMaterial
    this.hoop.position.x = hoopX
    if (this.activeSimulation) {
      const flightElapsed = this.flightElapsedMs + Math.max(0, now - this.flightAt)
      const scoredAt = this.activeSimulation.scoredAtMs
      if (!this.scoreFeedbackPlayed && scoredAt !== null && flightElapsed >= scoredAt) {
        this.scoreFeedbackPlayed = true
        if (flightElapsed - scoredAt < 450 && !this.reducedMotion?.matches) {
          this.feedbackUntil = now + 450 - (flightElapsed - scoredAt)
        }
      }
      const pointIndex = clamp(flightElapsed / 10, 0, this.activeSimulation.trajectory.length - 1)
      const firstIndex = Math.floor(pointIndex)
      const mix = pointIndex - firstIndex
      const first = this.activeSimulation.trajectory[firstIndex]
      const second = this.activeSimulation.trajectory[Math.min(firstIndex + 1, this.activeSimulation.trajectory.length - 1)]
      this.ball.position.set(
        first.x + (second.x - first.x) * mix,
        first.y + (second.y - first.y) * mix,
        first.z + (second.z - first.z) * mix,
      )
      this.ball.rotation.x += 0.018
      this.ball.rotation.z += 0.024
      this.ballShadow.position.x = this.ball.position.x
      this.ballShadow.position.z = this.ball.position.z
      shadowMaterial.opacity = clamp(0.24 - this.ball.position.y * 0.035, 0.04, 0.2)
      const scale = clamp(1.08 - this.ball.position.y * 0.045, 0.56, 1)
      this.ballShadow.scale.setScalar(scale)
    } else {
      this.ball.position.set(0, 0.65, 4.5)
      this.ball.rotation.set(0, 0, 0)
      this.ballShadow.position.set(0, 0.018, 4.5)
      this.ballShadow.scale.setScalar(1)
      shadowMaterial.opacity = 0.2
    }
    if (this.feedbackUntil > now && !this.reducedMotion?.matches) {
      const progress = 1 - (this.feedbackUntil - now) / 450
      this.net.rotation.z = Math.sin(progress * Math.PI * 2) * 0.12 * (1 - progress)
    } else {
      this.net.rotation.z = this.reducedMotion?.matches ? 0 : this.net.rotation.z * 0.82
    }
    this.renderer.render(this.scene, this.camera)
    this.scheduleFrame()
  }
}
