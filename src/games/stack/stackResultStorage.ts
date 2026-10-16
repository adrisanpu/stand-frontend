import type { StackPlacement } from './stackLogic'

export type PendingStackResult = {
  playerId: number
  attemptId: string
  placements: readonly StackPlacement[]
}

function key(gameId: string): string {
  return `stand_stack_pending_result_${gameId}`
}

export function savePendingStackResult(gameId: string, result: PendingStackResult): void {
  sessionStorage.setItem(key(gameId), JSON.stringify(result))
}

export function loadPendingStackResult(gameId: string, playerId: number, attemptId: string): PendingStackResult | null {
  const raw = sessionStorage.getItem(key(gameId))
  if (!raw) return null
  const result: unknown = JSON.parse(raw)
  if (!result || typeof result !== 'object') throw new Error('El resultado pendiente de STACK no es válido.')
  const record = result as Record<string, unknown>
  if (record.playerId !== playerId || record.attemptId !== attemptId) return null
  if (!Array.isArray(record.placements) || record.placements.length === 0) {
    throw new Error('El resultado pendiente de STACK no contiene colocaciones.')
  }
  const placements: StackPlacement[] = record.placements.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('El resultado pendiente de STACK no es válido.')
    const placement = value as Record<string, unknown>
    if (
      (placement.axis !== 'x' && placement.axis !== 'z') ||
      typeof placement.offset !== 'number' || !Number.isFinite(placement.offset) ||
      typeof placement.perfect !== 'boolean'
    ) {
      throw new Error('El resultado pendiente de STACK contiene una colocación inválida.')
    }
    return { axis: placement.axis, offset: placement.offset, perfect: placement.perfect }
  })
  return { playerId, attemptId, placements }
}

export function clearPendingStackResult(gameId: string): void {
  sessionStorage.removeItem(key(gameId))
}
