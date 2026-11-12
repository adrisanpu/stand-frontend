import { api } from './api'
import { isFormQuestions, isGameFormResponse, validateFormDraft, type FormQuestion, type GameFormDraft, type GameFormResponse } from '../core/formConfig'

function confirmed(data: unknown, gameId: string): GameFormResponse {
  if (!isGameFormResponse(data) || data.gameId !== gameId) throw new Error('Invalid game form response')
  return data
}

export async function getGameForm(gameId: string): Promise<GameFormResponse> {
  return confirmed(await api.get(`/v1/game?gameId=${encodeURIComponent(gameId)}&form=true`), gameId)
}

export async function saveGameForm(gameId: string, draft: GameFormDraft, expectedRevision: string, previousQuestions?: FormQuestion[]): Promise<GameFormResponse> {
  const invalid = validateFormDraft(draft, previousQuestions)
  if (invalid) throw new Error(invalid)
  return confirmed(await api.put('/v1/game', { gameId, form: { ...draft, expectedRevision } }), gameId)
}

export async function generateFormQuestions(gameId: string, options: {
  text: string; numQuestions: number; numOptions: number; useEmojis: boolean
}) {
  const result = await api.post<{ ok: boolean; gameId: string; questions: unknown }>('/v1/game/quiz/generate', {
    gameId, ...options, draftOnly: true,
  })
  if (result?.ok !== true || result.gameId !== gameId || !isFormQuestions(result.questions) || !result.questions.length
    || result.questions.some(question => question.options.length > 3)) {
    throw new Error('Invalid generated questions')
  }
  return result.questions.map(({ id, text, options }) => ({ id, text, options: options.map(({ title, payload }) => ({ title, payload })) }))
}

export async function exportFormResults(gameId: string) {
  return api.get(`/quiz?gameId=${encodeURIComponent(gameId)}`)
}
