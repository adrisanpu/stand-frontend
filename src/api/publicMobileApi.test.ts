import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicApi } from './publicApi'

afterEach(() => { vi.unstubAllGlobals() })

describe('public mobile gameplay contract', () => {
  it('uses the existing participant POST route with a stable action id, never operator authentication', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    vi.stubGlobal('fetch', request)
    await publicApi.play('ABC123', 'private-token', 4, 'request-id', { move: 'answer', answer: 'q2-option' })
    const [url, options] = request.mock.calls[0]
    expect(url).toMatch(/\/v1\/public\/player$/)
    expect(url).not.toContain('private-token')
    expect(options.headers).not.toHaveProperty('Authorization')
    expect(JSON.parse(options.body)).toEqual({
      gameId: 'ABC123', playerToken: 'private-token', action: 'play', revision: 4,
      requestId: 'request-id', move: 'answer', answer: 'q2-option',
    })
  })

  it('preserves conflicts so the experience can recover instead of resubmitting a result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, error: 'PlayChanged' }), { status: 409 },
    )))
    await expect(publicApi.play('ABC123', 'token', 0, 'request-id', { move: 'code', code: '1234' }))
      .rejects.toMatchObject({ status: 409, code: 'PlayChanged' })
  })
})
