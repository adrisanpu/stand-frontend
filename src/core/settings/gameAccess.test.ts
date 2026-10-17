import { describe, expect, it } from 'vitest'
import { GAME_ACCESS_CAPABILITIES, resolveGameAccess } from './gameAccess'
import { getJoinUrl } from '../lib/joinUrl'

describe('game access compatibility', () => {
  it.each(['EMPAREJA2', 'T1MER'])('%s supports all four independent combinations', (type) => {
    for (const playMode of ['master', 'mobile'] as const) {
      for (const joinChannel of ['instagram', 'web'] as const) {
        expect(resolveGameAccess(type, { playMode, joinChannel })).toEqual({ playMode, joinChannel })
      }
    }
  })

  it('keeps legacy campaigns unchanged', () => {
    for (const type of ['EMPAREJA2', 'T1MER']) {
      expect(resolveGameAccess(type)).toEqual({ playMode: 'mobile', joinChannel: 'web' })
      expect(resolveGameAccess(type, { joinChannel: 'instagram' })).toEqual({ playMode: 'master', joinChannel: 'instagram' })
    }
    expect(resolveGameAccess('STACK')).toEqual({ playMode: 'mobile', joinChannel: 'web' })
    for (const type of ['L3TRAS', 'RULET4', 'CUPIDO', 'SEMAFORO', 'INFOCARDS', 'IMPOSTOR']) {
      expect(resolveGameAccess(type)).toEqual({ playMode: 'master', joinChannel: 'instagram' })
      expect(() => resolveGameAccess(type, { joinChannel: 'web' })).toThrow()
      expect(() => resolveGameAccess(type, { playMode: 'mobile' })).toThrow()
    }
  })

  it('STACK supports both access channels, never master', () => {
    expect(resolveGameAccess('STACK', { joinChannel: 'instagram' })).toEqual({ playMode: 'mobile', joinChannel: 'instagram' })
    expect(() => resolveGameAccess('STACK', { playMode: 'master' })).toThrow()
    expect(Object.keys(GAME_ACCESS_CAPABILITIES)).toHaveLength(9)
  })

  it('does not accept malformed persisted access', () => {
    expect(() => resolveGameAccess('T1MER', { playMode: 'invalid' })).toThrow()
    expect(() => resolveGameAccess('T1MER', { joinChannel: '' })).toThrow()
    expect(() => resolveGameAccess('UNKNOWN')).toThrow()
  })

  it('QR target depends on channel, not play mode', () => {
    expect(getJoinUrl('ABC123', 'web')).toBe(`${window.location.origin}/play/ABC123`)
    expect(getJoinUrl('ABC123', 'instagram')).not.toContain('/play/')
    expect(getJoinUrl('ABC123', 'instagram')).toContain('ABC123')
  })
})
