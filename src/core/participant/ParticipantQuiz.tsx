import { useEffect, useRef, useState, type ReactNode } from 'react'
import { publicApi, type ParticipantQuizState, type PublicGameResponse } from '../../api/publicApi'
import { FormHeader, QuizFields } from './FormPresentation'
import { useParticipantLanguage } from './participantLanguage'

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
        if (!data.quiz.completed && data.quiz.moment !== 'disabled') timer = setTimeout(refresh, 5000)
      } catch {
        if (!cancelled) setError(true)
      }
    }
    void refresh()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [gameId, playerToken, enabled, retry])

  const mandatory = (quiz?.moment ?? gameMeta.formConfig?.quizMoment) === 'after_registration'
    || (quiz?.moment === 'after_game' && quiz.finished)
  const needsQuiz = !!quiz && !quiz.completed && (mandatory || open)
  const invitation = quiz && !quiz.completed && !mandatory
    && (quiz.moment === 'raffle' || (quiz.moment === 'prize' && quiz.prizePending))

  useEffect(() => {
    onActiveChange?.(enabled && needsQuiz)
    return () => onActiveChange?.(false)
  }, [enabled, needsQuiz, onActiveChange])

  if (!enabled) return <>{children}</>

  const submit = async () => {
    if (!quiz || !playerToken || busy.current) return
    busy.current = true
    setSaving(true)
    setError(false)
    try {
      const data = await publicApi.submitQuiz(gameId, playerToken, answers, quiz.revision)
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
      <button type="button" className="underline" disabled={saving} onClick={() => setRetry(value => value + 1)}>
        {t('Recargar cuestionario')}
      </button>
    </div>}
    {!quiz && mandatory && !error && <p role="status">{t('Cargando cuestionario…')}</p>}
    {needsQuiz && quiz &&
      <form className="space-y-4 rounded-xl bg-club p-4 text-textMain" onSubmit={event => {
        event.preventDefault()
        void submit()
      }}>
        <FormHeader title={gameMeta.formConfig?.quizTitle || t('Cuéntanos tu opinión')}
          description={gameMeta.formConfig?.quizDescription || ''}
          logoUrl={gameMeta.formLogoUrl} bannerUrl={gameMeta.formBannerUrl} />
        <QuizFields questions={quiz.questions} answers={answers} disabled={saving}
          onChange={(id, payload) => setAnswers(current => ({ ...current, [id]: payload }))} />
        <button type="submit" disabled={saving || quiz.questions.some(q => !answers[q.id])}
          className="w-full rounded-xl bg-primary px-4 py-3 font-semibold disabled:opacity-50">
          {saving ? t('Guardando…') : t('Enviar respuestas')}
        </button>
        {!mandatory && <button type="button" className="underline" disabled={saving} onClick={() => setOpen(false)}>
          {t('Volver al juego')}
        </button>}
      </form>}
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
