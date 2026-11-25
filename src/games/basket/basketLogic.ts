export type BasketConfig = {
  configVersion: '1'
  durationMs: 30_000
  flightMs: 2_000
  cooldownMs: 2_200
}

export const DEFAULT_BASKET_CONFIG: BasketConfig = Object.freeze({
  configVersion: '1',
  durationMs: 30_000,
  flightMs: 2_000,
  cooldownMs: 2_200,
})

export type BasketShot = {
  atMs: number
  vx: number
  vy: number
  vz: number
}
export type BasketGestureSample = {
  deltaX: number
  upwardPixels: number
  width: number
  height: number
  durationMs: number
  atMs: number
}

export type BasketPosition = { x: number; y: number; z: number }
export type BasketShotSimulation = {
  scored: boolean
  scoredAtMs: number | null
  trajectory: BasketPosition[]
}

export const BASKET_PHYSICS = Object.freeze({
  stepSeconds: 0.01,
  stepsPerShot: 200,
  gravity: 12,
  ballRadius: 0.16,
  rimRadius: 0.6,
  rimTubeRadius: 0.06,
  scoringClearance: 0.38,
  hoopY: 2.4,
  hoopZ: -3,
  hoopSpeed: 1.6,
  hoopMinX: -2,
  hoopMaxX: 2,
  boardZ: -3.9,
  boardFrontCollisionZ: -3.74,
})

const SHOT_KEYS = ['atMs', 'vx', 'vy', 'vz'] as const
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function isBasketShot(value: unknown): value is BasketShot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== SHOT_KEYS.length || SHOT_KEYS.some(key => !(key in record))) return false
  return Number.isSafeInteger(record.atMs) && (record.atMs as number) >= 0 && (record.atMs as number) < 30_000
    && Number.isSafeInteger(record.vx) && (record.vx as number) >= -5_000 && (record.vx as number) <= 5_000
    && Number.isSafeInteger(record.vy) && (record.vy as number) >= 6_000 && (record.vy as number) <= 10_000
    && Number.isSafeInteger(record.vz) && (record.vz as number) >= -11_000 && (record.vz as number) <= -5_000
}

export function validateBasketShots(shots: readonly unknown[]): shots is readonly BasketShot[] {
  if (!Array.isArray(shots) || shots.length > 14) return false
  let previousAtMs = -Infinity
  for (const shot of shots) {
    if (!isBasketShot(shot) || shot.atMs < previousAtMs + DEFAULT_BASKET_CONFIG.cooldownMs) return false
    previousAtMs = shot.atMs
  }
  return true
}

export function hoopXAt(elapsedMs: number): number {
  const phase = ((elapsedMs / 1_000 * BASKET_PHYSICS.hoopSpeed + 2) % 8 + 8) % 8
  return phase <= 4 ? phase - 2 : 6 - phase
}

export function basketShotFromGesture(gesture: BasketGestureSample): BasketShot | null {
  const { deltaX, upwardPixels, width, height, durationMs, atMs } = gesture
  if (![deltaX, upwardPixels, width, height, durationMs, atMs].every(Number.isFinite)
    || width <= 0 || height <= 0 || !Number.isInteger(atMs) || atMs < 0 || atMs >= 30_000
    || durationMs < 80 || durationMs > 1_500 || upwardPixels <= 0) return null
  const normalizedX = deltaX / width
  const normalizedUp = upwardPixels / height
  const distance = Math.hypot(normalizedX, normalizedUp)
  if (normalizedUp < 0.07 || distance < 0.08) return null
  const seconds = durationMs / 1_000
  const horizontalSpeed = normalizedX / seconds
  const upwardSpeed = normalizedUp / seconds
  const force = clamp((upwardSpeed - 0.2) / 1.05, 0, 1)
  const shot = {
    atMs,
    vx: Math.round(clamp(horizontalSpeed * 2.5, -5, 5) * 1_000),
    vy: Math.round((6 + force * 4) * 1_000),
    vz: -Math.round((5 + force * 6) * 1_000),
  }
  return isBasketShot(shot) ? shot : null
}

export function simulateBasketShotDetailed(shot: BasketShot): BasketShotSimulation {
  if (!isBasketShot(shot)) throw new RangeError('Invalid BASKET shot')
  const p = { x: 0, y: 0.65, z: 4.5 }
  const v = { x: shot.vx / 1_000, y: shot.vy / 1_000, z: shot.vz / 1_000 }
  const trajectory: BasketPosition[] = [{ ...p }]
  let scoredAtMs: number | null = null
  const dt = BASKET_PHYSICS.stepSeconds

  for (let step = 1; step <= BASKET_PHYSICS.stepsPerShot; step++) {
    const old = p
    const next = {
      x: old.x + v.x * dt,
      y: old.y + v.y * dt - 0.5 * BASKET_PHYSICS.gravity * dt * dt,
      z: old.z + v.z * dt,
    }

    v.y -= BASKET_PHYSICS.gravity * dt
    const stepAtMs = shot.atMs + step * dt * 1_000
    const hoopX = hoopXAt(stepAtMs)

    if (scoredAtMs === null && old.y > BASKET_PHYSICS.hoopY && next.y <= BASKET_PHYSICS.hoopY) {
      const fraction = (old.y - BASKET_PHYSICS.hoopY) / (old.y - next.y)
      const crossingAtMs = shot.atMs + (step - 1 + fraction) * dt * 1_000
      const crossingX = old.x + fraction * (next.x - old.x)
      const crossingZ = old.z + fraction * (next.z - old.z)
      const radialX = crossingX - hoopXAt(crossingAtMs)
      const radialZ = crossingZ - BASKET_PHYSICS.hoopZ
      if (radialX * radialX + radialZ * radialZ < BASKET_PHYSICS.scoringClearance ** 2) {
        scoredAtMs = crossingAtMs - shot.atMs
      }
    }

    if (old.z >= BASKET_PHYSICS.boardFrontCollisionZ && next.z < BASKET_PHYSICS.boardFrontCollisionZ
      && Math.abs(next.x - hoopX) <= 1.2 && next.y >= BASKET_PHYSICS.hoopY && next.y <= 4.5) {
      next.z = BASKET_PHYSICS.boardFrontCollisionZ
      v.z = Math.abs(v.z) * 0.55
    }

    const dx = next.x - hoopX
    const dz = next.z - BASKET_PHYSICS.hoopZ
    const radial = Math.sqrt(dx * dx + dz * dz)
    if (radial !== 0) {
      const nearestX = hoopX + BASKET_PHYSICS.rimRadius * dx / radial
      const nearestZ = BASKET_PHYSICS.hoopZ + BASKET_PHYSICS.rimRadius * dz / radial
      const normalX = next.x - nearestX
      const normalY = next.y - BASKET_PHYSICS.hoopY
      const normalZ = next.z - nearestZ
      const length = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ)
      if (length < 0.22 && length > 1e-9) {
        const nx = normalX / length
        const ny = normalY / length
        const nz = normalZ / length
        next.x = nearestX + nx * 0.22
        next.y = BASKET_PHYSICS.hoopY + ny * 0.22
        next.z = nearestZ + nz * 0.22
        const dot = v.x * nx + v.y * ny + v.z * nz
        if (dot < 0) {
          v.x -= 1.6 * dot * nx
          v.y -= 1.6 * dot * ny
          v.z -= 1.6 * dot * nz
        }
      }
    }

    if (next.y < BASKET_PHYSICS.ballRadius) {
      next.y = BASKET_PHYSICS.ballRadius
      v.y = Math.abs(v.y) * 0.45
      v.x *= 0.8
      v.z *= 0.8
    }

    p.x = next.x
    p.y = next.y
    p.z = next.z
    trajectory.push({ ...p })
  }

  return { scored: scoredAtMs !== null, scoredAtMs, trajectory }
}

export function simulateBasketShot(shot: BasketShot): boolean {
  return simulateBasketShotDetailed(shot).scored
}

export function replayBasketShots(shots: readonly BasketShot[]): { score: number; technicalEndMs: number } {
  if (!validateBasketShots(shots)) throw new RangeError('Invalid BASKET shot sequence')
  const score = shots.reduce((total, shot) => total + Number(simulateBasketShot(shot)), 0)
  const lastShotAtMs = shots.length ? shots[shots.length - 1].atMs : undefined
  return {
    score,
    technicalEndMs: lastShotAtMs === undefined
      ? DEFAULT_BASKET_CONFIG.durationMs
      : Math.max(DEFAULT_BASKET_CONFIG.durationMs, lastShotAtMs + DEFAULT_BASKET_CONFIG.flightMs),
  }
}
