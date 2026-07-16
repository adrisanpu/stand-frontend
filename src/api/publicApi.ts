const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

async function publicRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = (data as { error?: string; message?: string; reason?: string }).message
      || (data as { error?: string }).error
      || (data as { reason?: string }).reason
      || `HTTP ${response.status}`
    throw new Error(msg)
  }
  return data as T
}

export type ParticipantFieldsConfig = {
  email?: { required?: boolean }
  instagram?: { required?: boolean }
}

export type PublicRankingEntry = {
  playerId: number
  username?: string
  timer: number
  score: number
  rank: number
}

export type PublicGameResponse = {
  ok: boolean
  gameId: string
  gameName?: string
  gameType: string
  isActive: boolean
  joinChannel?: string
  participantFields?: ParticipantFieldsConfig
  playerCount: number
  validatedCount: number
  recentPairs: Array<{ label: string; characterNames: string[]; validatedAt: string }>
  ranking?: PublicRankingEntry[]
  joinUrl: string
}

export type Empareja2Assignment = {
  playerId: number
  characterId: number
  characterName: string
  partnerCharacterName: string
  characterImageUrl?: string | null
  validationCode: number
  validated: boolean
}

export type T1merAssignment = {
  playerId: number
  displayName: string
  validationCode?: number
  validated: boolean
}

export type PlayerAssignment = Empareja2Assignment | T1merAssignment

export type JoinResponse = {
  ok: boolean
  gameId: string
  gameType: string
  playerToken: string
  assignment: PlayerAssignment
  alreadyJoined?: boolean
}

export type ValidateResponse = {
  valid: boolean
  gameId: string
  message?: string
  players?: Array<{
    playerId: number
    instagramUsername?: string
    characterName?: string
    characterImageUrl?: string | null
  }>
}

export type PrizeKind = 'validation' | 'raffle'

export type PlayerPrize = {
  kind: PrizeKind
  token: string
  delivered: boolean
}

export type PlayerResponse = {
  ok: boolean
  gameId: string
  gameType: string
  playerToken: string
  assignment: PlayerAssignment | null
  prizes: PlayerPrize[]
}

export type RedeemResponse = {
  ok: boolean
  gameId: string
  playerId: number
  kind: PrizeKind
  delivered: boolean
  label?: string
  error?: string
}

export type PublicScoreResponse = {
  ok: boolean
  gameId?: string
  playerId?: number
  timer?: number
  score?: number
  rank?: number | null
  error?: string
  message?: string
}

export const publicApi = {
  getGame: (gameId: string) =>
    publicRequest<PublicGameResponse>(`/v1/public/game?gameId=${encodeURIComponent(gameId)}`),

  join: (body: { gameId: string; email: string; instagram?: string; consent: boolean }) =>
    publicRequest<JoinResponse>('/v1/public/join', { method: 'POST', body: JSON.stringify(body) }),

  validate: (body: { gameId: string; playerToken: string; codes: string[] }) =>
    publicRequest<ValidateResponse>('/v1/public/validate', { method: 'POST', body: JSON.stringify(body) }),

  score: (body: { gameId: string; playerToken: string; timer: string; score: number }) =>
    publicRequest<PublicScoreResponse>('/v1/public/score', { method: 'POST', body: JSON.stringify(body) }),

  getPlayer: (playerToken: string, gameId?: string) => {
    const qs = new URLSearchParams({ playerToken })
    if (gameId) qs.set('gameId', gameId)
    return publicRequest<PlayerResponse>(`/v1/public/player?${qs.toString()}`)
  },

  redeem: async (prizeToken: string): Promise<RedeemResponse> => {
    const url = `${API_BASE_URL}/v1/public/redeem`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prizeToken }),
    })
    const data = (await response.json().catch(() => ({}))) as RedeemResponse & { error?: string; message?: string }
    if (!response.ok) {
      const err = new Error(data.error || data.message || `HTTP ${response.status}`) as Error & { status?: number }
      err.status = response.status
      throw err
    }
    return data
  },
}
