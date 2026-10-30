import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

describe('API error responses', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('preserves a plain-text error response and its status', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('upstream unavailable', { status: 502 })
    ))

    await expect(api.get('/health')).rejects.toThrow(
      'API error: 502 upstream unavailable'
    )
  })

  it('does not expose or log Kivly response bodies', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: 'KivlyRewardCreationUncertain', detail: 'External response must remain private',
      }), { status: 502 })
    ))
    await expect(api.get('/v1/kivly')).rejects.toMatchObject({
      status: 502, code: 'KivlyRewardCreationUncertain', message: 'Kivly API error: 502',
    })
    expect(log).not.toHaveBeenCalled()
  })
})
