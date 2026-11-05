import { api } from './api'

export type PrizeBalance = {
  available: number
  initialized: boolean
  assigned: number
  redeemed: number
  historicalAssigned: number
  historicalRedeemed: number
  revision: number
}
export type InventoryPrize = {
  id: string
  name: string
  source: 'stand' | 'kivly'
  imageUrl?: string | null
  games: { gameId: string; name: string; active: boolean; limit: number | null }[]
  inventory: PrizeBalance
  canjeados: number | null
}
export type PrizeInventory = {
  ok: true
  mode: 'legacy' | 'active'
  unresolved: number
  imports: Record<string, boolean>
  catalog: InventoryPrize[]
}
export type PrizeMovement = {
  key: string
  prizeId: string
  kind: 'assignment' | 'initialize' | 'replenish' | 'adjust'
  quantity: number
  reason?: string
  createdAt: string
  historical: boolean
  gameId?: string
  gameName?: string
  name?: string
  source?: string
  units?: Record<string, { state: string; condition: string; deliveredAt?: string }>
}
export type InventoryChange = {
  action: 'initialize' | 'replenish' | 'adjust'
  prizeId: string
  quantity: number
  reason: string
  requestId: string
  expectedRevision: number
}

export const prizeInventoryApi = {
  async get() {
    const data = await api.get<PrizeInventory>('/v1/prizes/inventory')
    if (data?.ok !== true || !['legacy', 'active'].includes(data.mode)
      || !Array.isArray(data.catalog) || !data.imports || !Number.isSafeInteger(data.unresolved)) {
      throw new Error('Invalid prize inventory response')
    }
    return data
  },
  async movements(prizeId: string, cursor?: string) {
    const query = new URLSearchParams({ prizeId })
    if (cursor) query.set('cursor', cursor)
    const data = await api.get<{ ok: true; items: PrizeMovement[]; cursor: string | null }>(
      `/v1/prizes/inventory?${query}`,
    )
    if (data?.ok !== true || !Array.isArray(data.items)
      || !(data.cursor === null || typeof data.cursor === 'string')) throw new Error('Invalid movements response')
    return data
  },
  async change(payload: InventoryChange) {
    const data = await api.post<{ ok: true; inventory: PrizeBalance }>('/v1/prizes/inventory', payload)
    if (data?.ok !== true || !data.inventory || !Number.isSafeInteger(data.inventory.revision)) {
      throw new Error('Inventory update not confirmed')
    }
    return data.inventory
  },
  async importHistory(gameId: string, cursor?: string) {
    const data = await api.post<{ ok: true; cursor: string | null; unresolved: number }>(
      '/v1/prizes/inventory', { action: 'import', gameId, ...(cursor ? { cursor } : {}) },
    )
    if (data?.ok !== true || !(data.cursor === null || typeof data.cursor === 'string')
      || !Number.isSafeInteger(data.unresolved)) throw new Error('History import not confirmed')
    return data
  },
  async activate() {
    const data = await api.post<{ ok: true }>('/v1/prizes/inventory', { action: 'activate' })
    if (data?.ok !== true) throw new Error('Inventory activation not confirmed')
  },
}
