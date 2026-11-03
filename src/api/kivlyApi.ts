import { api } from './api'

export type KivlySettings = {
  enabled: boolean
  clubName: string
  privacyUrl: string
  termsUrl: string
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

export type KivlyRegistrationReview = {
  requestId: string
  username: string
  email: string
  phone: string | null
  customer: { name: string | null; email: string | null; phone: string | null }
  state: 'review_required'
}

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

export type KivlyRewardDetail = {
  id: string
  title: string
  description: string
  rewardType: KivlyRewardDraft['rewardType']
  value: number
  pointsRequired: number
  image: string | null
  termsAndConditions: string | null
  validFrom: string | null
  validUntil: string | null
  maxRedemptions: number | null
  maxRedemptionsPerUser: number | null
}

export type KivlyRewardUpdate = Pick<KivlyRewardDraft,
  'title' | 'description' | 'rewardType' | 'value' | 'pointsRequired'> & {
    image: string | null
    termsAndConditions: string | null
    validFrom: string | null
    validUntil: string | null
    maxRedemptions: number | null
    maxRedemptionsPerUser: number | null
  }

export const kivlyApi = {
  async listRegistrationReviews(gameId: string): Promise<KivlyRegistrationReview[]> {
    const data = await api.get<{ requests: KivlyRegistrationReview[] }>(
      `/v1/game/kivly/registrations?gameId=${encodeURIComponent(gameId)}`,
    )
    if (!Array.isArray(data?.requests) || !data.requests.every((item) =>
      typeof item?.requestId === 'string' && !!item.requestId
      && item.state === 'review_required' && typeof item.username === 'string'
      && typeof item.email === 'string'
      && (item.phone === null || typeof item.phone === 'string')
      && item.customer && ['name', 'email', 'phone'].every((key) => {
        const value = item.customer[key as keyof typeof item.customer]
        return value === null || typeof value === 'string'
      }))) {
      throw new Error('Invalid Kivly registration reviews response')
    }
    return data.requests
  },
  async approveRegistration(gameId: string, requestId: string): Promise<void> {
    const data = await api.post<{ ok: boolean }>(
      `/v1/game/kivly/registrations?gameId=${encodeURIComponent(gameId)}`, { requestId },
    )
    if (data?.ok !== true) throw new Error('Kivly registration approval not confirmed')
  },
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
  async getReward(gameId: string, rewardId: string): Promise<KivlyRewardDetail> {
    const data = await api.get<{ ok: boolean; reward: KivlyRewardDetail }>(
      `/v1/game/kivly/rewards?gameId=${encodeURIComponent(gameId)}&rewardId=${encodeURIComponent(rewardId)}`,
    )
    const reward = data?.reward
    if (data?.ok !== true || reward?.id !== rewardId || typeof reward.title !== 'string'
      || typeof reward.description !== 'string'
      || !['discount_percentage', 'discount_fixed', 'free_item'].includes(reward.rewardType)
      || typeof reward.value !== 'number' || !Number.isFinite(reward.value)
      || !Number.isInteger(reward.pointsRequired) || reward.pointsRequired < 0
      || (reward.image !== null && typeof reward.image !== 'string')
      || (reward.termsAndConditions !== null && typeof reward.termsAndConditions !== 'string')
      || (reward.validFrom !== null && typeof reward.validFrom !== 'string')
      || (reward.validUntil !== null && typeof reward.validUntil !== 'string')
      || (reward.maxRedemptions !== null && (!Number.isInteger(reward.maxRedemptions) || reward.maxRedemptions < 1))
      || (reward.maxRedemptionsPerUser !== null
        && (!Number.isInteger(reward.maxRedemptionsPerUser) || reward.maxRedemptionsPerUser < 1))) {
      throw new Error('Invalid Kivly reward detail response')
    }
    return reward
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
  async updateReward(gameId: string, rewardId: string, reward: KivlyRewardUpdate): Promise<KivlyReward> {
    const data = await api.put<{ ok: boolean; reward: KivlyReward }>(
      '/v1/game/kivly/rewards', { gameId, rewardId, ...reward },
    )
    if (data?.ok !== true || data.reward?.id !== rewardId
      || typeof data.reward.name !== 'string' || !data.reward.name) {
      throw new Error('Invalid Kivly reward update response')
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
