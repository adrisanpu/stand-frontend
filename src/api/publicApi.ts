import type { StackConfig, StackPlacement } from '../games/stack/stackLogic'
import type { ParticipantAppearance } from '../core/theme/appearance'
import type { GamePrize, PrizeCatalog } from '../core/prizes'
import { isRulet4Result, type Rulet4Settings, type Rulet4Result, type Rulet4Assignment } from '../games/rulet4/rulet4Logic'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

export class PublicApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string, public readonly retryAfter?: number) {
    super(message)
    this.name = 'PublicApiError'
  }
}

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
    const code = (data as { code?: string; error?: string }).code ?? (data as { error?: string }).error
    const msg = typeof code === 'string' && code.startsWith('Kivly')
      ? 'No se pudo confirmar tu registro en el club. Consulta al equipo del evento.'
      : (data as { error?: string; message?: string; reason?: string }).message
      || (data as { error?: string }).error
      || (data as { reason?: string }).reason
      || `HTTP ${response.status}`
    const retryAfter = Number(response.headers?.get('Retry-After') ?? (data as { retryAfter?: number }).retryAfter)
    throw new PublicApiError(msg, response.status, code, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined)
  }
  return data as T
}

function isSafeWalletUrl(value: string | null | undefined): boolean {
  if (value == null) return true
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && !url.username && !url.password
      && (!url.port || url.port === '443')
      && (host === 'pay.google.com' || host === 'wallet.google.com'
        || host === 'getkivly.com' || host.endsWith('.getkivly.com')
        || host === 'kivly.com' || host.endsWith('.kivly.com'))
  } catch {
    return false
  }
}

export type ParticipantFieldsConfig = {
  email?: { required?: boolean }
  phone?: { required?: boolean; enabled?: boolean }
}

export type PublicRankingEntry = {
  playerId: number
  username?: string
  profilePicUrl?: string | null
  timer?: number
  score: number
  rank: number
}

export type PublicGameResponse = {
  ok: boolean
  gameId: string
  gameName?: string
  clientLogoUrl?: string | null
  appearance?: ParticipantAppearance
  gameType: string
  isActive: boolean
  playMode?: 'master' | 'mobile'
  joinChannel?: string
  participantFields?: ParticipantFieldsConfig
  loyalty?: {
    clubName: string
    privacyUrl: string
    termsUrl: string
    consentVersion: string
  }
  prizeCatalog?: PrizeCatalog
  playerCount: number
  validatedCount: number
  recentPairs: Array<{ label: string; characterNames: string[]; validatedAt: string }>
  ranking?: PublicRankingEntry[]
  stackConfig?: StackConfig
  rulet4Config?: Rulet4Settings
  kivlyReward?: { name: string }
  stackStartSnapshot?: boolean
  stackFinishSupported?: boolean
  stackPrizeState?: 'open' | 'closing' | 'closed'
  stackPrizeRules?: import('./stackPrizes').StackPrizePromotion[]
  joinUrl: string
}

export type Empareja2Assignment = {
  playerId: number
  participantName?: string
  characterId: number
  characterName: string
  partnerCharacterName: string
  profilePicUrl?: string | null
  characterImageUrl?: string | null
  partnerCharacterImageUrl?: string | null
  validationCode: number
  validated: boolean
}

export type T1merAssignment = {
  playerId: number
  displayName: string
  validationCode?: number
  validated: boolean
  profilePicUrl?: string | null
  /** Present when the player already submitted their one score. */
  score?: number
  timer?: number
}

export type StackAttempt = {
  attemptId: string
  status: 'started' | 'finished' | 'excluded'
  startedAt: string
  configVersion: '1'
  finishedAt?: string
}

export type StackAssignment = {
  gameType: 'STACK'
  playerId: number
  displayName: string
  profilePicUrl?: string | null
  attempt: StackAttempt | null
  score?: number
  rank?: number | null
}

export type KivlyCompletionReward = {
  status: 'none' | 'pending' | 'confirmed'
  name?: string
  appleWalletUrl?: string | null
  googleWalletUrl?: string | null
}

export type ImpostorParticipantState = {
  phase: 'lobby' | 'word_round' | 'voting' | 'result' | 'finished'
  round: number
  inRound: boolean
  role: 'impostor' | 'crew' | null
  word: string | null
  currentTurn: { isMine: boolean; name: string } | null
  winner: 'impostor' | 'crew' | null
  won: boolean | null
}

export type ImpostorAssignment = T1merAssignment & {
  impostor?: ImpostorParticipantState
}

export type PlayerAssignment = Empareja2Assignment | T1merAssignment | StackAssignment | ImpostorAssignment | Rulet4Assignment

export function isStackAssignment(assignment: PlayerAssignment): assignment is StackAssignment {
  return 'gameType' in assignment && assignment.gameType === 'STACK'
}

export type StackStartResponse = {
  ok: true
  gameId: string
  playerId: number
  attemptId: string
  status: 'started'
  configVersion: '1'
  startedAt: string
  configSnapshot: StackConfig
}

export type StackFinishResponse = {
  ok: true
  gameId: string
  playerId: number
  attemptId: string
  status: 'finished'
  configVersion: '1'
  score: number
  scoreUpdatedAt: string
  rank: number | null
}

export type JoinResponse = {
  ok: boolean
  gameId: string
  gameType: string
  playerToken: string
  assignment: PlayerAssignment
  alreadyJoined?: boolean
}

type ParticipantPhotoUploadUrlResponse = {
  ok: true
  uploadUrl: string
  uploadFields: Record<string, string>
  photoKey: string
}

type ParticipantPhotoCompleteResponse = {
  ok: true
  profilePicUrl: string
}

const PARTICIPANT_PHOTO_MAX_BYTES = 5 * 1024 * 1024
const PARTICIPANT_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function uploadParticipantPhoto(file: File, playerToken: string): Promise<string> {
  if (!PARTICIPANT_PHOTO_TYPES.has(file.type) || file.size <= 0 || file.size > PARTICIPANT_PHOTO_MAX_BYTES) {
    throw new Error('La foto debe ser JPG, PNG o WebP y no superar 5 MB.')
  }

  const upload = await publicRequest<ParticipantPhotoUploadUrlResponse>('/v1/public/player/photo', {
    method: 'POST',
    body: JSON.stringify({
      action: 'upload-url',
      playerToken,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  })
  const formData = new FormData()
  for (const [name, value] of Object.entries(upload.uploadFields)) formData.append(name, value)
  formData.append('file', file)
  const response = await fetch(upload.uploadUrl, { method: 'POST', body: formData })
  if (!response.ok) throw new Error(`No se pudo subir la foto (HTTP ${response.status}).`)

  const completed = await publicRequest<ParticipantPhotoCompleteResponse>('/v1/public/player/photo', {
    method: 'POST',
    body: JSON.stringify({ action: 'complete', playerToken, photoKey: upload.photoKey }),
  })
  return completed.profilePicUrl
}

export type EmailRegistration = {
  gameId: string
  email?: string
  username: string
  phone?: string
  consent: boolean
  loyaltyConsentVersion?: string
  language?: 'es' | 'en'
}

export type EmailChallengeResponse = {
  ok: true
  challengeId: string
  emailMasked: string
  expiresAt: string
  resendAvailableAt: string
}

export type JoinRequest =
  | (Omit<EmailRegistration, 'language'> & { challengeId?: never; code?: never })
  | { gameId: string; challengeId: string; code: string; consent?: boolean; email?: never; username?: never; phone?: never }

export type ValidateResponse = {
  valid: boolean
  gameId: string
  message?: string
  players?: Array<{
    playerId: number
    username?: string
    characterName?: string
    characterImageUrl?: string | null
  }>
}

export type PrizeKind = 'validation' | 'raffle' | 'ranking'

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
  prizeCatalog?: PrizeCatalog
  stackPrizes?: import('./stackPrizes').StackPlayerPrizes
}

export type RedeemResponse = {
  ok: boolean
  gameId: string
  playerId: number
  kind: PrizeKind | 'award'
  delivered: boolean
  label?: string
  prize?: GamePrize | null
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
  async completionReward(gameId: string, playerToken: string): Promise<KivlyCompletionReward> {
    const data = await publicRequest<{ ok: boolean; reward: KivlyCompletionReward }>('/v1/public/kivly/reward', {
      method: 'POST',
      body: JSON.stringify({ gameId, playerToken }),
    })
    if (data?.ok !== true || !data.reward
      || !['none', 'pending', 'confirmed'].includes(data.reward.status)
      || (data.reward.status !== 'none' && typeof data.reward.name !== 'string')
      || !isSafeWalletUrl(data.reward.appleWalletUrl)
      || !isSafeWalletUrl(data.reward.googleWalletUrl)) {
      throw new Error('Invalid Kivly completion reward response')
    }
    return data.reward
  },
  async spinRulet4(gameId: string, playerToken: string): Promise<Rulet4Result> {
    const response = await publicRequest<{ ok?: boolean; result?: unknown }>('/v1/public/rulet4/spin', {
      method: 'POST',
      body: JSON.stringify({ gameId, playerToken }),
    })
    if (response.ok !== true || !isRulet4Result(response.result)) throw new Error('Invalid RULET4 result')
    return response.result
  },
  getGame: (gameId: string) =>
    publicRequest<PublicGameResponse>(`/v1/public/game?gameId=${encodeURIComponent(gameId)}`),

  requestEmailCode: (body: EmailRegistration) =>
    publicRequest<EmailChallengeResponse>('/v1/public/email/request', { method: 'POST', body: JSON.stringify(body) }),

  join: (body: JoinRequest) =>
    publicRequest<JoinResponse>('/v1/public/join', { method: 'POST', body: JSON.stringify(body) }),

  uploadParticipantPhoto,

  validate: (body: { gameId: string; playerToken: string; codes: string[] }) =>
    publicRequest<ValidateResponse>('/v1/public/validate', { method: 'POST', body: JSON.stringify(body) }),

  score: (body: { gameId: string; playerToken: string; timer: string; score: number }) =>
    publicRequest<PublicScoreResponse>('/v1/public/score', { method: 'POST', body: JSON.stringify(body) }),

  startStackAttempt: (body: { gameId: string; playerToken: string; attemptId: string }) =>
    publicRequest<StackStartResponse>('/v1/public/score', {
      method: 'POST',
      body: JSON.stringify({ ...body, action: 'start' }),
    }),

  finishStackAttempt: (body: { gameId: string; playerToken: string; attemptId: string; placements: readonly StackPlacement[] }) =>
    publicRequest<StackFinishResponse>('/v1/public/score', {
      method: 'POST',
      body: JSON.stringify({ ...body, action: 'finish' }),
    }),

  getPlayer: (playerToken: string, gameId?: string) =>
    publicRequest<PlayerResponse>('/v1/public/player', {
      method: 'POST',
      body: JSON.stringify({ gameId, playerToken }),
    }),

  redeem: async (prizeToken: string, gameId?: string): Promise<RedeemResponse> => {
    const url = `${API_BASE_URL}/v1/public/redeem`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prizeToken, ...(gameId ? { gameId } : {}) }),
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
