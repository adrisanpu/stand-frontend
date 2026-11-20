import { useEffect, useRef, useState, type ReactNode } from 'react'
import { publicApi, type ParticipantQuizState, type PublicGameResponse } from '../../api/publicApi'
import type { FormQuestion } from '../formConfig'
import { FormHeader, QuizFields } from './FormPresentation'
import { useParticipantLanguage } from './participantLanguage'

/** The questionnaire card exactly as participants see it; shared with the operator preview. */
export function QuizCard({ title, description, logoUrl, bannerUrl, questions, answers, saving = false, namePrefix, onChange, onBack }: {
  title?: string
  description: string
  logoUrl?: string | null
  bannerUrl?: string | null
  questions: FormQuestion[]
  answers: Record<string, string>
  saving?: boolean
  namePrefix?: string
  onChange: (questionId: string, payload: string) => void
  onBack?: () => void
}) {
  const { t } = useParticipantLanguage()
  return <div className="quiz-card space-y-4 rounded-xl bg-club !min-h-0 p-4 text-textMain">
    <FormHeader title={title} description={description} logoUrl={logoUrl} bannerUrl={bannerUrl} />
    <QuizFields questions={questions} answers={answers} disabled={saving} namePrefix={namePrefix} onChange={onChange} />
    {saving && <p role="status">{t('Guardando…')}</p>}
    {onBack && <button type="button" className="underline" disabled={saving} onClick={onBack}>
      {t('Volver al juego')}
    </button>}
  </div>
}

export default function ParticipantQuiz({ gameId, playerToken, gameMeta, children, onActiveChange }: {
  gameId: string
  playerToken: string | null
  gameMeta: PublicGameResponse
  children: ReactNode
  onActiveChange?: (active: boolean) => void
}) {
  const { t } = useParticipantLanguage()
  const enabled = !!playerToken && !!gameMeta.formConfig && gameMeta.formConfig.quizMoment !== 'disabled'
  const [quiz, setQuiz] = useState<ParticipantQuizState | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)
  const busy = useRef(false)

  useEffect(() => {
    setQuiz(null)
    setAnswers({})
    setOpen(false)
    setError(false)
  }, [gameId, playerToken])

  useEffect(() => {
    if (!enabled || !playerToken) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const refresh = async () => {
      try {
        const data = await publicApi.getPlayer(playerToken, gameId)
        if (cancelled) return
        if (!data.ok || !data.quiz) throw new Error('Invalid quiz state')
        const nextQuiz = data.quiz
        setQuiz(current => current?.completed ? current : nextQuiz)
        const questions = data.quiz.questions
        setAnswers(current => Object.fromEntries(Object.entries(current).filter(([id, payload]) =>
          questions.some(q => q.id === id && q.options.some(opt => opt.payload === payload)))))
        setError(false)
        if (!data.quiz.completed) timer = setTimeout(refresh, 5000)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void refresh()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [gameId, playerToken, enabled, retry])

  const mandatory = (quiz?.moment ?? gameMeta.formConfig?.quizMoment) === 'after_registration'
    || (quiz?.moment === 'after_game' && quiz.finished)
  const needsQuiz = !!quiz && quiz.moment !== 'disabled' && !quiz.completed && (mandatory || open)
  const invitation = quiz && !quiz.completed && !mandatory
    && (quiz.moment === 'raffle' || (quiz.moment === 'prize' && quiz.prizePending))

  useEffect(() => {
    onActiveChange?.(enabled && needsQuiz)
    return () => onActiveChange?.(false)
  }, [enabled, needsQuiz, onActiveChange])

  if (!enabled) return <>{children}</>

  const submit = async (submittedAnswers: Record<string, string> = answers) => {
    if (!quiz || !playerToken || busy.current) return
    busy.current = true
    setSaving(true)
    setError(false)
    try {
      const data = await publicApi.submitQuiz(gameId, playerToken, submittedAnswers, quiz.revision)
      if (!data.ok || !data.quiz?.completed) throw new Error('Quiz not confirmed')
      setQuiz(data.quiz)
      setOpen(false)
      window.dispatchEvent(new Event('participant-quiz-completed'))
    } catch {
      setError(true)
    } finally {
      busy.current = false
      setSaving(false)
    }
  }

  return <>
    {error && <div role="alert" className="mb-4 space-y-2">
      <p>{t('No se pudo confirmar el cuestionario. Tus respuestas no se han descartado.')}</p>
      <button type="button" className="underline" disabled={saving} onClick={() => quiz
        ? void submit(answers) : setRetry(value => value + 1)}>
        {t(quiz ? 'Reintentar envío' : 'Recargar cuestionario')}
      </button>
    </div>}
    {!quiz && mandatory && !error && <p role="status">{t('Cargando cuestionario…')}</p>}
    {needsQuiz && quiz &&
      <QuizCard title={gameMeta.formConfig?.quizTitle || undefined}
        description={gameMeta.formConfig?.quizDescription || ''}
        logoUrl={gameMeta.formLogoUrl} bannerUrl={gameMeta.formBannerUrl}
        questions={quiz.questions} answers={answers} saving={saving}
        onChange={(id, payload) => {
          const nextAnswers = { ...answers, [id]: payload }
          setAnswers(nextAnswers)
          if (quiz.questions.length > 0 && quiz.questions.every(question => !!nextAnswers[question.id])) {
            void submit(nextAnswers)
          }
        }}
        onBack={mandatory ? undefined : () => setOpen(false)} />}
    {invitation && !open && <div className="mb-4 space-y-2 rounded-xl border border-primary/30 p-4">
      <p>{t(quiz.moment === 'raffle'
        ? 'Completa el cuestionario para participar en el sorteo.'
        : 'Tu premio está reservado. Completa el cuestionario para recibirlo.')}</p>
      <button type="button" className="rounded-xl bg-primary px-4 py-3 font-semibold" onClick={() => setOpen(true)}>
        {t('Responder cuestionario')}
      </button>
    </div>}
    {(!mandatory || quiz?.completed) && !needsQuiz && children}
  </>
}
