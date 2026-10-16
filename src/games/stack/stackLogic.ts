export type StackState = 'IDLE' | 'PLAYING' | 'PLACING' | 'GAME_OVER'

export type StackPlacement = { axis: 'x' | 'z'; offset: number; perfect: boolean }
export type StackSnapshot = {
  state: StackState
  score: number
  perfect: boolean
  placements: readonly StackPlacement[]
}

export type StackRectangle = { x: number; z: number; width: number; depth: number }
export type StackLayer = StackRectangle & { y: number }
export type StackCut = {
  placement: StackPlacement
  retained: StackRectangle | null
  fragments: StackRectangle[]
}

export const STACK_PLACING_SECONDS = 0.22

export type StackConfig = {
  configVersion: '1'
  initialSpeed: number
  speedIncrement: number
  maxSpeed: number
  perfectTolerance: number
  initialWidth: number
  initialDepth: number
  layerHeight: number
  movementRange: number
}

export const DEFAULT_STACK_CONFIG: StackConfig = {
  configVersion: '1',
  initialSpeed: 2,
  speedIncrement: 0.08,
  maxSpeed: 5,
  perfectTolerance: 0.06,
  initialWidth: 3,
  initialDepth: 2,
  layerHeight: 0.24,
  movementRange: 4,
}

export function isStackConfig(value: unknown): value is StackConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Record<string, unknown>
  const positiveFields = ['initialSpeed', 'maxSpeed', 'initialWidth', 'initialDepth', 'layerHeight', 'movementRange']
  if (config.configVersion !== '1') return false
  if (!positiveFields.every((key) => typeof config[key] === 'number' && Number.isFinite(config[key]) && config[key] > 0)) {
    return false
  }
  return (
    typeof config.speedIncrement === 'number' && Number.isFinite(config.speedIncrement) && config.speedIncrement >= 0 &&
    typeof config.perfectTolerance === 'number' && Number.isFinite(config.perfectTolerance) && config.perfectTolerance >= 0 &&
    typeof config.maxSpeed === 'number' && typeof config.initialSpeed === 'number' && config.maxSpeed >= config.initialSpeed &&
    typeof config.initialWidth === 'number' && typeof config.initialDepth === 'number' &&
    config.perfectTolerance < Math.min(config.initialWidth, config.initialDepth) / 2
  )
}

/** Rectangle centres and dimensions stay in world units; never round gameplay geometry. */
export function intersectStackRectangles(a: StackRectangle, b: StackRectangle): StackRectangle | null {
  const left = Math.max(a.x - a.width / 2, b.x - b.width / 2)
  const right = Math.min(a.x + a.width / 2, b.x + b.width / 2)
  const back = Math.max(a.z - a.depth / 2, b.z - b.depth / 2)
  const front = Math.min(a.z + a.depth / 2, b.z + b.depth / 2)
  if (right <= left || front <= back) return null
  return { x: left + (right - left) / 2, z: back + (front - back) / 2, width: right - left, depth: front - back }
}

export function cutStackLayer(
  moving: StackRectangle,
  support: StackRectangle,
  axis: StackPlacement['axis'],
  tolerance: number,
): StackCut {
  const offset = moving[axis] - support[axis]
  const overlap = intersectStackRectangles(moving, support)
  const other = axis === 'x' ? 'z' : 'x'
  const perfect = overlap !== null && Math.abs(offset) <= tolerance &&
    moving[other] === support[other] && moving.width === support.width && moving.depth === support.depth
  const placement = { axis, offset, perfect }
  if (!overlap) return { placement, retained: null, fragments: [{ ...moving }] }
  if (perfect) return { placement, retained: { ...support }, fragments: [] }

  const fragments: StackRectangle[] = []
  const left = moving.x - moving.width / 2
  const right = moving.x + moving.width / 2
  const back = moving.z - moving.depth / 2
  const front = moving.z + moving.depth / 2
  const ol = overlap.x - overlap.width / 2
  const or = overlap.x + overlap.width / 2
  const ob = overlap.z - overlap.depth / 2
  const of = overlap.z + overlap.depth / 2
  if (ol > left) fragments.push({ x: left + (ol - left) / 2, z: moving.z, width: ol - left, depth: moving.depth })
  if (or < right) fragments.push({ x: or + (right - or) / 2, z: moving.z, width: right - or, depth: moving.depth })
  if (ob > back) fragments.push({ x: overlap.x, z: back + (ob - back) / 2, width: overlap.width, depth: ob - back })
  if (of < front) fragments.push({ x: overlap.x, z: of + (front - of) / 2, width: overlap.width, depth: front - of })
  return { placement, retained: overlap, fragments }
}

/** Reflect the entire travelled distance, including multiple boundary crossings. */
export function advanceStackMotion(position: number, direction: 1 | -1, speed: number, deltaTime: number, range: number) {
  const period = 4 * range
  const phase = direction === 1 ? position + range : 3 * range - position
  const travelled = (phase + speed * deltaTime) % period
  return travelled < 2 * range
    ? { position: travelled - range, direction: 1 as const }
    : { position: 3 * range - travelled, direction: -1 as const }
}

export function stackSpeed(config: StackConfig, score: number): number {
  return Math.min(config.maxSpeed, config.initialSpeed + score * config.speedIncrement)
}

/** Frame-rate independent exponential damping for the fixed-angle camera. */
export function followStackHeight(current: number, target: number, deltaTime: number): number {
  return current + (target - current) * -Math.expm1(-5 * deltaTime)
}

export class StackEngine {
  private rules: StackConfig
  private phase: StackState = 'IDLE'
  private points = 0
  private lastPerfect = false
  private history: StackPlacement[] = []
  private direction: 1 | -1 = 1
  private offset = 0
  private placingTime = 0
  private paused = false
  private support: StackLayer
  private active: StackLayer | null = null

  constructor(config: StackConfig) {
    if (!isStackConfig(config)) throw new Error('Configuración STACK inválida.')
    this.rules = { ...config }
    this.support = this.base()
  }

  private base(): StackLayer {
    return { x: 0, z: 0, y: 0, width: this.rules.initialWidth, depth: this.rules.initialDepth }
  }

  get config(): Readonly<StackConfig> { return this.rules }
  get state(): StackState { return this.phase }
  get score(): number { return this.points }
  get top(): Readonly<StackLayer> { return this.support }
  get moving(): Readonly<StackLayer> | null { return this.active }
  get axis(): StackPlacement['axis'] { return this.points % 2 === 0 ? 'x' : 'z' }
  get snapshot(): StackSnapshot {
    return Object.freeze({
      state: this.phase,
      score: this.points,
      perfect: this.lastPerfect,
      placements: Object.freeze(this.history.map((placement) => Object.freeze({ ...placement }))),
    })
  }

  start(config: StackConfig = this.rules): boolean {
    if (this.phase !== 'IDLE') return false
    if (!isStackConfig(config)) throw new Error('Configuración STACK inválida.')
    this.rules = { ...config }
    this.support = this.base()
    this.spawn()
    return true
  }

  setPaused(paused: boolean): void { this.paused = paused }

  private spawn(): void {
    this.phase = 'PLAYING'
    this.lastPerfect = false
    this.offset = -this.rules.movementRange
    this.direction = 1
    this.active = { ...this.support, y: this.support.y + this.rules.layerHeight }
    this.active[this.axis] += this.offset
  }

  update(deltaTime: number): boolean {
    if (this.paused || !Number.isFinite(deltaTime) || deltaTime <= 0) return false
    let spawned = false
    if (this.phase === 'PLACING') {
      const consumed = Math.min(this.placingTime, deltaTime)
      this.placingTime -= consumed
      deltaTime -= consumed
      if (this.placingTime > 1e-12) return false
      this.spawn()
      spawned = true
    }
    if (this.phase === 'PLAYING' && this.active) {
      const motion = advanceStackMotion(this.offset, this.direction, stackSpeed(this.rules, this.points), deltaTime, this.rules.movementRange)
      this.offset = motion.position
      this.direction = motion.direction
      this.active[this.axis] = this.support[this.axis] + this.offset
    }
    return spawned
  }

  place(): (StackCut & { y: number }) | null {
    if (this.phase !== 'PLAYING' || this.paused || !this.active) return null
    const cut = cutStackLayer(this.active, this.support, this.axis, this.rules.perfectTolerance)
    const y = this.active.y
    this.history.push(cut.placement)
    this.lastPerfect = cut.placement.perfect
    this.active = null
    if (cut.retained) {
      this.support = { ...cut.retained, y }
      this.points += 1
      this.phase = 'PLACING'
      this.placingTime = STACK_PLACING_SECONDS
    } else {
      this.phase = 'GAME_OVER'
    }
    return { ...cut, y }
  }
}
