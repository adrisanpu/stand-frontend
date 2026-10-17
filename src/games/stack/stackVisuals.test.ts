import { describe, expect, it, vi } from 'vitest'
import { BufferGeometry, Material, Mesh, RepeatWrapping, SRGBColorSpace, Texture } from 'three'
import { createBaklavaSideTexture, createBaklavaTopTexture, createPizzaTexture, createStackVisuals } from './stackVisuals'

describe('STACK lightweight piece assets', () => {
  const source = { x: 0.5, z: -0.25, width: 3, depth: 2, y: 0.24 }

  it('bakes deterministic crust, sauce, cheese, round pepperoni and herbs without canvas or external assets', () => {
    const a = createPizzaTexture()
    const b = createPizzaTexture()
    expect(a.image.width).toBe(256)
    expect(a.image.height).toBe(256)
    expect(a.colorSpace).toBe(SRGBColorSpace)
    expect(a.image.data).toEqual(b.image.data)
    const colors = new Set<string>()
    for (let i = 0; i < a.image.data.length; i += 4) {
      const [r, g, blue, alpha] = a.image.data.slice(i, i + 4)
      expect(alpha).toBe(255)
      if (r > 230 && g > 200) colors.add('cheese')
      if (r < 90 && g > 100 && blue < 60) colors.add('herbs')
      if (r > 200 && g < 85 && blue < 60) colors.add('pepperoni')
      if (r > 180 && r < 210 && g < 75 && blue === 33) colors.add('sauce')
      if (r > 209 && g > 139 && g < 170 && blue < 85) colors.add('crust')
    }
    expect([...colors].sort()).toEqual(['cheese', 'crust', 'herbs', 'pepperoni', 'sauce'])
    a.dispose()
    b.dispose()
  })

  it('has rounded corners, real dough thickness, upward top normals and exact logical dimensions', () => {
    const visuals = createStackVisuals('pizza')
    const pizza = visuals.create()
    visuals.update(pizza, source, source, 0.24)
    const geometry = (pizza.children[0] as Mesh).geometry
    const positions = geometry.getAttribute('position')
    const normals = geometry.getAttribute('normal')
    const top = geometry.groups[1]
    let maxX = -Infinity
    let minX = Infinity
    for (let i = 0; i < geometry.drawRange.count; i++) {
      const x = positions.getX(i)
      const z = positions.getZ(i)
      maxX = Math.max(maxX, x)
      minX = Math.min(minX, x)
      expect(Math.abs(x) === 0.5 && Math.abs(z) === 0.5).toBe(false)
      expect(Math.abs(positions.getY(i))).toBe(0.5)
    }
    expect(maxX).toBeCloseTo(0.5)
    expect(minX).toBeCloseTo(-0.5)
    for (let i = top.start; i < top.start + top.count; i++) expect(normals.getY(i)).toBeCloseTo(1)
    expect(pizza.scale.toArray()).toEqual([3, 0.24, 2])
    expect(pizza.position.toArray()).toEqual([0.5, 0.24, -0.25])
    visuals.dispose()
  })

  it('reuses fixed GPU attributes for pooled shapes and disposes each owned resource once', () => {
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, 'dispose')
    const materialDispose = vi.spyOn(Material.prototype, 'dispose')
    const textureDispose = vi.spyOn(Texture.prototype, 'dispose')
    const visuals = createStackVisuals('pizza')
    const pizza = visuals.create()
    const second = visuals.create()
    const geometry = (pizza.children[0] as Mesh).geometry
    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    const normal = geometry.getAttribute('normal')
    visuals.update(pizza, source, source, 0.24)
    const actualNormal = geometry.getAttribute('normal')
    for (let i = 0; i < 1000; i++) {
      visuals.update(pizza, { ...source, width: 0.001 + i / 1000 }, source, 0.24)
    }
    expect(geometry.getAttribute('position')).toBe(position)
    expect(geometry.getAttribute('uv')).toBe(uv)
    expect(geometry.getAttribute('normal')).toBe(actualNormal)
    expect(normal).toBeUndefined()
    expect((pizza.children[0] as Mesh).material).toBe((second.children[0] as Mesh).material)
    expect(geometryDispose).not.toHaveBeenCalled()
    visuals.dispose()
    expect(geometryDispose).toHaveBeenCalledTimes(2)
    expect(materialDispose).toHaveBeenCalledTimes(2)
    expect(textureDispose).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('bakes a deterministic baklava: golden phyllo and a pistachio mound on top, green filling band on the side', () => {
    const top = createBaklavaTopTexture()
    const side = createBaklavaSideTexture()
    expect(top.image.data).toEqual(createBaklavaTopTexture().image.data)
    const pixel = (texture: typeof top, u: number, v: number) => {
      const { width, height, data } = texture.image
      const index = (Math.floor(v * height) * width + Math.floor(u * width)) * 4
      return Array.from(data.slice(index, index + 3))
    }
    const green = ([r, g, b]: number[]) => g > r && g > b
    expect(green(pixel(top, 0.5, 0.5))).toBe(true)
    expect(green(pixel(top, 0.1, 0.1))).toBe(false)
    expect(green(pixel(side, 0.3, 0.45))).toBe(true)
    expect(green(pixel(side, 0.3, 0.8))).toBe(false)
    expect(side.wrapS).toBe(RepeatWrapping)
    top.dispose()
    side.dispose()
  })

  it('colours blocks per layer like the logo, lighter on top, and owns no textures', () => {
    const textureDispose = vi.spyOn(Texture.prototype, 'dispose')
    const visuals = createStackVisuals('blocks')
    const first = visuals.create()
    const second = visuals.create()
    visuals.update(first, { ...source, y: 0 }, source, 0.24)
    visuals.update(second, { ...source, y: 0.24 }, source, 0.24)
    const topColor = (piece: typeof first) => {
      const geometry = (piece.children[0] as Mesh).geometry
      const color = geometry.getAttribute('color')
      const index = geometry.groups[1].start
      return [color.getX(index), color.getY(index), color.getZ(index)]
    }
    expect(topColor(first)).not.toEqual(topColor(second))
    const sideColor = (first.children[0] as Mesh).geometry.getAttribute('color')
    expect(topColor(first)[2]).toBeGreaterThan(sideColor.getZ(0))
    visuals.dispose()
    expect(textureDispose).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
