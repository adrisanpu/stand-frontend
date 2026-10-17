import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicApi } from '../../api/publicApi'

describe('participant credential transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exchanges personal access credentials in a POST body only', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', fetch)
    await publicApi.exchangeAccess({ gameId: 'GAME1234', accessToken: 'private-access' })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toMatch(/\/v1\/public\/access$/)
    expect(url).not.toContain('private-access')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ gameId: 'GAME1234', accessToken: 'private-access' })
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
})
