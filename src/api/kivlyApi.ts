import { api } from './api'

export type KivlySettings = {
  enabled: boolean
  clubName: string
  privacyUrl: string
  termsUrl: string
}

export type KivlyClubSettings = Omit<KivlySettings, 'enabled'>

export type KivlyConnection = {
  connected: boolean
}

export type KivlyAccountConnection = KivlyConnection & {
  locationId: string | null
  locations: { id: string; name: string }[]
  clubSettings?: KivlyClubSettings | null
}

export type KivlyReward = { id: string; name: string }

export const kivlyApi = {
  async getReward(gameId: string): Promise<KivlyReward | null> {
    const data = await api.get<{ ok: boolean; reward?: KivlyReward | null }>(
      `/v1/game/kivly?gameId=${encodeURIComponent(gameId)}`,
    )
    if (data?.ok !== true || (data.reward != null
      && (typeof data.reward.id !== 'string' || !data.reward.id
        || typeof data.reward.name !== 'string' || !data.reward.name))) {
      throw new Error('Invalid Kivly reward response')
    }
    return data.reward ?? null
  },
  async listRewards(gameId: string): Promise<KivlyReward[]> {
    const data = await api.get<{ ok: boolean; rewards: KivlyReward[] }>(
      `/v1/game/kivly/rewards?gameId=${encodeURIComponent(gameId)}`,
    )
    if (data?.ok !== true || !Array.isArray(data.rewards)
      || !data.rewards.every((reward) => typeof reward?.id === 'string' && !!reward.id
        && typeof reward.name === 'string' && !!reward.name)) {
      throw new Error('Invalid Kivly rewards response')
    }
    return data.rewards
  },
  async saveReward(gameId: string, rewardId: string | null) {
    const data = await api.put<{ ok: boolean }>('/v1/game/kivly', { gameId, rewardId })
    if (data?.ok !== true) throw new Error('Kivly reward not confirmed')
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
          typeof data.connection.clubSettings?.[key] === 'string'))) {
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
