import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicApi } from './publicApi'
import { DEFAULT_STACK_CONFIG } from '../games/stack/stackLogic'

describe('publicApi STACK start contract', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('reuses the public score endpoint with explicit start and attempt identifier', async () => {
    const result = {
      ok: true, gameId: 'GAME1234', playerId: 1, attemptId: 'request-1', status: 'started', configVersion: '1',
      startedAt: '2026-10-16T10:00:00Z', configSnapshot: DEFAULT_STACK_CONFIG,
    }
    const request = vi.fn().mockResolvedValue({
      ok: true, json: async () => result,
    })
    vi.stubGlobal('fetch', request)
    expect(await publicApi.startStackAttempt({
      gameId: 'GAME1234', playerToken: 'token', attemptId: 'request-1',
    })).toEqual(result)
    expect(request).toHaveBeenCalledWith(expect.stringContaining('/v1/public/score'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ gameId: 'GAME1234', playerToken: 'token', attemptId: 'request-1', action: 'start' }),
    }))
  })

  it('surfaces backend rejection rather than returning a success-shaped response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 409, json: async () => ({ message: 'Intento ya consumido' }),
    }))
    await expect(publicApi.startStackAttempt({
      gameId: 'GAME1234', playerToken: 'token', attemptId: 'request-2',
    })).rejects.toThrow('Intento ya consumido')
  })

  it('submits finish evidence through the same endpoint without a client-claimed score', async () => {
    const result = {
      ok: true, gameId: 'GAME1234', playerId: 1, attemptId: 'request-1', status: 'finished', configVersion: '1',
      score: 0, scoreUpdatedAt: '2026-10-16T10:01:00Z', rank: 1,
    }
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => result })
    vi.stubGlobal('fetch', request)
    const body = {
      gameId: 'GAME1234', playerToken: 'token', attemptId: 'request-1',
      placements: [{ axis: 'x' as const, offset: -4, perfect: false }],
    }
    expect(await publicApi.finishStackAttempt(body)).toEqual(result)
    expect(request).toHaveBeenCalledWith(expect.stringContaining('/v1/public/score'), expect.objectContaining({
      method: 'POST', body: JSON.stringify({ ...body, action: 'finish' }),
    }))
  })
})
