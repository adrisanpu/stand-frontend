import { describe, it, expect } from 'vitest'
import { getEmpareja2CenterKind } from './centerKind'

describe('getEmpareja2CenterKind', () => {
  it('phone mode + avatars → avatar (not pair panel)', () => {
    expect(getEmpareja2CenterKind('mobile', true)).toBe('avatar')
  })

  it('phone mode + avatars off → links fallback', () => {
    expect(getEmpareja2CenterKind('mobile', false)).toBe('links')
  })

  it('master mode → pair panel, independently of access channel', () => {
    expect(getEmpareja2CenterKind('master', true)).toBe('pair')
    expect(getEmpareja2CenterKind('master', false)).toBe('pair')
  })
})
