import { describe, expect, it } from 'vitest'
import { PHONE_COUNTRIES, internationalPhone, splitInternationalPhone } from './phoneCountries'

describe('European phone selector', () => {
  it('contains European countries outside the EU and unique country identifiers', () => {
    expect(PHONE_COUNTRIES.map(({ code }) => code)).toEqual(expect.arrayContaining(['ES', 'GB', 'CH', 'NO', 'UA']))
    expect(new Set(PHONE_COUNTRIES.map(({ code }) => code)).size).toBe(PHONE_COUNTRIES.length)
  })

  it('does not send a country prefix for an empty optional phone', () => {
    expect(internationalPhone('ES', '   ')).toBe('')
  })

  it('composes the selected prefix without duplicating pasted prefixes', () => {
    expect(internationalPhone('ES', '612345678')).toBe('+34 612345678')
    expect(internationalPhone('FR', '612345678')).toBe('+33 612345678')
    expect(internationalPhone('ES', '+44 7700900123')).toBe('+44 7700900123')
    expect(internationalPhone('ES', '0044 7700900123')).toBe('+44 7700900123')
    expect(splitInternationalPhone('+44 7700900123', 'ES')).toEqual({ country: 'GB', number: '7700900123' })
    expect(splitInternationalPhone('0034 612345678', 'FR')).toEqual({ country: 'ES', number: '612345678' })
    expect(splitInternationalPhone('612345678', 'ES')).toEqual({ country: 'ES', number: '612345678' })
    expect(splitInternationalPhone('+44 7700900123', 'JE').country).toBe('JE')
  })
})
