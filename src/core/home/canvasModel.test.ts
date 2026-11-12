import { describe, expect, it } from 'vitest'
import { canPlaceHomeItem, findHomeSpace, initialHomeCanvas, validateHomeCanvas, type HomeItem } from './canvasModel'

const item: HomeItem = { id: 'a', type: 'text', x: 0, y: 0, w: 2, h: 1 }
describe('home canvas grid', () => {
  it('accepts transparent or hex component backgrounds and rejects invalid colors', () => {
    const config = initialHomeCanvas(true, true)
    for (const backgroundColor of ['transparent', '#12Ab34']) {
      config.landscape.items = config.landscape.items.map(element => ({ ...element, backgroundColor }))
      expect(validateHomeCanvas(config)).toBe(true)
    }
    for (const backgroundColor of ['red', '#123', '', 'url(example)']) {
      config.landscape.items[0].backgroundColor = backgroundColor
      expect(validateHomeCanvas(config)).toBe(false)
    }
  })
  it('validates both seeded orientations for every widget combination', () => {
    for (const ranking of [false, true]) for (const raffle of [false, true]) {
      expect(validateHomeCanvas(initialHomeCanvas(ranking, raffle))).toBe(true)
    }
  })
  it('allows adjacent edges but rejects overlap, fractions and out-of-bounds boxes', () => {
    expect(canPlaceHomeItem({ ...item, id: 'b', x: 2 }, [item], 'portrait')).toBe(true)
    for (const patch of [{ x: 1 }, { x: -1 }, { x: 17 }, { y: 32 }, { w: 1 }, { h: 0.5 }]) {
      expect(canPlaceHomeItem({ ...item, id: 'b', ...patch }, [item], 'portrait')).toBe(false)
    }
  })
  it('finds the first vacant cell and reports a full canvas', () => {
    expect(findHomeSpace({ ...item, id: 'b' }, [item], 'portrait')?.x).toBe(2)
    expect(findHomeSpace(item, [{ ...item, id: 'full', w: 18, h: 32 }], 'portrait')).toBeNull()
  })
  it('distinguishes an empty design and validates text and uniqueness', () => {
    const config = initialHomeCanvas(false, false)
    config.portrait.items = []
    expect(validateHomeCanvas(config)).toBe(true)
    config.portrait.items = [item, { ...item, x: 3 }]
    expect(validateHomeCanvas(config)).toBe(false)
    config.portrait.items = [{ ...item, text: '<script>plain text</script>', fontSize: 16 }]
    expect(validateHomeCanvas(config)).toBe(true)
    config.portrait.items[0].fontSize = 161
    expect(validateHomeCanvas(config)).toBe(false)
  })
})
