import { beforeEach, describe, expect, it } from 'vitest'
import { clearPendingStackResult, loadPendingStackResult, savePendingStackResult, type PendingStackResult } from './stackResultStorage'

const pending: PendingStackResult = {
  playerId: 1, attemptId: 'attempt-1',
  placements: [{ axis: 'x', offset: 4, perfect: false }],
}

describe('STACK pending result recovery', () => {
  beforeEach(() => sessionStorage.clear())

  it('retains only final evidence in the existing session storage and clears after confirmation', () => {
    savePendingStackResult('GAME1', pending)
    expect(loadPendingStackResult('GAME1', 1, 'attempt-1')).toEqual(pending)
    clearPendingStackResult('GAME1')
    expect(loadPendingStackResult('GAME1', 1, 'attempt-1')).toBeNull()
  })

  it('isolates games, players and attempts without treating stale data as new gameplay', () => {
    savePendingStackResult('GAME1', pending)
    expect(loadPendingStackResult('GAME2', 1, 'attempt-1')).toBeNull()
    expect(loadPendingStackResult('GAME1', 2, 'attempt-1')).toBeNull()
    expect(loadPendingStackResult('GAME1', 1, 'attempt-2')).toBeNull()
  })

  it.each([
    'invalid JSON',
    JSON.stringify({ playerId: 1, attemptId: 'attempt-1', placements: [] }),
    JSON.stringify({ playerId: 1, attemptId: 'attempt-1', placements: [{ axis: 'y', offset: 4, perfect: false }] }),
    JSON.stringify({ playerId: 1, attemptId: 'attempt-1', placements: [{ axis: 'x', offset: null, perfect: false }] }),
  ])('surfaces corrupt pending data instead of manufacturing a score (%s)', (raw) => {
    sessionStorage.setItem('stand_stack_pending_result_GAME1', raw)
    expect(() => loadPendingStackResult('GAME1', 1, 'attempt-1')).toThrow()
  })
})
