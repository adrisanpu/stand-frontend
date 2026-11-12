import type { ParticipantFieldsConfig, PublicGameResponse } from '../api/publicApi'
import type { ParticipantAppearance } from './theme/appearance'
import { PARTICIPANT_PROFILE_FIELDS, resolveParticipantFields } from './lib/participantFields'

export const QUIZ_MOMENTS = ['disabled', 'after_registration', 'after_game', 'prize', 'raffle'] as const
export type QuizMoment = typeof QUIZ_MOMENTS[number]
export type FormQuestion = { id: string; text: string; options: { title: string; payload: string }[] }
export type GameFormConfig = {
  registrationTitle: string
  registrationDescription: string
  quizTitle: string
  quizDescription: string
  logoKey: string | null
  bannerKey: string | null
  appearance: ParticipantAppearance | null
  quizMoment: QuizMoment
}
export type FormConfig = GameFormConfig
export type GameFormDraft = {
  formConfig: GameFormConfig
  participantFields: ParticipantFieldsConfig
  questions: FormQuestion[]
}
export type GameFormResponse = GameFormDraft & {
  ok: true
  gameId: string
  gameType: string
  logoUrl: string | null
  bannerUrl: string | null
  locked: boolean
  revision: string
  joinUrl: string
  readOnly: boolean
  loyalty?: PublicGameResponse['loyalty']
}

export function formDraft(data: GameFormDraft): GameFormDraft {
  return { formConfig: data.formConfig, participantFields: resolveParticipantFields(data.participantFields), questions: data.questions }
}

export function validateFormDraft(data: GameFormDraft, previousQuestions?: FormQuestion[]): string | null {
  for (const key of ['registrationTitle', 'quizTitle'] as const) {
    if (data.formConfig[key].length > 160) return 'Los títulos admiten hasta 160 caracteres.'
  }
  for (const key of ['registrationDescription', 'quizDescription'] as const) {
    if (data.formConfig[key].length > 1000) return 'Las descripciones admiten hasta 1000 caracteres.'
  }
  if (data.questions.length > 5) return 'El cuestionario admite como máximo 5 preguntas.'
  if (data.formConfig.quizMoment !== 'disabled' && !data.questions.length) return 'Añade una pregunta o desactiva el cuestionario.'
  if (new Set(data.questions.map(question => question.id)).size !== data.questions.length) return 'Las preguntas deben tener identificadores únicos.'
  for (const question of data.questions) {
    if (!question.id.trim() || !question.text.trim() || question.text.length > 500) return 'Completa cada pregunta con un máximo de 500 caracteres.'
    const unchangedLegacy = question.options.length > 3
      && previousQuestions?.some(previous => JSON.stringify(previous) === JSON.stringify(question))
    if (!question.options.length || (question.options.length > 3 && !unchangedLegacy)) return 'Cada pregunta necesita entre 1 y 3 opciones.'
    if (question.options.some(option => !option.title.trim() || option.title.length > 200 || !option.payload.trim())) return 'Completa las opciones con un máximo de 200 caracteres.'
    if (new Set(question.options.map(option => option.payload)).size !== question.options.length) return 'Las opciones de cada pregunta deben tener valores únicos.'
  }
  return null
}

export function isFormQuestions(value: unknown): value is FormQuestion[] {
  return Array.isArray(value) && value.length <= 5 && value.every(question =>
    !!question && typeof question.id === 'string' && typeof question.text === 'string'
    && Array.isArray(question.options) && question.options.length >= 1
    && question.options.every((option: FormQuestion['options'][number]) =>
      !!option && typeof option.title === 'string' && typeof option.payload === 'string'))
}

export function isGameFormResponse(value: unknown): value is GameFormResponse {
  if (!value || typeof value !== 'object') return false
  const data = value as GameFormResponse
  const config = data.formConfig
  const nullableText = (text: unknown) => text === null || typeof text === 'string'
  const field = (item: unknown) => item === undefined || (!!item && typeof item === 'object' && !Array.isArray(item)
    && Object.values(item).every(value => typeof value === 'boolean'))
  return data.ok === true && typeof data.gameId === 'string' && typeof data.gameType === 'string'
    && typeof data.revision === 'string' && !!data.revision
    && typeof data.locked === 'boolean' && typeof data.readOnly === 'boolean'
    && typeof data.joinUrl === 'string' && !!data.joinUrl
    && (data.loyalty === undefined || (!!data.loyalty
      && ['clubName', 'privacyUrl', 'termsUrl', 'consentVersion'].every(key =>
        typeof data.loyalty?.[key as keyof NonNullable<PublicGameResponse['loyalty']>] === 'string')))
    && nullableText(data.logoUrl) && nullableText(data.bannerUrl)
    && !!config && ['registrationTitle', 'registrationDescription', 'quizTitle', 'quizDescription']
      .every(key => typeof config[key as keyof GameFormConfig] === 'string')
    && nullableText(config.logoKey) && nullableText(config.bannerKey)
    && QUIZ_MOMENTS.includes(config.quizMoment)
    && (config.appearance === null || (!!config.appearance
      && ['dark', 'light'].includes(config.appearance.themeMode)
      && (config.appearance.colors === null || (!!config.appearance.colors
        && /^#[\da-f]{6}$/i.test(config.appearance.colors.primary)
        && /^#[\da-f]{6}$/i.test(config.appearance.colors.accent)))))
    && !!data.participantFields && typeof data.participantFields === 'object' && !Array.isArray(data.participantFields)
    && field(data.participantFields.email) && field(data.participantFields.phone)
    && PARTICIPANT_PROFILE_FIELDS.every(({ key }) => field(data.participantFields[key]))
    && isFormQuestions(data.questions)
}
