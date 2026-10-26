import { describe, expect, it } from 'vitest'
import { DEFAULT_RULET4_CONFIG, isRulet4Config, isRulet4Result, rulet4Segments } from './rulet4Logic'

describe('RULET4 canonical segment contract', () => {
  it('expands weights in server order without randomness', () => {
    expect(rulet4Segments(DEFAULT_RULET4_CONFIG).map((panel) => panel.id)).toEqual([
      '1', '1', '1', '1', '2', '2', '2', '2', '3',
    ])
  })

  it.each([0, -1, 1.5, 361, NaN, Infinity])('rejects invalid weight %s', (count) => {
    expect(isRulet4Config({ panels: [{ id: 'a', label: 'A', count }] })).toBe(false)
  })

  it('checks panel count, total weight, unique IDs, labels and colors', () => {
    const panel = { id: 'a', label: 'A', count: 1, color: '#112233' }
    expect(isRulet4Config({ panels: [panel] })).toBe(true)
    expect(isRulet4Config({ panels: [panel, panel] })).toBe(false)
    expect(isRulet4Config({ panels: [{ ...panel, count: 360 }, { ...panel, id: 'b', count: 1 }] })).toBe(false)
    expect(isRulet4Config({ panels: Array.from({ length: 33 }, (_, i) => ({ ...panel, id: String(i) })) })).toBe(false)
    expect(isRulet4Config({ panels: [{ ...panel, label: ' ' }] })).toBe(false)
    expect(isRulet4Config({ panels: [{ ...panel, color: 'red' }] })).toBe(false)
  })

  it('accepts a valid result and rejects another panel at the returned index', () => {
    const result = {
      configSnapshot: DEFAULT_RULET4_CONFIG, panel: DEFAULT_RULET4_CONFIG.panels[2],
      index: 8, spunAt: '2026-10-26T12:00:00Z',
    }
    expect(isRulet4Result(result)).toBe(true)
    expect(isRulet4Result({ ...result, index: 0 })).toBe(false)
  })
})
