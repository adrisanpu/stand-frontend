import { validateBasketShots } from './basketLogic'
import type { BasketShot } from './basketLogic'

export type BasketAttemptRecord = {
  schemaVersion: 1
  gameId: string
  playerId: number
  attemptId: string
  phase: 'pending' | 'started'
  startedAt?: string
  serverNow?: string
  expiresAt?: string
  configVersion: '1'
  shots: BasketShot[]
}

export type BasketStorageRead =
  | { kind: 'missing' }
  | { kind: 'unavailable' | 'invalid' }
  | { kind: 'ok'; record: BasketAttemptRecord }

export function basketAttemptStorageKey(gameId: string, playerId: number): string {
  return `stand:basket:v1:${gameId}:${playerId}`
}

export function readBasketAttemptRecord(key: string, gameId: string, playerId: number): BasketStorageRead {
  let stored: string | null
  try {
    stored = localStorage.getItem(key)
  } catch {
    return { kind: 'unavailable' }
  }
  if (stored === null) return { kind: 'missing' }
  try {
    const value = JSON.parse(stored) as Partial<BasketAttemptRecord>
    if (value.schemaVersion !== 1 || value.gameId !== gameId || value.playerId !== playerId
      || typeof value.attemptId !== 'string' || value.attemptId.length === 0
      || (value.phase !== 'pending' && value.phase !== 'started')
      || value.configVersion !== '1' || !Array.isArray(value.shots)
      || !validateBasketShots(value.shots)
      || (value.startedAt !== undefined && !Number.isFinite(Date.parse(value.startedAt)))
      || (value.serverNow !== undefined && !Number.isFinite(Date.parse(value.serverNow)))
      || (value.expiresAt !== undefined && !Number.isFinite(Date.parse(value.expiresAt)))) return { kind: 'invalid' }
    return { kind: 'ok', record: value as BasketAttemptRecord }
  } catch {
    return { kind: 'invalid' }
  }
}

export function persistBasketAttemptRecord(key: string, record: BasketAttemptRecord): boolean {
  try {
    if (!validateBasketShots(record.shots)) return false
    localStorage.setItem(key, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

export function clearBasketAttemptRecord(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
