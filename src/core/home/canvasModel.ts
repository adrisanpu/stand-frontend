export const HOME_ITEM_TYPES = ['qr', 'logo', 'players', 'ranking', 'raffle', 'prizes', 'text'] as const
export type HomeItemType = typeof HOME_ITEM_TYPES[number]
export type HomeOrientation = 'landscape' | 'portrait'
export type HomeItem = {
  id: string
  type: HomeItemType
  x: number
  y: number
  w: number
  h: number
  backgroundColor?: string
  text?: string
  fontSize?: number
  color?: string
  align?: 'left' | 'center' | 'right'
}
export type HomeBackground = { key: string; type: 'image' | 'video' }
export type HomeComposition = { background: HomeBackground | null; items: HomeItem[] }
export type HomeCanvasConfig = { version: 1; landscape: HomeComposition; portrait: HomeComposition }
export type HomeBackgroundUrls = Record<HomeOrientation, string | null>
export const HOME_UNIT = 60
export const HOME_GRID = { landscape: { cols: 32, rows: 18 }, portrait: { cols: 18, rows: 32 } }
export const HOME_MIN_SIZE: Record<HomeItemType, { w: number; h: number }> = {
  qr: { w: 4, h: 5 }, logo: { w: 3, h: 2 }, players: { w: 4, h: 2 },
  ranking: { w: 4, h: 5 }, raffle: { w: 4, h: 4 }, prizes: { w: 4, h: 2 }, text: { w: 2, h: 1 },
}

export function homeItemsOverlap(a: HomeItem, b: HomeItem): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function canPlaceHomeItem(item: HomeItem, items: HomeItem[], orientation: HomeOrientation): boolean {
  const { cols, rows } = HOME_GRID[orientation]
  const minimum = HOME_MIN_SIZE[item.type]
  return !!minimum && [item.x, item.y, item.w, item.h].every(Number.isInteger)
    && item.x >= 0 && item.y >= 0 && item.w >= minimum.w && item.h >= minimum.h
    && item.x + item.w <= cols && item.y + item.h <= rows
    && !items.some(other => other && other.id !== item.id && homeItemsOverlap(item, other))
}

export function findHomeSpace(item: HomeItem, items: HomeItem[], orientation: HomeOrientation): HomeItem | null {
  const { cols, rows } = HOME_GRID[orientation]
  for (let y = 0; y <= rows - item.h; y++) {
    for (let x = 0; x <= cols - item.w; x++) {
      const placed = { ...item, x, y }
      if (canPlaceHomeItem(placed, items, orientation)) return placed
    }
  }
  return null
}

export function validateHomeCanvas(value: unknown): value is HomeCanvasConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as HomeCanvasConfig
  if (config.version !== 1) return false
  for (const orientation of ['landscape', 'portrait'] as const) {
    const composition = config[orientation]
    if (!composition || !Array.isArray(composition.items) || composition.items.length > 40) return false
    const background = composition.background
    if (background !== null && (!background || typeof background.key !== 'string'
      || !background.key || !['image', 'video'].includes(background.type))) return false
    const ids = new Set<string>(), types = new Set<HomeItemType>()
    for (const item of composition.items) {
      if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(item.id)
        || ids.has(item.id) || !HOME_ITEM_TYPES.includes(item.type)
        || (item.type !== 'text' && types.has(item.type))
        || !canPlaceHomeItem(item, composition.items, orientation)) return false
      if (item.text !== undefined && (typeof item.text !== 'string' || item.text.length > 1000)) return false
      if (item.fontSize !== undefined && (!Number.isInteger(item.fontSize) || item.fontSize < 16 || item.fontSize > 160)) return false
      if (item.color !== undefined && !/^#[\da-f]{6}$/i.test(item.color)) return false
      if (item.backgroundColor !== undefined && item.backgroundColor !== 'transparent'
        && !/^#[\da-f]{6}$/i.test(item.backgroundColor)) return false
      if (item.align !== undefined && !['left', 'center', 'right'].includes(item.align)) return false
      ids.add(item.id)
      types.add(item.type)
    }
  }
  return true
}

export function initialHomeCanvas(ranking: boolean, raffle: boolean): HomeCanvasConfig {
  const make = (type: HomeItemType, x: number, y: number, w: number, h: number): HomeItem => ({ id: type, type, x, y, w, h })
  return {
    version: 1,
    landscape: { background: null, items: [
      make('logo', 0, 0, 8, 5), make('players', 0, 5, 8, 4),
      ...(raffle ? [make('raffle', 0, 9, 8, 9)] : []), make('qr', 8, 0, 14, 15), make('prizes', 8, 15, 14, 3),
      ...(ranking ? [make('ranking', 22, 0, 10, 18)] : []),
    ] },
    portrait: { background: null, items: [
      make('logo', 0, 0, 18, 5), make('qr', 0, 5, 18, 10), make('prizes', 0, 15, 18, 2), make('players', 0, 17, 18, 3),
      ...(raffle ? [make('raffle', 0, 20, 18, 5)] : []),
      ...(ranking ? [make('ranking', 0, 25, 18, 7)] : []),
    ] },
  }
}
