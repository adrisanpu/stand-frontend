import { describe, it, expect } from 'vitest'
import { normalizeGameType } from './gameTypeMap'

describe('normalizeGameType', () => {
  it('returns uppercase canonical ids', () => {
    expect(normalizeGameType('t1mer')).toBe('T1MER')
    expect(normalizeGameType('T1MER')).toBe('T1MER')
    expect(normalizeGameType('rulet4')).toBe('RULET4')
  })

  it('maps legacy aliases', () => {
    expect(normalizeGameType('timer')).toBe('T1MER')
    expect(normalizeGameType('ruleta')).toBe('RULET4')
    expect(normalizeGameType('empareja')).toBe('EMPAREJA2')
    expect(normalizeGameType('semáforo')).toBe('SEMAFORO')
    expect(normalizeGameType('semaforo')).toBe('SEMAFORO')
  })

  it('defaults to EMPAREJA2 when empty', () => {
    expect(normalizeGameType(undefined)).toBe('EMPAREJA2')
    expect(normalizeGameType('')).toBe('EMPAREJA2')
  })
})
