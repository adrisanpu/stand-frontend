/**
 * Plan gating helpers for feature flags
 */

export type Plan = 'free' | 'event' | 'enterprise'

/**
 * Check if user has free plan
 */
export function isFree(plan: Plan | null | undefined): boolean {
  return plan === 'free'
}

/**
 * Check if user has event plan (includes EVENT_24H)
 */
export function isEvent(plan: Plan | null | undefined): boolean {
  return plan === 'event'
}

/**
 * Check if user has enterprise plan
 */
export function isEnterprise(plan: Plan | null | undefined): boolean {
  return plan === 'enterprise'
}

