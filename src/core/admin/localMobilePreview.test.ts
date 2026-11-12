import { describe, expect, it } from 'vitest'
import { advanceLocalAssignment, initialLocalAssignment } from './localMobilePreview'

describe('local-only multiplayer simulation', () => {
  const settings = { objectiveWord: 'ABA', validationTimeLimitSeconds: 15 }
  it('rejects reused/unknown codes and resets expired collections without mutating its input', () => {
    const initial = initialLocalAssignment('L3TRAS', settings)
    const first = advanceLocalAssignment(initial, { move: 'code', code: '1001' }, settings, 1000)
    expect(initial.play.slots).toEqual([null, null, null])
    expect(first.play.slots).toEqual([null, 'B', null])
    expect(() => advanceLocalAssignment(first, { move: 'code', code: '1001' }, settings, 1001)).toThrow('Ya has añadido')
    expect(() => advanceLocalAssignment(first, { move: 'code', code: '9999' }, settings, 1001)).toThrow('jugadores simulados')
    const expired = advanceLocalAssignment(first, { move: 'code', code: '1002' }, settings, 16001)
    expect(expired.play.slots).toEqual([null, null, 'A'])
    expect(expired.validated).toBe(false)
    expect(expired.play.expiresAt).toBe(31001)
  })
})
