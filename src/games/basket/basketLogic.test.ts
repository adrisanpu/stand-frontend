import { describe, expect, it } from 'vitest'
import {
  BASKET_PHYSICS,
  DEFAULT_BASKET_CONFIG,
  basketShotFromGesture,
  hoopXAt,
  isBasketShot,
  replayBasketShots,
  simulateBasketShot,
  simulateBasketShotDetailed,
  validateBasketShots,
} from './basketLogic'
import type { BasketShot } from './basketLogic'

describe('BASKET v1 replay contract', () => {
  it('uses the frozen duration, flight, cooldown and corrected collision geometry', () => {
    expect(DEFAULT_BASKET_CONFIG).toEqual({
      configVersion: '1', durationMs: 30_000, flightMs: 2_000, cooldownMs: 2_200,
    })
    expect(BASKET_PHYSICS.scoringClearance).toBe(0.38)
    expect(BASKET_PHYSICS.boardZ).toBe(-3.9)
    expect(BASKET_PHYSICS.boardFrontCollisionZ).toBe(-3.74)
    expect(hoopXAt(0)).toBe(0)
    expect(hoopXAt(1_250)).toBe(2)
    expect(hoopXAt(2_500)).toBe(0)
    expect(hoopXAt(3_750)).toBe(-2)
    expect(hoopXAt(5_000)).toBe(0)
  })

  it('replays the approved reachable shot with the expected crossing time', () => {
    const shot: BasketShot = { atMs: 0, vx: 1_600, vy: 7_800, vz: -7_700 }
    const simulation = simulateBasketShotDetailed(shot)
    expect(simulation.scored).toBe(true)
    expect(simulation.scoredAtMs).toBeCloseTo(1_011.6894977168953, 9)
    expect(simulation.trajectory).toHaveLength(201)
    expect(simulateBasketShot(shot)).toBe(true)
    expect(replayBasketShots([shot])).toEqual({ score: 1, technicalEndMs: 30_000 })
  })

  it('validates quantized shot values, count, launch window and spacing', () => {
    const valid: BasketShot = { atMs: 29_999, vx: -5_000, vy: 10_000, vz: -11_000 }
    expect(isBasketShot(valid)).toBe(true)
    expect(isBasketShot({ ...valid, atMs: 30_000 })).toBe(false)
    expect(isBasketShot({ ...valid, vx: 5_001 })).toBe(false)
    expect(isBasketShot({ ...valid, vz: -4_999 })).toBe(false)
    expect(isBasketShot({ ...valid, extra: 1 })).toBe(false)
    expect(validateBasketShots([{ ...valid, atMs: 0 }, { ...valid, atMs: 2_199 }])).toBe(false)
    expect(validateBasketShots([{ ...valid, atMs: 0 }, { ...valid, atMs: 2_200 }])).toBe(true)
    expect(validateBasketShots(Array.from({ length: 15 }, (_, i) => ({
      atMs: i * 2_200, vx: 0, vy: 7_800, vz: -7_700,
    })))).toBe(false)
    expect(() => replayBasketShots([{ ...valid, atMs: 30_000 }])).toThrow('Invalid BASKET shot sequence')
  })

  it('maps swipe velocity and direction consistently across viewports', () => {
    const phone = basketShotFromGesture({
      deltaX: 64, upwardPixels: 160, width: 320, height: 640, durationMs: 400, atMs: 0,
    })
    const largerPhone = basketShotFromGesture({
      deltaX: 80, upwardPixels: 200, width: 400, height: 800, durationMs: 400, atMs: 0,
    })
    expect(phone).toEqual(largerPhone)
    expect(phone?.vx).toBe(1_250)
    expect(phone?.vy).toBeGreaterThan(6_000)
    expect(phone?.vz).toBeLessThan(-5_000)
    expect(basketShotFromGesture({
      deltaX: 20, upwardPixels: -10, width: 320, height: 640, durationMs: 400, atMs: 0,
    })).toBeNull()
    expect(basketShotFromGesture({
      deltaX: 0, upwardPixels: 8, width: 320, height: 640, durationMs: 400, atMs: 0,
    })).toBeNull()
  })

  it('keeps the technical resolution window tied to the last released shot', () => {
    expect(replayBasketShots([])).toEqual({ score: 0, technicalEndMs: 30_000 })
    expect(replayBasketShots([{ atMs: 29_999, vx: 0, vy: 7_800, vz: -7_700 }]).technicalEndMs).toBe(31_999)
  })
})
