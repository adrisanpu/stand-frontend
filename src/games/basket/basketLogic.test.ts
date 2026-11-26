import { describe, expect, it } from 'vitest'
import {
  BASKET_PHYSICS, DEFAULT_BASKET_CONFIG, basketShotFromGesture, hoopXAt,
  isBasketShot, replayBasketShots, simulateBasketShot, simulateBasketShotDetailed, validateBasketShots,
} from './basketLogic'
import type { BasketShot } from './basketLogic'

describe('BASKET v1 replay and direction-only controls', () => {
  it('keeps the existing timing, collision geometry and hoop movement', () => {
    expect(DEFAULT_BASKET_CONFIG).toEqual({
      configVersion: '1', durationMs: 30_000, flightMs: 2_000, cooldownMs: 2_200,
    })
    expect(BASKET_PHYSICS.scoringClearance).toBe(0.38)
    expect(BASKET_PHYSICS.boardZ).toBe(-3.9)
    expect(BASKET_PHYSICS.boardFrontCollisionZ).toBe(-3.74)
    expect([0, 1_250, 2_500, 3_750, 5_000].map(hoopXAt)).toEqual([0, 2, 0, -2, 0])
  })

  it('replays existing evidence without changing the physics', () => {
    const shot: BasketShot = { atMs: 0, vx: 1_600, vy: 7_800, vz: -7_700 }
    const simulation = simulateBasketShotDetailed(shot)
    expect(simulation.scored).toBe(true)
    expect(simulation.scoredAtMs).toBeCloseTo(1_011.6894977168953, 9)
    expect(simulation.trajectory).toHaveLength(201)
    expect(replayBasketShots([shot])).toEqual({ score: 1, technicalEndMs: 30_000 })
  })

  it('preserves quantized v1 ranges, launch window, shot count and cadence', () => {
    const shot: BasketShot = { atMs: 29_999, vx: -5_000, vy: 10_000, vz: -11_000 }
    expect(isBasketShot(shot)).toBe(true)
    for (const invalid of [{ atMs: 30_000 }, { vx: 5_001 }, { vz: -4_999 }, { extra: 1 }]) {
      expect(isBasketShot({ ...shot, ...invalid })).toBe(false)
    }
    expect(validateBasketShots([{ ...shot, atMs: 0 }, { ...shot, atMs: 2_199 }])).toBe(false)
    expect(validateBasketShots([{ ...shot, atMs: 0 }, { ...shot, atMs: 2_200 }])).toBe(true)
    expect(validateBasketShots(Array.from({ length: 15 }, (_, i) => ({ ...shot, atMs: i * 2_200 })))).toBe(false)
    expect(() => replayBasketShots([{ ...shot, atMs: 30_000 }])).toThrow('Invalid BASKET shot sequence')
    expect(replayBasketShots([])).toEqual({ score: 0, technicalEndMs: 30_000 })
    expect(replayBasketShots([shot]).technicalEndMs).toBe(31_999)
  })

  it('uses fixed forward and vertical power, regardless of swipe speed and distance', () => {
    const gesture = { deltaX: 20, upwardPixels: 100, width: 400, height: 200, durationMs: 500, atMs: 0 }
    const expected = { atMs: 0, vx: 600, vy: 7_800, vz: -7_413 }
    for (const durationMs of [20, 80, 500, 1_500, 5_000]) {
      expect(basketShotFromGesture({ ...gesture, durationMs })).toEqual(expected)
      expect(basketShotFromGesture({
        ...gesture, durationMs, deltaX: 40, upwardPixels: 200,
      })).toEqual(expected)
    }
    expect(basketShotFromGesture({ ...gesture, deltaX: -20 })).toEqual({ ...expected, vx: -600 })
  })

  it('keeps direction consistent across proportionally scaled viewports', () => {
    const gesture = { deltaX: 64, upwardPixels: 160, width: 320, height: 640, durationMs: 400, atMs: 0 }
    expect(basketShotFromGesture(gesture)).toEqual({ atMs: 0, vx: 1_200, vy: 7_800, vz: -7_413 })
    expect(basketShotFromGesture({
      ...gesture, deltaX: 80, upwardPixels: 200, width: 400, height: 800,
    })).toEqual(basketShotFromGesture(gesture))
  })

  it('rejects invalid gestures but not slow or fast deliberate swipes', () => {
    const gesture = { deltaX: 0, upwardPixels: 100, width: 400, height: 200, durationMs: 500, atMs: 0 }
    for (const invalid of [
      { upwardPixels: -10 }, { upwardPixels: 8 }, { durationMs: 0 }, { durationMs: NaN },
      { width: 0 }, { height: Infinity }, { atMs: -1 }, { atMs: 30_000 }, { atMs: 1.5 },
    ]) {
      expect(basketShotFromGesture({ ...gesture, ...invalid })).toBeNull()
    }
  })

  it('bounds lateral aim and keeps generated shots valid under v1', () => {
    const gesture = { deltaX: 0, upwardPixels: 100, width: 400, height: 200, durationMs: 500, atMs: 0 }
    for (const upwardPixels of [20, 50, 100, 200, 300]) {
      for (const deltaX of [-1_000, -100, 0, 100, 1_000]) {
        expect(isBasketShot(basketShotFromGesture({ ...gesture, upwardPixels, deltaX }))).toBe(true)
      }
    }
    expect(basketShotFromGesture({ ...gesture, deltaX: 1_000 })?.vx).toBe(3_000)
    expect(basketShotFromGesture({ ...gesture, deltaX: -1_000 })?.vx).toBe(-3_000)
  })

  it('does not auto-aim: the same direction scores or misses depending on hoop timing', () => {
    const gesture = { deltaX: 54, upwardPixels: 100, width: 400, height: 200, durationMs: 500, atMs: 0 }
    expect(simulateBasketShot(basketShotFromGesture(gesture)!)).toBe(true)
    expect(simulateBasketShot(basketShotFromGesture({ ...gesture, atMs: 2_500 })!)).toBe(false)
    expect(simulateBasketShot(basketShotFromGesture({ ...gesture, deltaX: -54 })!)).toBe(false)
  })

  it('reaches both hoop extremes with fixed power and an aimed gesture', () => {
    for (const target of [-2, 2]) {
      const gesture = { deltaX: 0, upwardPixels: 100, width: 400, height: 200, durationMs: 500, atMs: 0 }
      const vy = 7.8
      const crossingSeconds = (vy + Math.sqrt(vy * vy - 24 * 1.75)) / 12
      const atMs = Math.round((target > 0 ? 1_250 : 3_750) - crossingSeconds * 1_000)
      const shot = basketShotFromGesture({
        ...gesture, atMs, deltaX: (target / crossingSeconds) / 3 * gesture.upwardPixels,
      })!
      expect(Math.abs(shot.vx)).toBeLessThan(3_000)
      expect(simulateBasketShot(shot)).toBe(true)
    }
  })
})
