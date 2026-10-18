import { describe, expect, it } from 'vitest'
import { sampleWheelAngle, SPIN_DURATION, targetWheelAngle, TAU } from './rulet4WheelMotion'

describe('roulette wheel motion', () => {
  it.each([1, 2, 9, 37, 128])('aligns every segment centre to the top for %i segments', (count) => {
    for (let index = 0; index < count; index++) {
      for (const reduced of [false, true]) {
        const centre = (index + 0.5) * TAU / count
        const angle = targetWheelAngle(index, count, reduced)
        expect(Math.sin(centre + angle)).toBeCloseTo(0, 10)
        expect(Math.cos(centre + angle)).toBeCloseTo(1, 10)
      }
    }
  })

  it('decelerates monotonically and finishes at exactly three seconds', () => {
    const target = targetWheelAngle(2, 9)
    expect(sampleWheelAngle(target, -1)).toBe(0)
    let previous = 0
    let previousStep = Infinity
    for (let elapsed = 100; elapsed <= SPIN_DURATION; elapsed += 100) {
      const angle = sampleWheelAngle(target, elapsed)
      expect(angle).toBeGreaterThanOrEqual(previous)
      expect(angle - previous).toBeLessThanOrEqual(previousStep)
      previousStep = angle - previous
      previous = angle
    }
    expect(previous).toBe(target)
    expect(sampleWheelAngle(target, SPIN_DURATION + 100)).toBe(target)
  })

  it('does not spin or bounce with reduced motion', () => {
    const target = targetWheelAngle(0, 9, true)
    expect(sampleWheelAngle(target, SPIN_DURATION - 1, true)).toBe(0)
    expect(sampleWheelAngle(target, SPIN_DURATION, true)).toBe(target)
  })

  it('rejects invalid segment indices and counts', () => {
    expect(() => targetWheelAngle(0, 0)).toThrow()
    expect(() => targetWheelAngle(-1, 9)).toThrow()
    expect(() => targetWheelAngle(9, 9)).toThrow()
    expect(() => targetWheelAngle(0.5, 9)).toThrow()
  })
})
