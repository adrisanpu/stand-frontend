export const TAU = Math.PI * 2
export const SPIN_DURATION = 3000

export function targetWheelAngle(index: number, count: number, reducedMotion = false): number {
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new Error('Invalid roulette segment')
  }
  return (reducedMotion ? 0 : 5 * TAU) - (index + 0.5) * TAU / count
}

export function sampleWheelAngle(target: number, elapsed: number, reducedMotion = false): number {
  const progress = Math.max(0, Math.min(1, elapsed / SPIN_DURATION))
  // Reduced motion holds the wheel still until the final orientation is revealed.
  if (reducedMotion) return progress === 1 ? target : 0
  return target * (1 - (1 - progress) ** 4)
}
