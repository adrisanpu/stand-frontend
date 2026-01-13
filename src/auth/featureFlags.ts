/**
 * Feature flags based on user plan
 */

export type Plan = 'free' | 'event' | 'enterprise'

export interface FeatureFlags {
  maxGames: number
  maxPlayers: number
  raffles: boolean
  playerForms: boolean
  exportResults: boolean
  advancedCustomization: boolean
}

const FEATURE_MAP: Record<Plan, FeatureFlags> = {
  free: {
    maxGames: 1,
    maxPlayers: 25,
    raffles: false,
    playerForms: false,
    exportResults: false,
    advancedCustomization: false,
  },
  event: {
    maxGames: Infinity,
    maxPlayers: Infinity,
    raffles: true,
    playerForms: true,
    exportResults: true,
    advancedCustomization: true,
  },
  enterprise: {
    maxGames: Infinity,
    maxPlayers: Infinity,
    raffles: true,
    playerForms: true,
    exportResults: true,
    advancedCustomization: true,
  },
}

/**
 * Get feature flags for a given plan
 */
export function getFeaturesByPlan(plan: Plan | null | undefined): FeatureFlags {
  if (!plan) {
    return FEATURE_MAP.free // Default to free plan
  }
  return FEATURE_MAP[plan] || FEATURE_MAP.free
}

/**
 * Check if a feature is available for the plan
 */
export function hasFeature(plan: Plan | null | undefined, feature: keyof FeatureFlags): boolean {
  const features = getFeaturesByPlan(plan)
  return features[feature] === true || (typeof features[feature] === 'number' && features[feature] > 0)
}

