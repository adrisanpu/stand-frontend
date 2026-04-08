import type { GameDefinition } from '../types'
import type { FeatureFlags } from '../../auth/featureFlags'

/** Juegos con flujo de validación que pueden mostrar premio/límite de validación */
export const VALIDATION_PRIZE_GAME_IDS = ['empareja2', 'cupido', 'semaforo', 'l3tras'] as const

export type OperatorPrizeSlotVisibility = {
  validation: boolean
  ranking: boolean
  raffle: boolean
}

export function getOperatorPrizeSlotVisibility(
  gameDefinition: GameDefinition,
  features: Pick<FeatureFlags, 'raffles'>
): OperatorPrizeSlotVisibility {
  const id = gameDefinition.id
  return {
    validation: (VALIDATION_PRIZE_GAME_IDS as readonly string[]).includes(id),
    ranking: Boolean(gameDefinition.showRanking),
    raffle: features.raffles === true,
  }
}

function readNonNegInt(v: unknown): number | undefined {
  if (typeof v === 'number' && v >= 0 && Number.isFinite(v)) return Math.floor(v)
  return undefined
}

/** maxPrizeValidation con fallback a maxValidations (migración) */
export function readMaxPrizeValidation(gs: Record<string, unknown> | null | undefined): number | undefined {
  if (!gs) return undefined
  const a = readNonNegInt(gs.maxPrizeValidation)
  if (a !== undefined) return a
  return readNonNegInt(gs.maxValidations)
}

export function readMaxPrizeRanking(gs: Record<string, unknown> | null | undefined): number | undefined {
  if (!gs) return undefined
  return readNonNegInt(gs.maxPrizeRanking)
}

export function readMaxPrizeRaffle(gs: Record<string, unknown> | null | undefined): number | undefined {
  if (!gs) return undefined
  return readNonNegInt(gs.maxPrizeRaffle)
}
