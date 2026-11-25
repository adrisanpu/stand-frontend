import { afterEach, describe, expect, it } from 'vitest'
import {
  basketAttemptStorageKey,
  clearBasketAttemptRecord,
  persistBasketAttemptRecord,
  readBasketAttemptRecord,
} from './basketAttemptStorage'

afterEach(() => localStorage.clear())

describe('BASKET attempt recovery storage', () => {
  const gameId = 'GAME1234'
  const playerId = 42
  const key = basketAttemptStorageKey(gameId, playerId)
  const record = {
    schemaVersion: 1 as const,
    gameId,
    playerId,
    attemptId: 'attempt-1',
    phase: 'started' as const,
    startedAt: '2026-11-25T10:00:00.000Z',
    serverNow: '2026-11-25T10:00:01.000Z',
    expiresAt: '2026-11-25T10:00:30.000Z',
    configVersion: '1' as const,
    shots: [{ atMs: 0, vx: 1600, vy: 7800, vz: -7700 }],
  }

  it('synchronously round-trips the attempt and shot evidence without storing a token', () => {
    expect(persistBasketAttemptRecord(key, record)).toBe(true)
    expect(readBasketAttemptRecord(key, gameId, playerId)).toEqual({ kind: 'ok', record })
    expect(localStorage.getItem(key)).not.toContain('playerToken')
  })

  it('distinguishes missing from corrupt evidence and never silently replaces it', () => {
    expect(readBasketAttemptRecord(key, gameId, playerId)).toEqual({ kind: 'missing' })
    localStorage.setItem(key, '{')
    expect(readBasketAttemptRecord(key, gameId, playerId)).toEqual({ kind: 'invalid' })
    expect(persistBasketAttemptRecord(key, { ...record, shots: [{ ...record.shots[0], atMs: 30_000 }] })).toBe(false)
  })

  it('removes evidence only when explicitly confirmed by the caller', () => {
    expect(persistBasketAttemptRecord(key, record)).toBe(true)
    expect(clearBasketAttemptRecord(key)).toBe(true)
    expect(readBasketAttemptRecord(key, gameId, playerId)).toEqual({ kind: 'missing' })
  })
})
