import {
  BufferGeometry, DataTexture, Float32BufferAttribute, Group, LinearFilter, LinearMipmapLinearFilter,
  Mesh, MeshLambertMaterial, RepeatWrapping, SRGBColorSpace, type Texture,
} from 'three'
import type { StackLayer, StackRectangle, StackSkin } from './stackLogic'

type Point = { x: number; z: number }
type Color = [number, number, number]
const TEXTURE_SIZE = 256
const SIDE_TILE = 1.5
// Bottom-to-top colours of the STACK logo.
const BLOCK_COLORS: Color[] = [[0.2, 0.47, 0.98], [0.56, 0.33, 0.96], [0.95, 0.27, 0.58], [0.99, 0.6, 0.13], [0.13, 0.8, 0.95]]

function seeded(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}

function bake(width: number, height: number, paint: (u: number, v: number) => number[]): DataTexture {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = paint((x + 0.5) / width, (y + 0.5) / height)
      data.set([Math.min(255, color[0]), Math.min(255, color[1]), Math.min(255, color[2]), 255], (y * width + x) * 4)
    }
  }
  const texture = new DataTexture(data, width, height)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

/** A replaceable, canvas-free pizza albedo. All detail is baked into one small shared map. */
export function createPizzaTexture(): DataTexture {
  const pepperoni = [[0.24, 0.27, 0.085], [0.53, 0.23, 0.08], [0.77, 0.34, 0.087],
    [0.36, 0.53, 0.09], [0.68, 0.63, 0.087], [0.23, 0.77, 0.075], [0.5, 0.8, 0.08]]
  const random = seeded(85)
  const herbs = Array.from({ length: 42 }, () => {
    const x = 0.12 + random() * 0.76
    const y = 0.12 + random() * 0.76
    const angle = random() * 6
    return [x, y, Math.cos(angle), Math.sin(angle)]
  })
  return bake(TEXTURE_SIZE, TEXTURE_SIZE, (u, v) => {
    const edge = Math.min(u, v, 1 - u, 1 - v)
    const grain = random()
    const ripple = Math.sin(u * 63 + Math.sin(v * 35)) * Math.cos(v * 49) * 0.008
    let color = [209 + grain * 22, 139 + grain * 26, 64 + grain * 16]
    if (edge > 0.055 + ripple) color = [184 + grain * 24, 57 + grain * 15, 33]
    if (edge > 0.082 + ripple) {
      const toasted = Math.sin(u * 47 + Math.cos(v * 31)) * Math.sin(v * 58 - u * 11)
      color = toasted > 0.66 ? [219, 151 + grain * 24, 57] : [244 + grain * 10, 207 + grain * 18, 114 + grain * 15]
      for (const [px, py, radius] of pepperoni) {
        const distanceSquared = (u - px) ** 2 + ((v - py) * 0.83) ** 2
        if (distanceSquared < radius * radius) {
          const rim = distanceSquared > (radius * 0.84) ** 2
          color = rim ? [150, 47, 30] : grain > 0.89 ? [245, 170, 102] : [201 + grain * 24, 65 + grain * 18, 42]
        }
      }
      for (const [hx, hy, cosine, sine] of herbs) {
        if (Math.abs(u - hx) > 0.014 || Math.abs(v - hy) > 0.014) continue
        const dx = (u - hx) * cosine + (v - hy) * sine
        const dy = -(u - hx) * sine + (v - hy) * cosine
        if (dx * dx / 0.00013 + dy * dy / 0.000018 < 1) color = [63, 103 + grain * 25, 43]
      }
    } else if (grain > 0.92) color = [154, 88, 36]
    return color
  })
}

/** Syrup-glazed, crinkled phyllo with a ragged mound of crushed pistachio in the centre. */
export function createBaklavaTopTexture(): DataTexture {
  const random = seeded(31)
  return bake(TEXTURE_SIZE, TEXTURE_SIZE, (u, v) => {
    const grain = random()
    const crumb = random()
    const edge = Math.min(u, v, 1 - u, 1 - v)
    // Contours of a wavy field read as overlapping phyllo sheets: bright fold, darker crease below.
    const sheets = v * 16 + Math.sin(u * 9 + v * 4) * 1.3 + Math.sin(u * 23 + v * 7) * 0.35
    const fold = sheets - Math.floor(sheets)
    const gloss = Math.sin(u * 7 + v * 5) * Math.sin(v * 6 - u * 3) * 0.5 + 0.5
    const light = 0.78 + fold * 0.3 + gloss * 0.12 + grain * 0.05
    let color = fold < 0.12 ? [158 + grain * 16, 92 + grain * 10, 26] : [232 * light, 160 * light, 62 * light]
    if (edge < 0.035 + Math.sin(sheets * 2) * 0.006) color = [166 + grain * 20, 90 + grain * 14, 28]
    const dx = (u - 0.5) * 1.5
    const dy = v - 0.5
    const angle = Math.atan2(dy, dx)
    const distance = Math.hypot(dx, dy)
    const rim = 0.26 + Math.sin(angle * 5) * 0.022 + Math.sin(angle * 11 + 1) * 0.014
    if (distance < rim || (distance < rim + 0.09 && grain > 0.5 + (distance - rim) * 5)) {
      color = crumb > 0.9 ? [196, 220, 118] : crumb > 0.6 ? [152 + grain * 20, 192, 72]
        : crumb > 0.25 ? [118, 166 + grain * 16, 52] : [82, 126, 36]
    }
    return color
  })
}

/** Layer cross-section: toasted base, thin phyllo sheets, green pistachio filling, more sheets on top. */
export function createBaklavaSideTexture(): DataTexture {
  const random = seeded(47)
  const texture = bake(TEXTURE_SIZE, 64, (u, v) => {
    const grain = random()
    const filling = random()
    const h = v + Math.sin(u * Math.PI * 12 + Math.sin(u * Math.PI * 6) * 1.5) * 0.012
    const sheet = (period: number) => (h / period) % 1 < 0.55
    if (h < 0.1) return [134 + grain * 20, 78 + grain * 12, 26]
    if (h < 0.3) return sheet(0.04) ? [226 + grain * 14, 166 + grain * 18, 70] : [178 + grain * 16, 112 + grain * 12, 36]
    if (h < 0.56) return filling > 0.86 ? [112, 78, 40] : filling > 0.6 ? [168, 200, 84] : [112 + grain * 20, 152 + grain * 20, 46]
    return sheet(0.028) ? [244, 200 + grain * 16, 112 + grain * 16] : [196 + grain * 16, 128 + grain * 14, 44]
  })
  texture.wrapS = RepeatWrapping
  return texture
}

function outline(source: StackRectangle, radiusLimit: number): Point[] {
  const halfWidth = source.width / 2
  const halfDepth = source.depth / 2
  const radius = Math.max(0, Math.min(radiusLimit, source.width * 0.09, source.depth * 0.09))
  const points: Point[] = []
  for (let corner = 0; corner < 4; corner++) {
    const angle = corner * Math.PI / 2
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (halfWidth - radius)
    const cz = (corner < 2 ? 1 : -1) * (halfDepth - radius)
    for (let segment = 0; segment <= 4; segment++) {
      const theta = angle + segment * Math.PI / 8
      points.push({ x: source.x + cx + Math.cos(theta) * radius, z: source.z + cz + Math.sin(theta) * radius })
    }
  }
  return points
}

function clip(points: Point[], piece: StackRectangle): Point[] {
  for (const [axis, boundary, sign] of [
    ['x', piece.x - piece.width / 2, 1], ['x', piece.x + piece.width / 2, -1],
    ['z', piece.z - piece.depth / 2, 1], ['z', piece.z + piece.depth / 2, -1],
  ] as const) {
    const result: Point[] = []
    for (let i = 0; i < points.length; i++) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      const insideA = (a[axis] - boundary) * sign >= -1e-10
      const insideB = (b[axis] - boundary) * sign >= -1e-10
      if (insideA) result.push(a)
      if (insideA !== insideB) {
        const t = (boundary - a[axis]) / (b[axis] - a[axis])
        result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      }
    }
    points = result
  }
  return points
}

function skinStyle(skin: StackSkin) {
  if (skin === 'pizza') {
    const texture = createPizzaTexture()
    return {
      radius: 0.14,
      textures: [texture],
      side: new MeshLambertMaterial({ color: '#ffffff', vertexColors: true }),
      top: new MeshLambertMaterial({ map: texture, color: '#ffffff' }),
      color: (_layer: number, y: number): Color => y < 0 ? [0.48, 0.22, 0.075] : [0.87, 0.57, 0.23],
    }
  }
  if (skin === 'baklava') {
    const top = createBaklavaTopTexture()
    const side = createBaklavaSideTexture()
    return {
      radius: 0.08,
      textures: [top, side],
      side: new MeshLambertMaterial({ map: side, color: '#ffffff' }),
      top: new MeshLambertMaterial({ map: top, color: '#ffffff' }),
      color: (): Color => [1, 1, 1],
    }
  }
  return {
    radius: 0.03,
    textures: [],
    side: new MeshLambertMaterial({ color: '#ffffff', vertexColors: true }),
    top: new MeshLambertMaterial({ color: '#ffffff', vertexColors: true }),
    color: (layer: number, y: number, top: boolean): Color => {
      const base = BLOCK_COLORS[((layer % BLOCK_COLORS.length) + BLOCK_COLORS.length) % BLOCK_COLORS.length]
      const shade = top ? 1.12 : y < 0 ? 0.62 : 0.88
      return base.map((channel) => Math.min(1, channel * shade)) as Color
    },
  }
}

export function createStackVisuals(skin: StackSkin = 'blocks') {
  const style = skinStyle(skin)
  const materials = [style.side, style.top]
  const owned = new Set<BufferGeometry>()

  function create(): Group {
    const piece = new Group()
    piece.name = 'stack-piece'
    // UVs belong to this slice. Keep its buffers fixed while pooling the mesh (no GPU buffer churn).
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(384 * 3, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(384 * 2, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(384 * 3, 3))
    owned.add(geometry)
    piece.add(new Mesh(geometry, materials))
    return piece
  }

  function update(group: Group, piece: StackLayer, source: StackRectangle, layerHeight: number) {
    const geometry = (group.children[0] as Mesh).geometry
    const edge = clip(outline(source, style.radius), piece)
    const layer = Math.round(piece.y / layerHeight)
    const positions: number[] = []
    const uvs: number[] = []
    const colors: number[] = []
    // Side faces map u along the perimeter (world units) and v up the slice; caps project from above.
    const vertex = (point: Point, y: number, around?: number) => {
      positions.push((point.x - piece.x) / piece.width, y, (point.z - piece.z) / piece.depth)
      if (around === undefined) uvs.push((point.x - source.x) / source.width + 0.5, (point.z - source.z) / source.depth + 0.5)
      else uvs.push(around / SIDE_TILE, y + 0.5)
      colors.push(...style.color(layer, y, around === undefined && y > 0))
    }
    // Rounded outline remains that of the ORIGINAL piece; cut faces stay straight.
    let around = 0
    for (let i = 0; i < edge.length; i++) {
      const a = edge[i]
      const b = edge[(i + 1) % edge.length]
      const next = around + Math.hypot(b.x - a.x, b.z - a.z)
      vertex(a, -0.5, around); vertex(b, 0.5, next); vertex(b, -0.5, next)
      vertex(a, -0.5, around); vertex(a, 0.5, around); vertex(b, 0.5, next)
      around = next
    }
    for (let i = 1; i < edge.length - 1; i++) {
      vertex(edge[0], -0.5, 0); vertex(edge[i], -0.5, 0); vertex(edge[i + 1], -0.5, 0)
    }
    const body = positions.length / 3
    for (let i = 1; i < edge.length - 1; i++) {
      vertex(edge[0], 0.5); vertex(edge[i + 1], 0.5); vertex(edge[i], 0.5)
    }
    for (const [name, values] of [['position', positions], ['uv', uvs], ['color', colors]] as const) {
      const attribute = geometry.getAttribute(name)
      ;(attribute.array as Float32Array).fill(0)
      attribute.array.set(values)
      attribute.needsUpdate = true
    }
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    geometry.clearGroups()
    geometry.addGroup(0, body, 0)
    geometry.addGroup(body, positions.length / 3 - body, 1)
    geometry.setDrawRange(0, positions.length / 3)
    group.rotation.set(0, 0, 0)
    group.scale.set(piece.width, layerHeight, piece.depth)
    group.position.set(piece.x, piece.y, piece.z)
  }

  return {
    create, update,
    dispose() {
      for (const geometry of owned) geometry.dispose()
      owned.clear()
      for (const material of materials) material.dispose()
      for (const texture of style.textures as Texture[]) texture.dispose()
    },
  }
}
