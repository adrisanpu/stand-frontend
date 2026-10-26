import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicApiError, publicApi } from './publicApi'
import { DEFAULT_STACK_CONFIG } from '../games/stack/stackLogic'
import { DEFAULT_RULET4_CONFIG } from '../games/rulet4/rulet4Logic'

describe('RULET4 spin contract', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const result = {
    panel: DEFAULT_RULET4_CONFIG.panels[2], index: 8, configSnapshot: DEFAULT_RULET4_CONFIG,
    spunAt: '2026-10-26T12:00:00Z',
  }

  it('sends only participant credentials, never a client-selected prize', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result })))
    vi.stubGlobal('fetch', request)
    expect(await publicApi.spinRulet4('ABC123', 'token')).toEqual(result)
    expect(request).toHaveBeenCalledWith(expect.stringContaining('/v1/public/rulet4/spin'), expect.objectContaining({
      method: 'POST', body: '{"gameId":"ABC123","playerToken":"token"}',
    }))
  })

  it.each([
    { ...result, index: -1 },
    { ...result, index: 9 },
    { ...result, panel: DEFAULT_RULET4_CONFIG.panels[0] },
    { ...result, configSnapshot: { panels: [] } },
    { ...result, spunAt: 'invalid' },
  ])('rejects invalid or mismatched server result %#', async (invalid) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, result: invalid }))))
    await expect(publicApi.spinRulet4('ABC123', 'token')).rejects.toThrow('Invalid RULET4 result')
  })
})

describe('Kivly registration errors', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('retains the safe error code and retry delay without exposing external messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'KivlyRateLimited', message: 'External response must not be displayed',
    }), { status: 429, headers: { 'Retry-After': '30' } })))
    await expect(publicApi.join({ gameId: 'GAME1234', challengeId: 'challenge', code: '123456' }))
      .rejects.toMatchObject({
        status: 429, code: 'KivlyRateLimited', retryAfter: 30,
        message: 'No se pudo confirmar tu registro en el club. Consulta al equipo del evento.',
      })
  })
})

describe('Kivly completion reward contract', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('uses the player token and retains the server-provided Wallet URLs', async () => {
    const reward = { status: 'confirmed', name: 'Coffee', appleWalletUrl: null, googleWalletUrl: 'https://pay.google.com/gp/v/save/test' }
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, reward })))
    vi.stubGlobal('fetch', request)
    expect(await publicApi.completionReward('GAME1234', 'player-token')).toEqual(reward)
    expect(request).toHaveBeenCalledWith(expect.stringContaining('/v1/public/kivly/reward'), expect.objectContaining({
      method: 'POST', body: JSON.stringify({ gameId: 'GAME1234', playerToken: 'player-token' }),
    }))
  })

  it.each([
    { status: 'success' },
    { status: 'confirmed' },
    { status: 'confirmed', name: 'Coffee', appleWalletUrl: 'javascript:alert(1)' },
    { status: 'pending', name: 'Coffee', googleWalletUrl: 'http://pay.google.com/pass' },
  ])('rejects malformed or unsafe reward output: %j', async (reward) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, reward }))))
    await expect(publicApi.completionReward('GAME1234', 'token')).rejects.toThrow()
  })
})

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

describe('public email verification contract', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('requests a challenge and preserves server timestamps', async () => {
    const challenge = {
      ok: true, challengeId: 'challenge', emailMasked: 'p***@example.com',
      expiresAt: '2026-10-17T12:10:00Z', resendAvailableAt: '2026-10-17T12:01:00Z',
    }
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(challenge)))
    vi.stubGlobal('fetch', request)
    const registration = { gameId: 'GAME', email: 'player@example.com', username: 'Player', consent: true, language: 'en' as const }
    expect(await publicApi.requestEmailCode(registration)).toEqual(challenge)
    expect(request).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/public\/email\/request$/), expect.objectContaining({
      method: 'POST', body: JSON.stringify(registration),
    }))
  })

  it('sends only the challenge and string code for final verified join', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, playerToken: 'token' })))
    vi.stubGlobal('fetch', request)
    await publicApi.join({ gameId: 'GAME', challengeId: 'challenge', code: '001234' })
    expect(request).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/public\/join$/), expect.objectContaining({
      method: 'POST', body: '{"gameId":"GAME","challengeId":"challenge","code":"001234"}',
    }))
  })

  it.each([true, false])('retains error codes and Retry-After seconds (header: %s)', async (header) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'EmailRateLimited', message: 'Wait', retryAfter: 75 }),
      { status: 429, headers: header ? { 'Retry-After': '90' } : {} },
    )))
    const error = await publicApi.requestEmailCode({ gameId: 'GAME', username: 'Player', consent: true }).catch((err: unknown) => err)
    expect(error).toBeInstanceOf(PublicApiError)
    expect(error).toMatchObject({ code: 'EmailRateLimited', status: 429, retryAfter: header ? 90 : 75 })
  })

  it('reads an explicit code field and ignores invalid retry delays', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 'VerificationExpired', message: 'Expired' }),
      { status: 400, headers: { 'Retry-After': 'invalid' } },
    )))
    await expect(publicApi.join({ gameId: 'GAME', challengeId: 'challenge', code: '000000' }))
      .rejects.toMatchObject({ code: 'VerificationExpired', retryAfter: undefined })
  })
})
