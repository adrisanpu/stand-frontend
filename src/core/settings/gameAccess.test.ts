import { describe, expect, it } from 'vitest'
import { GAME_ACCESS_CAPABILITIES, resolveGameAccess } from './gameAccess'
import { getJoinUrl } from '../lib/joinUrl'

const fixedAccess = { playMode: 'mobile', joinChannel: 'web' } as const
const supportedGames = ['EMPAREJA2', 'T1MER', 'STACK', 'L3TRAS', 'RULET4', 'CUPIDO', 'SEMAFORO', 'INFOCARDS', 'IMPOSTOR']

describe('game access compatibility', () => {
  it.each(supportedGames)('%s only supports mobile gameplay and Web participant access', (type) => {
    expect(GAME_ACCESS_CAPABILITIES[type]).toEqual({ playModes: ['mobile'], joinChannels: ['web'] })
    expect(resolveGameAccess(type)).toEqual(fixedAccess)
  })

  it.each([
    { playMode: 'master', joinChannel: 'instagram' },
    { playMode: 'master', joinChannel: 'web' },
    { playMode: 'mobile', joinChannel: 'instagram' },
    { playMode: 'legacy-mode', joinChannel: 'legacy-channel' },
    { playMode: undefined, joinChannel: undefined },
    {},
  ])('normalizes stored/API access %o to mobile and Web', (legacy) => {
    expect(resolveGameAccess('T1MER', legacy)).toEqual(fixedAccess)
  })

  it('does not accept unsupported game types', () => {
    expect(() => resolveGameAccess('UNKNOWN')).toThrow('Juego no compatible')
    expect(Object.keys(GAME_ACCESS_CAPABILITIES)).toHaveLength(9)
  })

  it('always directs QR codes to Web participant access', () => {
    const webUrl = `${window.location.origin}/play/ABC123`
    expect(getJoinUrl('ABC123', 'web')).toBe(webUrl)
    expect(getJoinUrl('ABC123', 'instagram')).toBe(webUrl)
    expect(getJoinUrl('ABC123', 'legacy')).toBe(webUrl)
  })
})
