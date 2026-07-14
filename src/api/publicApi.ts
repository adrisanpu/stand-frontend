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

export type JoinResponse = {
  ok: boolean
  gameId: string
  gameType: string
  playerToken: string
  assignment: Empareja2Assignment
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

export const publicApi = {
  getGame: (gameId: string) =>
    publicRequest<PublicGameResponse>(`/v1/public/game?gameId=${encodeURIComponent(gameId)}`),

  join: (body: { gameId: string; email: string; instagram?: string; consent: boolean }) =>
    publicRequest<JoinResponse>('/v1/public/join', { method: 'POST', body: JSON.stringify(body) }),

  validate: (body: { gameId: string; playerToken: string; codes: string[] }) =>
    publicRequest<ValidateResponse>('/v1/public/validate', { method: 'POST', body: JSON.stringify(body) }),

  getPlayer: (playerToken: string, gameId?: string) => {
    const qs = new URLSearchParams({ playerToken })
    if (gameId) qs.set('gameId', gameId)
    return publicRequest<{ ok: boolean; assignment: Empareja2Assignment; playerToken: string }>(
      `/v1/public/player?${qs.toString()}`
    )
  },
}
