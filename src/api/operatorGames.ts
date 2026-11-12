import { api } from './api'
import { normalizeGameType } from '../core/gameTypeMap'
import { getGameById } from '../games'
import type { PrizeCatalog } from '../core/prizes'

export const SETUP_REVIEW_SECTIONS = ['appearance', 'configuration', 'form', 'questionnaire', 'conditions', 'prizes'] as const
export type SetupReviewSection = typeof SETUP_REVIEW_SECTIONS[number]
export type SetupReviewProgress = {
  version: 1
  revision: string
  confirmedSections: SetupReviewSection[]
  completed: boolean
}

function isSetupReviewProgress(value: unknown): value is SetupReviewProgress {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const progress = value as Partial<SetupReviewProgress>
  return progress.version === 1 && typeof progress.revision === 'string' && !!progress.revision.trim()
    && typeof progress.completed === 'boolean' && Array.isArray(progress.confirmedSections)
    && progress.confirmedSections.every(section => SETUP_REVIEW_SECTIONS.includes(section))
    && new Set(progress.confirmedSections).size === progress.confirmedSections.length
    && (!progress.completed || progress.confirmedSections.length === SETUP_REVIEW_SECTIONS.length)
}

export type OperatorGame = {
  gameId: string
  gameName: string
  gameType: string
  createdAt?: string
  playerCount?: number
  isActive?: boolean
  stackPrizeState?: 'open' | 'closing' | 'closed'
  lifecycleState?: 'active' | 'closing' | 'inactive'
  archivedAt?: string
  deletionStartedAt?: string
  /** Absent on legacy events, which are exempt from initial review. */
  setupReview?: SetupReviewProgress
}

function isOperatorGame(value: unknown): value is OperatorGame {
  return typeof value === 'object' && value !== null
    && 'gameId' in value && typeof value.gameId === 'string' && !!value.gameId.trim()
    && 'gameName' in value && typeof value.gameName === 'string' && !!value.gameName.trim()
    && 'gameType' in value && typeof value.gameType === 'string'
    && !!value.gameType.trim() && getGameById(normalizeGameType(value.gameType)) !== undefined
    && (!('createdAt' in value) || (typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))))
    && (!('playerCount' in value) || (typeof value.playerCount === 'number' && Number.isSafeInteger(value.playerCount) && value.playerCount >= 0))
    && (!('isActive' in value) || typeof value.isActive === 'boolean')
    && (!('stackPrizeState' in value) || ['open', 'closing', 'closed'].includes(String(value.stackPrizeState)))
    && (!('lifecycleState' in value) || ['active', 'closing', 'inactive'].includes(String(value.lifecycleState)))
    && (!('archivedAt' in value) || (typeof value.archivedAt === 'string' && Number.isFinite(Date.parse(value.archivedAt))))
    && (!('deletionStartedAt' in value) || (typeof value.deletionStartedAt === 'string' && Number.isFinite(Date.parse(value.deletionStartedAt))))
    && (!('archivedAt' in value) || ('isActive' in value && value.isActive === false))
    && (!('deletionStartedAt' in value) || 'archivedAt' in value)
    && (!('setupReview' in value) || isSetupReviewProgress(value.setupReview))
}

type SetupReviewUpdate =
  | { section: SetupReviewSection; confirmed: boolean; expectedRevision: string }
  | { finish: true; expectedRevision: string }

async function saveSetupReview(gameId: string, update: SetupReviewUpdate): Promise<SetupReviewProgress> {
  const data = await api.put<{ ok?: boolean; gameId?: string; setupReview?: unknown }>('/v1/game', {
    gameId, setupReview: update,
  })
  if (data?.ok !== true || data.gameId !== gameId || !isSetupReviewProgress(data.setupReview)
    || data.setupReview.revision === update.expectedRevision
    || ('finish' in update ? !data.setupReview.completed
      : data.setupReview.confirmedSections.includes(update.section) !== update.confirmed
        || (!update.confirmed && data.setupReview.completed))) {
    throw new Error('Setup review update not confirmed')
  }
  return data.setupReview
}

export async function updateSetupReview(
  gameId: string, section: SetupReviewSection, confirmed: boolean, expectedRevision: string,
): Promise<SetupReviewProgress> {
  return saveSetupReview(gameId, { section, confirmed, expectedRevision })
}

export async function finishSetupReview(gameId: string, expectedRevision: string): Promise<SetupReviewProgress> {
  return saveSetupReview(gameId, { finish: true, expectedRevision })
}

export async function listOperatorGames(archived = false): Promise<OperatorGame[]> {
  const data = await api.get<{ ok: boolean; games: unknown }>(archived ? '/v1/game?archived=true' : '/v1/game')
  if (data?.ok !== true || !Array.isArray(data.games) || !data.games.every(isOperatorGame)
    || data.games.some(game => !!game.archivedAt !== archived)
    || new Set(data.games.map(game => game.gameId)).size !== data.games.length) {
    throw new Error('Invalid operator games response')
  }
  return data.games
}

export async function getOperatorGame(gameId: string): Promise<OperatorGame> {
  const data = await api.get<{ ok: boolean; game: unknown }>(
    `/v1/game?gameId=${encodeURIComponent(gameId)}`,
  )
  if (data?.ok !== true || !isOperatorGame(data.game) || data.game.gameId !== gameId) {
    throw new Error('Invalid operator game response')
  }
  return data.game
}

export type OperatorGameConfiguration = {
  ok: true
  game: OperatorGame & { type?: Record<string, unknown>; maxPlayers?: number }
  configuration: Record<string, unknown>
  prizeCatalog?: PrizeCatalog
  rewardConditionsRevision: string
  empareja2CatalogPairCount?: number
}

export async function getOperatorGameConfiguration(gameId: string): Promise<OperatorGameConfiguration> {
  const data = await api.get<OperatorGameConfiguration>(`/v1/game?gameId=${encodeURIComponent(gameId)}&configuration=true`)
  if (data?.ok !== true || !isOperatorGame(data.game) || data.game.gameId !== gameId
    || !data.game.lifecycleState || typeof data.game.isActive !== 'boolean'
    || typeof data.configuration !== 'object' || data.configuration === null || Array.isArray(data.configuration)
    || typeof data.rewardConditionsRevision !== 'string') {
    throw new Error('Invalid event configuration response')
  }
  return data
}

export async function saveRankingCondition(gameId: string, rankingTopX: number, expectedRevision: string): Promise<string> {
  const data = await api.put<{ ok?: boolean; gameId?: string; message?: string; rewardConditionsRevision?: string }>('/v1/game', {
    gameId, rewardConditions: { rankingTopX, expectedRevision },
  })
  if (data?.ok !== true || data.gameId !== gameId || data.message !== 'Reward conditions updated successfully'
    || !data.rewardConditionsRevision)
    throw new Error('Reward conditions update not confirmed')
  return data.rewardConditionsRevision
}

export function operatorGameHomeUrl(gameId: string): string {
  return `/home?gameId=${encodeURIComponent(gameId)}`
}

export async function setOperatorGameActive(gameId: string, isActive: boolean): Promise<Pick<OperatorGame, 'isActive' | 'lifecycleState'>> {
  const data = await api.put<{ game?: { gameId?: string; isActive?: boolean; lifecycleState?: OperatorGame['lifecycleState'] } }>(
    '/v1/game', { gameId, isActive },
  )
  if (data?.game?.gameId !== gameId || data.game.isActive !== isActive
    || !data.game.lifecycleState || !['active', 'closing', 'inactive'].includes(data.game.lifecycleState)
    || (isActive ? data.game.lifecycleState !== 'active' : data.game.lifecycleState === 'active')) {
    throw new Error('Game activity update not confirmed')
  }
  return { isActive: data.game.isActive, lifecycleState: data.game.lifecycleState }
}

export async function archiveOperatorGame(gameId: string): Promise<void> {
  const data = await api.delete<{ gameId?: string; message?: string }>('/v1/game', { gameId })
  if (data?.gameId !== gameId || data.message !== 'Game archived successfully') {
    throw new Error('Game archival not confirmed')
  }
}

export async function unarchiveOperatorGame(gameId: string): Promise<void> {
  const data = await api.put<{ message?: string; game?: unknown }>('/v1/game', { gameId, archived: false })
  if (data?.message !== 'Game unarchived successfully' || !isOperatorGame(data.game)
    || data.game.gameId !== gameId || data.game.isActive !== false
    || data.game.lifecycleState !== 'inactive' || data.game.archivedAt || data.game.deletionStartedAt) {
    throw new Error('Game restoration not confirmed')
  }
}

export async function deleteOperatorGamePermanently(gameId: string, confirmation: string): Promise<void> {
  const data = await api.delete<{ gameId?: string; message?: string }>(
    '/v1/game', { gameId, permanent: true, confirmation },
  )
  if (data?.gameId !== gameId || data.message !== 'Game permanently deleted successfully') {
    throw new Error('Permanent game deletion not confirmed')
  }
}
