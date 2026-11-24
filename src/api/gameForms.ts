import { api } from './api'
import { isGameFormResponse, validateFormDraft, type FormQuestion, type GameFormDraft, type GameFormResponse } from '../core/formConfig'

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
  const saved = confirmed(await api.put('/v1/game', { gameId, form: { ...draft, expectedRevision } }), gameId)
  if (draft.formConfig.defaultLanguage !== undefined && saved.formConfig.defaultLanguage !== draft.formConfig.defaultLanguage)
    throw new Error('Default participant language was not confirmed')
  return saved
}

export async function exportFormResults(gameId: string) {
  return api.get(`/quiz?gameId=${encodeURIComponent(gameId)}`)
}
