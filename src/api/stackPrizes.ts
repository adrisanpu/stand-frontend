import { api } from './api'

export type StackPrizeCondition = 'completed' | 'top_finish' | 'top_final' | 'raffle'
export type StackPrizeItem = {
  id: string
  source: 'stand' | 'kivly'
  name: string
  imageKey?: string | null
  imageUrl?: string | null
  limit?: number | null
  stockTotal: number
  rewardId?: string
  locationId?: string
}
export type StackPrizeRule = {
  id: string
  condition: StackPrizeCondition
  mode: 'all' | 'random_one'
  allocations: { prizeId: string; quantity: number }[]
  topX?: number
}
export type StackPrizeProgram = {
  version: 2
  catalog: StackPrizeItem[]
  rules: StackPrizeRule[]
  storefrontUrl: string
}
export type StackAward = {
  id: string
  source: 'stand' | 'kivly'
  name: string
  imageUrl?: string | null
  condition: StackPrizeCondition
  state: 'available' | 'delivered' | 'queued' | 'sending' | 'confirmed' | 'reconciliation_required' | 'connection_required'
  token?: string | null
  lastError?: string | null
  lastErrorStage?: string | null
  lastErrorHttpStatus?: number | null
}
export type StackPlayerPrizes = {
  awards: StackAward[]
  walletUrl: string | null
  walletExpected?: boolean
  state: 'open' | 'closing' | 'closed'
  finalPrizesPending: boolean
}
export type StackPrizeSettingsResponse = {
  ok: true
  enabled: boolean
  program: StackPrizeProgram
  state: StackPlayerPrizes['state']
  pendingPlayers: { playerId: number; name: string }[]
  awards: (Omit<StackAward, 'token'> & { playerId: number })[]
  inventory: { prizeId: string; total: number; remaining: number }[]
  allocations: { playerId: number; ruleId: string; awarded: { prizeId: string; quantity: number; name: string }[]; state: 'allocated' | 'out_of_stock' | 'not_eligible' }[]
}
export const stackPrizeApi = {
  get: (gameId: string) => api.get<StackPrizeSettingsResponse>(`/v1/game/stack/prizes?gameId=${encodeURIComponent(gameId)}`),
  async save(gameId: string, program: StackPrizeProgram) {
    const data = await api.put<{ ok: boolean; program: StackPrizeProgram }>('/v1/game/stack/prizes', { gameId, program })
    if (data.ok !== true || data.program?.version !== 2) throw new Error('Invalid Stack prize response')
    return data.program
  },
  close: (gameId: string, excludePlayerIds: number[] = []) =>
    api.post<StackPrizeSettingsResponse>('/v1/game/stack/prizes', { gameId, excludePlayerIds }),
}
