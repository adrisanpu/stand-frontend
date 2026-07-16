import { describe, it, expect } from 'vitest'
import { getEmpareja2CenterKind } from './centerKind'

describe('getEmpareja2CenterKind', () => {
  it('phone mode + avatars → avatar (not pair panel)', () => {
    expect(getEmpareja2CenterKind('web', true)).toBe('avatar')
  })

  it('phone mode + avatars off → links fallback', () => {
    expect(getEmpareja2CenterKind('web', false)).toBe('links')
  })

  it('instagram / event screen → pair panel', () => {
    expect(getEmpareja2CenterKind('instagram', true)).toBe('pair')
    expect(getEmpareja2CenterKind('instagram', false)).toBe('pair')
  })
})
