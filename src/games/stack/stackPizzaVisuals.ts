import {
  BufferGeometry, DataTexture, Float32BufferAttribute, Group, LinearFilter, LinearMipmapLinearFilter,
  Mesh, MeshLambertMaterial, SRGBColorSpace,
} from 'three'
import type { StackLayer, StackRectangle } from './stackLogic'

type Point = { x: number; z: number }
const TEXTURE_SIZE = 256

/** A replaceable, canvas-free pizza albedo. All detail is baked into one small shared map. */
export function createPizzaTexture(): DataTexture {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  const pepperoni = [[0.24, 0.27, 0.085], [0.53, 0.23, 0.08], [0.77, 0.34, 0.087],
    [0.36, 0.53, 0.09], [0.68, 0.63, 0.087], [0.23, 0.77, 0.075], [0.5, 0.8, 0.08]]
  let seed = 85
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const herbs = Array.from({ length: 42 }, () => {
    const x = 0.12 + random() * 0.76
    const y = 0.12 + random() * 0.76
    const angle = random() * 6
    return [x, y, Math.cos(angle), Math.sin(angle)]
  })
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const u = (x + 0.5) / TEXTURE_SIZE
      const v = (y + 0.5) / TEXTURE_SIZE
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
      const index = (y * TEXTURE_SIZE + x) * 4
      data[index] = color[0]
      data[index + 1] = color[1]
      data[index + 2] = color[2]
      data[index + 3] = 255
    }
  }
  const texture = new DataTexture(data, TEXTURE_SIZE, TEXTURE_SIZE)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function outline(source: StackRectangle, inset: number): Point[] {
  const halfWidth = source.width / 2 - inset
  const halfDepth = source.depth / 2 - inset
  const radius = Math.max(0, Math.min(0.14, source.width * 0.09, source.depth * 0.09) - inset)
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

export function createPizzaVisuals() {
  const texture = createPizzaTexture()
  const crust = new MeshLambertMaterial({ color: '#ffffff', vertexColors: true })
  const surface = new MeshLambertMaterial({ map: texture, color: '#ffffff' })
  const materials = [crust, surface]
  const owned = new Set<BufferGeometry>()

  function create(): Group {
    const pizza = new Group()
    pizza.name = 'stack-pizza'
    // UVs belong to this slice. Keep its buffers fixed while pooling the mesh (no GPU buffer churn).
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(384 * 3, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(384 * 2, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(384 * 3, 3))
    owned.add(geometry)
    pizza.add(new Mesh(geometry, materials))
    return pizza
  }

  function update(pizza: Group, piece: StackLayer, source: StackRectangle, layerHeight: number) {
    const geometry = (pizza.children[0] as Mesh).geometry
    const edge = clip(outline(source, 0), piece)
    const positions: number[] = []
    const uvs: number[] = []
    const colors: number[] = []
    const vertex = (point: Point, y: number) => {
      positions.push((point.x - piece.x) / piece.width, y, (point.z - piece.z) / piece.depth)
      uvs.push((point.x - source.x) / source.width + 0.5, (point.z - source.z) / source.depth + 0.5)
      colors.push(...(y < 0 ? [0.48, 0.22, 0.075] : [0.87, 0.57, 0.23]))
    }
    // Rounded outline remains that of the ORIGINAL pizza; cut faces stay straight.
    for (let i = 0; i < edge.length; i++) {
      const a = edge[i]
      const b = edge[(i + 1) % edge.length]
      vertex(a, -0.5); vertex(b, 0.5); vertex(b, -0.5)
      vertex(a, -0.5); vertex(a, 0.5); vertex(b, 0.5)
    }
    for (let i = 1; i < edge.length - 1; i++) {
      vertex(edge[0], -0.5); vertex(edge[i], -0.5); vertex(edge[i + 1], -0.5)
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
    pizza.rotation.set(0, 0, 0)
    pizza.scale.set(piece.width, layerHeight, piece.depth)
    pizza.position.set(piece.x, piece.y, piece.z)
  }

  return {
    create, update,
    dispose() {
      for (const geometry of owned) geometry.dispose()
      owned.clear()
      crust.dispose()
      surface.dispose()
      texture.dispose()
    },
  }
}
