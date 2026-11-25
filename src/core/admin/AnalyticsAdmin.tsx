import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { getFormResponses, type FormResponsePlayer, type FormResponseQuestion, type FormResponses } from '../../api/formResponses'
import { listOperatorGames, type OperatorGame } from '../../api/operatorGames'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import { PARTICIPANT_PROFILE_FIELDS, participantProfileValue } from '../lib/participantFields'
import { PHONE_COUNTRIES } from '../participant/phoneCountries'
import PlayerCountriesMap from './PlayerCountriesMap'

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

type RegistrationPoint = { timestamp: number; count: number }
type PlayerCountryCount = { code: string | null; count: number }

export function buildTimeline(timestamps: (string | null | undefined)[]) {
  const counts = new Map<number, number>()
  let undated = 0
  for (const value of timestamps) {
    const timestamp = value ? Date.parse(value) : NaN
    if (!Number.isFinite(timestamp)) { undated += 1; continue }
    counts.set(timestamp, (counts.get(timestamp) ?? 0) + 1)
  }
  let total = 0
  const points: RegistrationPoint[] = [...counts].sort(([first], [second]) => first - second)
    .map(([timestamp, count]) => ({ timestamp, count: total += count }))
  return { points, undated }
}

function phoneCountryCode(phone: string | null | undefined): string | null {
  const value = phone?.trim()
  if (!value || (!value.startsWith('+') && !value.startsWith('00'))) return null
  const digits = value.startsWith('00') ? value.slice(2).replace(/\D/g, '') : value.slice(1).replace(/\D/g, '')
  if (!digits) return null
  const matches = PHONE_COUNTRIES.filter(country => digits.startsWith(country.prefix.slice(1)))
    .sort((a, b) => b.prefix.length - a.prefix.length)
  const longestPrefix = matches[0]?.prefix
  if (!longestPrefix) return null
  const samePrefix = matches.filter(country => country.prefix === longestPrefix)
  return samePrefix.find(country => country.code === 'GB' || country.code === 'RU')?.code
    ?? samePrefix[0]?.code
    ?? null
}

export function buildPlayerAnalytics(players: FormResponsePlayer[], questions: FormResponseQuestion[]) {
  const registrations = buildTimeline(players.map(player => player.joinedAt)).points

  const countryCounts = new Map<string | null, number>()
  players.forEach(player => {
    const code = phoneCountryCode(player.phone)
    countryCounts.set(code, (countryCounts.get(code) ?? 0) + 1)
  })
  const countries: PlayerCountryCount[] = [...countryCounts]
    .map(([code, count]) => ({ code, count }))
    .sort((first, second) => {
      if (first.code === null || second.code === null) {
        return first.code === second.code ? 0 : first.code === null ? 1 : -1
      }
      return second.count - first.count || first.code.localeCompare(second.code)
    })
  const responseSummary = buildResponsesSummary(players, questions)

  return {
    playerCount: players.length,
    answeredCount: responseSummary.answeredCount,
    completedCount: responseSummary.completedCount,
    registrations,
    countries,
  }
}

function RegistrationChart({ points, prizeEvents, language, t }: {
  points: RegistrationPoint[]
  prizeEvents: FormResponses['prizeEvents']
  language: 'es' | 'en'
  t: (spanish: string, english?: string) => string
}) {
  const awarded = buildTimeline((prizeEvents ?? []).filter(event => event.kind === 'awarded').map(event => event.timestamp))
  const redeemed = buildTimeline((prizeEvents ?? []).filter(event => event.kind === 'redeemed').map(event => event.timestamp))
  const series = [
    { label: t('Registros acumulados', 'Cumulative registrations'), points, color: 'var(--color-primary, #FF931F)', dash: undefined },
    { label: t('Premios repartidos', 'Prizes awarded'), points: awarded.points, color: '#3B82F6', dash: '8 4' },
    { label: t('Premios canjeados', 'Prizes redeemed'), points: redeemed.points, color: '#0D9488', dash: '2 4' },
  ].filter((_, index) => index === 0 || prizeEvents !== undefined)
  const allPoints = series.flatMap(item => item.points)
  const undated = awarded.undated + redeemed.undated

  const left = 44
  const right = 676
  const top = 18
  const bottom = 188
  const maxCount = allPoints.reduce((max, point) => Math.max(max, point.count), 1)
  const firstTimestamp = allPoints.reduce((min, point) => Math.min(min, point.timestamp), Infinity)
  const lastTimestamp = allPoints.reduce((max, point) => Math.max(max, point.timestamp), -Infinity)
  const [timeRange, setTimeRange] = useState<{ start: number; end: number } | null>(null)
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  useEffect(() => {
    setTimeRange(null)
    setSelection(null)
    setDragStart(null)
  }, [firstTimestamp, lastTimestamp])
  const visibleStart = timeRange?.start ?? firstTimestamp
  const visibleEnd = timeRange?.end ?? lastTimestamp
  const x = (timestamp: number) => visibleStart === visibleEnd
    ? (left + right) / 2
    : left + (timestamp - visibleStart) / (visibleEnd - visibleStart) * (right - left)
  const y = (count: number) => bottom - count / maxCount * (bottom - top)
  const visiblePoints = (values: RegistrationPoint[]) =>
    values.filter(point => point.timestamp >= visibleStart && point.timestamp <= visibleEnd)
  const path = (values: RegistrationPoint[]) => {
    const preceding = [...values].reverse().find(point => point.timestamp < visibleStart)
    const points = [
      ...(preceding ? [{ timestamp: visibleStart, count: preceding.count }] : []),
      ...visiblePoints(values),
    ]
    return `M ${left} ${bottom} ` + points.map(point =>
      `H ${x(point.timestamp)} V ${y(point.count)}`,
    ).join(' ') + ` H ${right}`
  }
  const pointerX = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    if (!bounds.width) return null
    return Math.max(left, Math.min(right, (event.clientX - bounds.left) / bounds.width * 720))
  }
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (visibleStart >= visibleEnd || event.button !== 0) return
    const position = pointerX(event)
    if (position === null) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragStart(position)
    setSelection({ start: position, end: position })
  }
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (dragStart === null) return
    const position = pointerX(event)
    if (position !== null) setSelection({ start: dragStart, end: position })
  }
  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (dragStart === null) return
    const position = pointerX(event)
    if (position !== null && Math.abs(position - dragStart) >= 8) {
      const start = visibleStart + (Math.min(position, dragStart) - left) / (right - left) * (visibleEnd - visibleStart)
      const end = visibleStart + (Math.max(position, dragStart) - left) / (right - left) * (visibleEnd - visibleStart)
      if (start < end) setTimeRange({ start, end })
    }
    setDragStart(null)
    setSelection(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  const chartSeries = series.map(item => ({ ...item, visiblePoints: visiblePoints(item.points) }))
  const dateFormat = new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'es-ES', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      {firstTimestamp !== lastTimestamp && <div className="flex items-center justify-between gap-2 text-xs text-textSub">
        <p>{t('Arrastra sobre el gráfico para ampliar un intervalo.', 'Drag across the chart to zoom into a range.')}</p>
        {timeRange && <button type="button" className="shrink-0 underline"
          onClick={() => setTimeRange(null)}>{t('Restablecer zoom', 'Reset zoom')}</button>}
      </div>}
      {allPoints.length === 0 ? <p className="mb-4 text-sm text-textSub">
        {t('No hay fechas de registro o premios disponibles.', 'No registration or prize timestamps are available.')}
      </p> : <svg role="img" aria-label={t('Evolución de registros y premios en el tiempo', 'Registrations and prizes over time')}
        viewBox="0 0 720 220" className="h-56 min-h-0 w-full cursor-crosshair touch-none select-none"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { setDragStart(null); setSelection(null) }}>
        <line x1={left} y1={bottom} x2={right} y2={bottom} stroke="currentColor" opacity=".2" />
        <line x1={left} y1={top} x2={left} y2={bottom} stroke="currentColor" opacity=".2" />
        {[0, maxCount].map(count => <text key={count} x={left - 8} y={y(count) + 4}
          textAnchor="end" className="fill-current text-[11px]">{count}</text>)}
        {selection && <rect x={Math.min(selection.start, selection.end)} y={top}
          width={Math.abs(selection.end - selection.start)} height={bottom - top}
          fill="var(--color-primary, #FF931F)" opacity=".15" pointerEvents="none" />}
        {chartSeries.map(item => <g key={item.label} aria-label={item.label}>
          <path d={path(item.points)} fill="none" stroke={item.color} strokeWidth="3"
            strokeDasharray={item.dash} vectorEffect="non-scaling-stroke" />
          {item.visiblePoints.map(point => <circle key={point.timestamp} cx={x(point.timestamp)} cy={y(point.count)} r="4"
            fill={item.color}><title>{`${item.label}: ${dateFormat.format(point.timestamp)} · ${point.count}`}</title></circle>)}
        </g>)}
        <text x={left} y="210" textAnchor="start" className="fill-current text-[11px]">
          {dateFormat.format(visibleStart)}
        </text>
        <text x={right} y="210" textAnchor="end" className="fill-current text-[11px]">
          {dateFormat.format(visibleEnd)}
        </text>
      </svg>}
      <ul aria-label={t('Leyenda de evolución', 'Timeline legend')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-textSub">
        {series.map(item => <li key={item.label}
          className="flex items-center gap-2">
          <svg aria-hidden="true" width="20" height="8" className="shrink-0">
            <line x1="0" x2="20" y1="4" y2="4" stroke={item.color} strokeWidth="3" strokeDasharray={item.dash} />
          </svg>
          <span>{item.label}: <span className="tabular-nums">{item.points[item.points.length - 1]?.count ?? 0}</span></span>
        </li>)}
      </ul>
      <p className="mt-2 text-xs text-textSub">
        {prizeEvents === undefined
          ? t('El backend no proporciona todavía el historial de premios.', 'The backend does not provide prize history yet.')
          : t('Acumulados con fecha disponible. Los canjes de Kivly no están disponibles.',
            'Cumulative totals with available timestamps. Kivly redemptions are not available.')}
      </p>
      {undated > 0 && <p role="status" className="mt-1 text-xs text-textSub">
        {t('Movimientos de premios sin fecha, excluidos del gráfico', 'Prize events without timestamps, excluded from the chart')}: {undated}
      </p>}
    </div>
  )
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

export default function AnalyticsAdmin() {
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
  const playerAnalytics = useMemo(() => responses
    ? buildPlayerAnalytics(responses.players, responses.questions)
    : null, [responses])
  const percentageFormat = new Intl.NumberFormat(language === 'en' ? 'en-GB' : 'es-ES', {
    maximumFractionDigits: 1,
  })
  const countryNames = new Intl.DisplayNames([language === 'en' ? 'en-GB' : 'es-ES'], { type: 'region' })
  const selectedGame = games.find(game => game.gameId === selectedId)

  return (
    <section aria-label={t('Analíticas', 'Analytics')} className="mt-6 space-y-6">
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
      {responseStatus === 'loading' && <p role="status">{t('Cargando analíticas…', 'Loading analytics…')}</p>}
      {responseStatus === 'error' && <div role="alert" className="space-y-2">
        <p>{t('No se pudieron cargar las analíticas.', 'Could not load analytics.')}</p>
        <button type="button" className="rounded-lg border border-current/20 px-3 py-2"
          onClick={() => setRetry(value => value + 1)}>{t('Reintentar', 'Retry')}</button>
      </div>}
      {responseStatus === 'ready' && responses && summary && playerAnalytics && (
        <>
          <section aria-label={t('Métricas de jugadores', 'Player metrics')} className="space-y-4">
            <h2 className="text-lg font-semibold">{t('Métricas de jugadores', 'Player metrics')}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="card p-4">
                <p className="text-sm text-textSub">{t('Jugadores registrados', 'Registered players')}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{playerAnalytics.playerCount}</p>
              </article>
              <article className="card p-4">
                <p className="text-sm text-textSub">{t('Con respuestas', 'With answers')}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{playerAnalytics.answeredCount}</p>
              </article>
              <article className="card p-4">
                <p className="text-sm text-textSub">{t('Cuestionarios completados', 'Completed questionnaires')}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">{playerAnalytics.completedCount}</p>
              </article>
              <article className="card p-4">
                <p className="text-sm text-textSub">{t('Tasa de finalización', 'Completion rate')}</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {percentageFormat.format(playerAnalytics.playerCount
                    ? playerAnalytics.completedCount / playerAnalytics.playerCount * 100
                    : 0)}%
                </p>
              </article>
            </div>
          </section>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-label={t('Registros acumulados', 'Cumulative registrations')} className="card flex h-[28rem] min-h-0 flex-col gap-4 overflow-hidden p-4 sm:p-6">
              <h2 className="text-lg font-semibold">{t('Evolución de registros', 'Registration timeline')}</h2>
              <RegistrationChart points={playerAnalytics.registrations} prizeEvents={responses.prizeEvents} language={language} t={t} />
            </section>
            <section aria-label={t('Países de los jugadores', 'Player countries')} className="card flex h-[28rem] min-h-0 flex-col gap-4 overflow-hidden p-4 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold">{t('Países de los jugadores', 'Player countries')}</h2>
                <p className="mt-1 text-sm text-textSub">
                  {t('Inferidos a partir del prefijo del teléfono.', 'Inferred from the phone calling code.')}
                </p>
              </div>
              {playerAnalytics.countries.length === 0 && <p className="text-sm text-textSub">
                {t('Todavía no hay jugadores registrados.', 'There are no registered players yet.')}
              </p>}
              <PlayerCountriesMap countries={playerAnalytics.countries}
                countryName={code => countryNames.of(code) ?? code}
                percentageFormat={percentageFormat} playerCount={playerAnalytics.playerCount} t={t} />
            </section>
          </div>
          <section aria-label={t('Respuestas del cuestionario', 'Questionnaire responses')} className="card space-y-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{t('Respuestas del cuestionario', 'Questionnaire responses')}</h2>
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
