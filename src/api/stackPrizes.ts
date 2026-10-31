import { api } from './api'

export type StackPrizeCondition = 'completed' | 'top_finish' | 'top_final' | 'raffle' | 'score'
export type StackPrizeScoreOperator = '>' | '>=' | '=' | '<=' | '<' | 'between'
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
  groups: { allocations: { prizeId: string; quantity: number }[] }[]
  topX?: number
  scoreOperator?: StackPrizeScoreOperator
  scoreValue?: number
  scoreMaxValue?: number
}
export type StackPrizePromotion = {
  condition: StackPrizeCondition
  topX?: number
  scoreOperator?: StackPrizeScoreOperator
  scoreValue?: number
  scoreMaxValue?: number
  names: string[]
  prizes?: { id: string; name: string; imageUrl?: string | null }[]
}
export type StackPrizeProgram = {
  version: 3
  catalog: StackPrizeItem[]
  rules: StackPrizeRule[]
  storefrontUrl: string
  deliveryChannel?: 'wallet' | 'email'
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
  deliveryChannel?: 'wallet' | 'email'
  emailState?: 'pending' | 'sending' | 'accepted' | 'failed' | 'reconciliation_required' | null
  emailError?: string | null
}
export type StackPlayerPrizes = {
  awards: StackAward[]
  walletUrl: string | null
  walletExpected?: boolean
  deliveryChannel?: 'wallet' | 'email'
  state: 'open' | 'closing' | 'closed'
  finalPrizesPending: boolean
}
export type StackPrizeSettingsResponse = {
  ok: true
  enabled: boolean
  emailAvailable?: boolean
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
    if (data.ok !== true || data.program?.version !== 3) throw new Error('Invalid Stack prize response')
    return data.program
  },
  close: (gameId: string, excludePlayerIds: number[] = []) =>
    api.post<StackPrizeSettingsResponse>('/v1/game/stack/prizes', { gameId, excludePlayerIds }),
  retryEmail: (gameId: string, awardId: string) =>
    api.post<StackPrizeSettingsResponse>('/v1/game/stack/prizes', { gameId, action: 'retry_email', awardId }),
}
