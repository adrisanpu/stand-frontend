export type Rulet4PanelConfig = {
  id: string
  label: string
  color?: string
  count: number
}

export type Rulet4Settings = { panels: Rulet4PanelConfig[] }
export type Rulet4Result = {
  panel: Rulet4PanelConfig
  index: number
  configSnapshot: Rulet4Settings
  spunAt: string
}
export type Rulet4Assignment = {
  gameType: 'RULET4'
  playerId: number
  displayName: string
  profilePicUrl?: string | null
  result: Rulet4Result | null
}

export const DEFAULT_RULET4_CONFIG: Rulet4Settings = {
  panels: [
    { id: '1', label: 'Rojo', color: '#DC2626', count: 4 },
    { id: '2', label: 'Negro', color: '#000000', count: 4 },
    { id: '3', label: 'Verde', color: '#22C55E', count: 1 },
  ],
}

export function isRulet4Config(value: unknown): value is Rulet4Settings {
  if (!value || typeof value !== 'object' || !('panels' in value) || !Array.isArray(value.panels)
    || Object.keys(value).some((key) => key !== 'panels')
    || value.panels.length < 1 || value.panels.length > 32) return false
  const ids = new Set<string>()
  let total = 0
  for (const panel of value.panels) {
    if (!panel || typeof panel !== 'object'
      || Object.keys(panel).some((key) => !['id', 'label', 'color', 'count'].includes(key))
      || typeof panel.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(panel.id) || ids.has(panel.id)
      || typeof panel.label !== 'string' || !panel.label.trim() || panel.label.trim().length > 80
      || (panel.color !== undefined && (typeof panel.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(panel.color)))
      || !Number.isInteger(panel.count) || panel.count < 1 || panel.count > 360) return false
    ids.add(panel.id)
    total += panel.count
  }
  return total <= 360
}

export function rulet4Segments(config: Rulet4Settings): Rulet4PanelConfig[] {
  return config.panels.flatMap((panel) => Array.from({ length: panel.count }, () => panel))
}

export function isRulet4Result(value: unknown): value is Rulet4Result {
  if (!value || typeof value !== 'object'
    || !('configSnapshot' in value) || !isRulet4Config(value.configSnapshot)
    || !('index' in value) || typeof value.index !== 'number' || !Number.isInteger(value.index)
    || !('spunAt' in value) || typeof value.spunAt !== 'string' || !Number.isFinite(Date.parse(value.spunAt))
    || !('panel' in value) || !value.panel || typeof value.panel !== 'object') return false
  const selected = rulet4Segments(value.configSnapshot)[value.index]
  const panel = value.panel
  return selected !== undefined && 'id' in panel && panel.id === selected.id
    && 'label' in panel && panel.label === selected.label
    && 'count' in panel && panel.count === selected.count
    && 'color' in panel && panel.color === selected.color
}

export function isRulet4Assignment(value: unknown): value is Rulet4Assignment {
  return !!value && typeof value === 'object' && 'gameType' in value && value.gameType === 'RULET4'
    && 'playerId' in value && typeof value.playerId === 'number' && Number.isInteger(value.playerId) && value.playerId > 0
    && 'displayName' in value && typeof value.displayName === 'string'
    && 'result' in value && (value.result === null || isRulet4Result(value.result))
}
