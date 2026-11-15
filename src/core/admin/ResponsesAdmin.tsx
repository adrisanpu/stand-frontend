import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFormResponses, type FormResponsePlayer, type FormResponseQuestion, type FormResponses } from '../../api/formResponses'
import { listOperatorGames, type OperatorGame } from '../../api/operatorGames'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import { PARTICIPANT_PROFILE_FIELDS, participantProfileValue } from '../lib/participantFields'

export function buildResponsesSummary(players: FormResponsePlayer[], questions: FormResponseQuestion[]) {
  const answeredPlayers = new Set<number>()
  const summaries = questions.map(question => {
    const counts = new Map<string, number>()
    const textAnswers: string[] = []
    let answerCount = 0
    players.forEach((player, index) => {
      const answer = player.answers[question.id]
      if (!answer?.trim()) return
      answeredPlayers.add(index)
      answerCount += 1
      counts.set(answer, (counts.get(answer) ?? 0) + 1)
      if (question.options.length === 0) textAnswers.push(answer)
    })
    const options = question.options.map(option => {
      const count = counts.get(option.payload) ?? 0
      return { ...option, count, percentage: answerCount ? count / answerCount * 100 : 0 }
    })
    const knownPayloads = new Set(question.options.map(option => option.payload))
    const unrecognizedCount = question.options.length
      ? [...counts].reduce((total, [payload, count]) => total + (knownPayloads.has(payload) ? 0 : count), 0)
      : 0
    return { question, answerCount, options, textAnswers, unrecognizedCount }
  })
  return {
    answeredCount: answeredPlayers.size,
    completedCount: players.filter(player => player.completed).length,
    questions: summaries,
  }
}

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function buildResponsesCsv(
  players: FormResponsePlayer[],
  questions: FormResponseQuestion[],
  labels = { player: 'Participant', name: 'Name', email: 'Email', completed: 'Completed', completedAt: 'Completed at' },
  language: 'es' | 'en' = 'en',
): string {
  const headers = [
    labels.player, labels.name, labels.email, labels.completed, labels.completedAt,
    language === 'en' ? 'Phone' : 'Teléfono',
    ...PARTICIPANT_PROFILE_FIELDS.map(field => language === 'en' ? field.en : field.es),
    ...questions.map(question => question.text),
  ]
  const rows = players.map(player => [
    player.playerId,
    player.name,
    player.email,
    player.completed ? 'true' : 'false',
    player.completedAt,
    player.phone,
    ...PARTICIPANT_PROFILE_FIELDS.map(({ key }) => participantProfileValue(key, player[key], language)),
    ...questions.map(question => {
      const payload = player.answers[question.id]
      return question.options.find(option => option.payload === payload)?.title ?? payload ?? ''
    }),
  ])
  return [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

function downloadCsv(
  gameId: string,
  players: FormResponsePlayer[],
  questions: FormResponseQuestion[],
  t: (spanish: string, english?: string) => string,
  language: 'es' | 'en',
) {
  const csv = buildResponsesCsv(players, questions, {
    player: t('Participante', 'Participant'),
    name: t('Nombre', 'Name'),
    email: t('Email', 'Email'),
    completed: t('Formulario completado', 'Completed'),
    completedAt: t('Fecha de finalización', 'Completed at'),
  }, language)
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `responses-${gameId.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function ResponsesAdmin() {
  const { language, t } = useOperatorLanguage()
  const { plan } = useCurrentUser()
  const canExportResults = getFeaturesByPlan(plan).exportResults
  const [archived, setArchived] = useState(false)
  const [games, setGames] = useState<OperatorGame[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [gameStatus, setGameStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [responses, setResponses] = useState<FormResponses | null>(null)
  const [responseStatus, setResponseStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [gameRetry, setGameRetry] = useState(0)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    setGameStatus('loading')
    setGames([])
    setSelectedId('')
    void listOperatorGames(archived).then(result => {
      if (!cancelled) {
        setGames(result)
        setSelectedId(result[0]?.gameId ?? '')
        setGameStatus('ready')
      }
    }).catch(() => {
      if (!cancelled) setGameStatus('error')
    })
    return () => { cancelled = true }
  }, [archived, gameRetry])

  useEffect(() => {
    if (!selectedId) {
      setResponses(null)
      setResponseStatus('idle')
      return
    }
    let cancelled = false
    setResponses(null)
    setResponseStatus('loading')
    void getFormResponses(selectedId).then(result => {
      if (!cancelled) {
        setResponses(result)
        setResponseStatus('ready')
      }
    }).catch(() => {
      if (!cancelled) setResponseStatus('error')
    })
    return () => { cancelled = true }
  }, [selectedId, retry])

  const summary = useMemo(() => responses
    ? buildResponsesSummary(responses.players, responses.questions)
    : null, [responses])
  const percentageFormat = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'es-ES', {
    maximumFractionDigits: 1,
  })
  const selectedGame = games.find(game => game.gameId === selectedId)

  return (
    <section aria-label={t('Respuestas', 'Responses')} className="mt-6 space-y-6">
      <div className="card flex flex-wrap items-end gap-4 p-4">
        <label className="min-w-[14rem] flex-1 space-y-1 text-sm font-medium">
          <span>{t('Partida', 'Event')}</span>
          <select aria-label={t('Seleccionar partida', 'Select event')} value={selectedId}
            disabled={gameStatus !== 'ready' || games.length === 0}
            onChange={event => setSelectedId(event.target.value)}
            className="block w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 text-textMain">
            {games.map(game => <option key={game.gameId} value={game.gameId}>{game.gameName}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-textSub">
          <input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)}
            className="h-4 w-4 accent-primary" />
          {t('Incluir partidas archivadas', 'Include archived events')}
        </label>
        {selectedGame && !selectedGame.archivedAt && <Link to={`/admin/games?form=${encodeURIComponent(selectedGame.gameId)}`}
          className="rounded-lg border border-current/20 px-3 py-2 text-sm font-medium hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          {t('Configurar formulario', 'Configure form')}
        </Link>}
        {selectedGame?.archivedAt && <p className="max-w-xs text-sm text-textSub">
          {t('Las partidas archivadas son de solo lectura y no se pueden configurar.', 'Archived events are read-only and cannot be configured.')}
        </p>}
      </div>
      {gameStatus === 'loading' && <p role="status">{t('Cargando partidas…', 'Loading events…')}</p>}
      {gameStatus === 'error' && <div role="alert" className="space-y-2">
        <p>{t('No se pudieron cargar las partidas.', 'Could not load events.')}</p>
        <button type="button" className="rounded-lg border border-current/20 px-3 py-2"
          onClick={() => setGameRetry(value => value + 1)}>{t('Reintentar', 'Retry')}</button>
      </div>}
      {gameStatus === 'ready' && games.length === 0 && (
        <p className="text-sm text-textSub">{t('No hay partidas disponibles.', 'There are no events available.')}</p>
      )}
      {responseStatus === 'loading' && <p role="status">{t('Cargando respuestas…', 'Loading responses…')}</p>}
      {responseStatus === 'error' && <div role="alert" className="space-y-2">
        <p>{t('No se pudieron cargar las respuestas.', 'Could not load responses.')}</p>
        <button type="button" className="rounded-lg border border-current/20 px-3 py-2"
          onClick={() => setRetry(value => value + 1)}>{t('Reintentar', 'Retry')}</button>
      </div>}
      {responseStatus === 'ready' && responses && summary && (
        <>
          <section aria-label={t('Resumen de respuestas', 'Response summary')} className="card space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{t('Resumen de respuestas', 'Response summary')}</h2>
                <p className="mt-2 text-sm text-textSub">{t('Participantes con respuestas', 'Participants with answers')}</p>
                <p className="text-3xl font-semibold tabular-nums">{summary.answeredCount}</p>
                <p className="mt-1 text-sm text-textSub">
                  {t('Formularios completados', 'Completed forms')}: <span className="tabular-nums">{summary.completedCount}</span>
                </p>
              </div>
              <button type="button" disabled={!canExportResults}
                onClick={() => downloadCsv(responses.gameId, responses.players, responses.questions, t, language)}
                title={!canExportResults ? t('Disponible en el plan Event', 'Available on the Event plan') : undefined}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
                {t('Exportar CSV', 'Export CSV')}
              </button>
            </div>
            {!canExportResults && <p className="text-sm text-textSub">
              {t('Exportar resultados está disponible en el plan Event.', 'Results export is available on the Event plan.')}
            </p>}
            <p className="border-t border-current/10 pt-3 text-sm text-textSub">
              {t('Los porcentajes se calculan sobre las respuestas de cada pregunta, incluidos los formularios incompletos.',
                'Percentages are based on answers to each question, including incomplete forms.')}
            </p>
          </section>
          {summary.questions.length === 0 && <p className="text-sm text-textSub">
            {t('Esta partida no tiene preguntas de cuestionario.', 'This event has no questionnaire questions.')}
          </p>}
          {summary.questions.map(({ question, answerCount, options, textAnswers, unrecognizedCount }, index) => (
            <section key={question.id} className="card space-y-4 p-4 sm:p-6"
              aria-label={t(`Distribución: ${question.text}`, `Distribution: ${question.text}`)}>
              <div>
                <h2 className="break-words text-lg font-semibold">{index + 1}. {question.text}</h2>
                <p className="mt-1 text-sm tabular-nums text-textSub">{t('Respuestas', 'Answers')}: {answerCount}</p>
              </div>
              {answerCount === 0 && <p className="text-sm text-textSub">
                {t('Todavía no hay respuestas a esta pregunta.', 'There are no answers to this question yet.')}
              </p>}
              {options.length > 0 && <ul className="space-y-4">
                {options.map(option => <li key={option.payload} className="space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 break-words">{option.title}</span>
                    <span className="shrink-0 tabular-nums">{option.count} ({percentageFormat.format(option.percentage)}%)</span>
                  </div>
                  <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-primary/10">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${option.percentage}%` }} />
                  </div>
                </li>)}
              </ul>}
              {unrecognizedCount > 0 && <p role="status" className="text-sm text-textSub">
                {t('Respuestas que no coinciden con las opciones actuales', 'Answers that do not match the current options')}: {unrecognizedCount}
              </p>}
              {textAnswers.length > 0 && <ul className="max-h-80 space-y-2 overflow-y-auto">
                {textAnswers.map((answer, answerIndex) => <li key={answerIndex}
                  className="whitespace-pre-wrap break-words rounded-lg bg-surface px-3 py-2 text-sm">{answer}</li>)}
              </ul>}
            </section>
          ))}
        </>
      )}
    </section>
  )
}
