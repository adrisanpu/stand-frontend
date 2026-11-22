import { api } from './api'
import type { OptionalParticipantField } from './publicApi'
import { PARTICIPANT_PROFILE_FIELDS } from '../core/lib/participantFields'

export type FormResponseQuestion = {
  id: string
  text: string
  options: { title: string; payload: string }[]
}

export type FormResponsePlayer = Partial<Record<OptionalParticipantField, string | null>> & {
  playerId: number | string
  name: string | null
  email: string | null
  phone?: string | null
  joinedAt?: string | null
  completed: boolean
  completedAt: string | null
  answers: Record<string, string>
}

export type FormResponses = {
  ok: true
  gameId: string
  gameName: string
  questions: FormResponseQuestion[]
  players: FormResponsePlayer[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isResponse(value: unknown): value is FormResponses {
  if (!isRecord(value) || value.ok !== true || typeof value.gameId !== 'string'
    || typeof value.gameName !== 'string' || !Array.isArray(value.questions)
    || !Array.isArray(value.players)) return false
  return value.questions.every(question => isRecord(question)
    && typeof question.id === 'string' && typeof question.text === 'string'
    && Array.isArray(question.options)
    && question.options.every(option => isRecord(option)
      && typeof option.title === 'string' && typeof option.payload === 'string'))
    && value.players.every(player => isRecord(player)
      && (typeof player.playerId === 'number' || typeof player.playerId === 'string')
      && (typeof player.name === 'string' || player.name === null)
      && (typeof player.email === 'string' || player.email === null)
      && [player.phone, ...PARTICIPANT_PROFILE_FIELDS.map(({ key }) => player[key])]
        .every(value => value === undefined || value === null || typeof value === 'string')
      && (player.joinedAt === undefined || player.joinedAt === null || typeof player.joinedAt === 'string')
      && typeof player.completed === 'boolean'
      && (typeof player.completedAt === 'string' || player.completedAt === null)
      && isRecord(player.answers)
      && Object.values(player.answers).every(answer => typeof answer === 'string'))
}

export async function getFormResponses(gameId: string): Promise<FormResponses> {
  const data: unknown = await api.get(
    `/v1/game/quiz?gameId=${encodeURIComponent(gameId)}&analytics=1`,
  )
  if (!isResponse(data) || data.gameId !== gameId) {
    throw new Error('Invalid form responses response')
  }
  return data
}
