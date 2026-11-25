import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicApi } from '../../api/publicApi'

describe('participant credential transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each([undefined, 'GAME1234'])('recovers sessions by POST without putting tokens in query strings (%s)', async (gameId) => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetch)
    await publicApi.getPlayer('private-session', gameId)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toMatch(/\/v1\/public\/player$/)
    expect(url).not.toContain('?')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      playerToken: 'private-session', ...(gameId ? { gameId } : {}),
    })
  })

  it('sends the registration username only with the email challenge request', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetch)
    await publicApi.requestEmailCode({
      gameId: 'GAME1234', email: 'player@example.com', username: 'Ana 🌟', consent: true, language: 'en',
    })
    await publicApi.join({ gameId: 'GAME1234', challengeId: 'private-challenge', code: '012345' })
    expect(fetch.mock.calls[0][0]).toMatch(/\/v1\/public\/email\/request$/)
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      gameId: 'GAME1234', email: 'player@example.com', username: 'Ana 🌟', consent: true, language: 'en',
    })
    expect(fetch.mock.calls[1][0]).toMatch(/\/v1\/public\/join$/)
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      gameId: 'GAME1234', challengeId: 'private-challenge', code: '012345',
    })
  })

  it('sends BASKET start and fixed shot evidence through the shared public score endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetch)
    const shot = { atMs: 0, vx: 1600, vy: 7800, vz: -7700 }
    await publicApi.startBasketAttempt({ gameId: 'GAME1234', playerToken: 'private-session', attemptId: 'attempt-1' })
    await publicApi.finishBasketAttempt({
      gameId: 'GAME1234', playerToken: 'private-session', attemptId: 'attempt-1', shots: [shot],
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      expect.stringMatching(/\/v1\/public\/score$/),
      expect.stringMatching(/\/v1\/public\/score$/),
    ])
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      gameId: 'GAME1234', playerToken: 'private-session', attemptId: 'attempt-1', action: 'start',
    })
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      gameId: 'GAME1234', playerToken: 'private-session', attemptId: 'attempt-1', shots: [shot], action: 'finish',
    })
  })

  it('uploads a validated photo through the player-token-protected presigned form', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          uploadUrl: 'https://media.example/upload',
          uploadFields: { key: 'players/GAME1234/1/profile.png', policy: 'signed' },
          photoKey: 'players/GAME1234/1/profile.png',
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, profilePicUrl: 'https://media.example/photo' }) })
    vi.stubGlobal('fetch', fetch)
    const file = new File([new Uint8Array([1, 2, 3])], 'profile.png', { type: 'image/png' })

    await expect(publicApi.uploadParticipantPhoto(file, 'private-session')).resolves.toBe('https://media.example/photo')

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      action: 'upload-url',
      playerToken: 'private-session',
      contentType: 'image/png',
      sizeBytes: 3,
    })
    const uploadOptions = fetch.mock.calls[1][1]
    expect(uploadOptions.method).toBe('POST')
    expect(uploadOptions.body).toBeInstanceOf(FormData)
    expect((uploadOptions.body as FormData).get('policy')).toBe('signed')
    expect((uploadOptions.body as FormData).get('file')).toBe(file)
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({
      action: 'complete',
      playerToken: 'private-session',
      photoKey: 'players/GAME1234/1/profile.png',
    })
  })
})
