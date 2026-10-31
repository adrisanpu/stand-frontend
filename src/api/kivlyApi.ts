import { api } from './api'

export type KivlySettings = {
  enabled: boolean
  clubName: string
  privacyUrl: string
  termsUrl: string
  bypassValidation?: boolean
}

export type KivlyClubSettings = Omit<KivlySettings, 'enabled'> & { storefrontUrl?: string }

export type KivlyConnection = {
  connected: boolean
}

export type KivlyAccountConnection = KivlyConnection & {
  locationId: string | null
  locations: { id: string; name: string }[]
  clubSettings?: KivlyClubSettings | null
}

export type KivlyReward = { id: string; name: string; imageUrl?: string }

export type KivlyRewardDraft = {
  title: string
  description: string
  rewardType: 'discount_percentage' | 'discount_fixed' | 'free_item'
  value: number
  pointsRequired: number
  image?: string
  termsAndConditions?: string
  validFrom?: string
  validUntil?: string
  maxRedemptions?: number
  maxRedemptionsPerUser?: number
}

export const kivlyApi = {
  async listRewards(gameId: string): Promise<KivlyReward[]> {
    const data = await api.get<{ ok: boolean; rewards: KivlyReward[] }>(
      `/v1/game/kivly/rewards?gameId=${encodeURIComponent(gameId)}`,
    )
    if (data?.ok !== true || !Array.isArray(data.rewards)
      || !data.rewards.every((reward) => typeof reward?.id === 'string' && !!reward.id
        && typeof reward.name === 'string' && !!reward.name
        && (reward.imageUrl === undefined || typeof reward.imageUrl === 'string'))) {
      throw new Error('Invalid Kivly rewards response')
    }
    return data.rewards
  },
  async createReward(gameId: string, reward: KivlyRewardDraft): Promise<KivlyReward> {
    const data = await api.post<{ ok: boolean; reward: KivlyReward }>(
      '/v1/game/kivly/rewards', { gameId, ...reward },
    )
    if (data?.ok !== true || typeof data.reward?.id !== 'string' || !data.reward.id
      || typeof data.reward.name !== 'string' || !data.reward.name) {
      throw new Error('Invalid Kivly reward creation response')
    }
    return data.reward
  },
  async getAccountConnection(): Promise<KivlyAccountConnection> {
    const data = await api.get<{ ok: boolean; connection: KivlyAccountConnection }>('/v1/kivly')
    if (data?.ok !== true || typeof data.connection?.connected !== 'boolean'
      || !Array.isArray(data.connection.locations)
      || !data.connection.locations.every((location) =>
        typeof location?.id === 'string' && !!location.id.trim()
        && typeof location.name === 'string' && !!location.name.trim())
      || (data.connection.connected
        ? typeof data.connection.locationId !== 'string'
          || !data.connection.locations.some((location) => location.id === data.connection.locationId)
        : data.connection.locationId !== null || data.connection.locations.length !== 0)
      || (data.connection.clubSettings != null
        && !(['clubName', 'privacyUrl', 'termsUrl'] as const).every((key) =>
          typeof data.connection.clubSettings?.[key] === 'string'))
      || (data.connection.clubSettings?.storefrontUrl != null
        && typeof data.connection.clubSettings.storefrontUrl !== 'string')) {
      throw new Error('Invalid Kivly connection response')
    }
    return data.connection
  },
  async saveClubSettings(clubSettings: KivlyClubSettings) {
    const result = await api.put<{ ok: boolean }>('/v1/kivly', { clubSettings })
    if (result?.ok !== true) throw new Error('Kivly club settings not confirmed')
  },
  async connectAccount(clientId: string, clientSecret: string) {
    const result = await api.put<{ ok: boolean; warning?: string }>('/v1/kivly', { clientId, clientSecret })
    if (result?.ok !== true) throw new Error('Kivly connection not confirmed')
    return result.warning === 'KivlySecretCleanupRequired'
  },
  async disconnectAccount() {
    const result = await api.delete<{ ok: boolean; warning?: string }>('/v1/kivly')
    if (result?.ok !== true) throw new Error('Kivly disconnection not confirmed')
    return result.warning === 'KivlySecretCleanupRequired'
  },
}
