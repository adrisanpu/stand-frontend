import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getFormResponses, type FormResponsePlayer, type FormResponseQuestion, type FormResponses } from '../../api/formResponses'
import { listOperatorGames, type OperatorGame } from '../../api/operatorGames'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import { OPTIONAL_REGISTRATION_FIELDS } from '../lib/participantFields'

const PAGE_SIZE = 25

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
    ...OPTIONAL_REGISTRATION_FIELDS.map(field => language === 'en' ? field.en : field.es),
    ...questions.map(question => question.text),
  ]
  const rows = players.map(player => [
    player.playerId,
    player.name,
    player.email,
    player.completed ? 'true' : 'false',
    player.completedAt,
    player.phone,
    ...OPTIONAL_REGISTRATION_FIELDS.map(({ key }) => player[key]),
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

function dateLabel(value: string | null, language: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return null
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'es-ES', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
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
  const [search, setSearch] = useState('')
  const [completion, setCompletion] = useState<'all' | 'completed' | 'pending'>('all')
  const [page, setPage] = useState(1)

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

  const filteredPlayers = useMemo(() => {
    if (!responses) return []
    const query = search.trim().toLocaleLowerCase()
    return responses.players.filter(player =>
      (completion === 'all' || player.completed === (completion === 'completed'))
      && (!query || `${player.playerId} ${player.name ?? ''} ${player.email ?? ''}`.toLocaleLowerCase().includes(query)),
    )
  }, [completion, responses, search])
  const pageCount = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE))
  const visiblePlayers = filteredPlayers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const completedCount = responses?.players.filter(player => player.completed).length ?? 0

  useEffect(() => { setPage(1) }, [selectedId, search, completion])

  const selectedGame = games.find(game => game.gameId === selectedId)
  const formatAnswer = (player: FormResponsePlayer, question: FormResponseQuestion) => {
    const payload = player.answers[question.id]
    return payload
      ? question.options.find(option => option.payload === payload)?.title ?? payload
      : '—'
  }

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
      {responseStatus === 'ready' && responses && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="card p-4">
              <p className="text-sm text-textSub">{t('Personas registradas', 'Registered participants')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{responses.players.length}</p>
            </article>
            <article className="card p-4">
              <p className="text-sm text-textSub">{t('Formulario completado', 'Form completed')}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{completedCount}</p>
            </article>
          </div>
          {responses.questions.map(question => {
            const counts = question.options.map(option => ({
              ...option,
              count: responses.players.filter(player => player.answers[question.id] === option.payload).length,
            }))
            return <section key={question.id} className="card space-y-3 p-4"
              aria-label={t(`Distribución: ${question.text}`, `Distribution: ${question.text}`)}>
              <h2 className="font-semibold">{question.text}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {counts.map(option => <li key={option.payload}
                  className="flex justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-sm">
                  <span>{option.title}</span><span className="tabular-nums text-textSub">{option.count}</span>
                </li>)}
              </ul>
            </section>
          })}
          <section aria-label={t('Detalle de respuestas', 'Response details')} className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <input type="search" value={search} maxLength={200}
                aria-label={t('Buscar participantes', 'Search participants')}
                placeholder={t('Nombre, email o número', 'Name, email or number')}
                onChange={event => setSearch(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-current/20 bg-transparent px-3 py-2 sm:max-w-sm" />
              <select aria-label={t('Filtrar por estado', 'Filter by status')} value={completion}
                onChange={event => setCompletion(event.target.value as typeof completion)}
                className="rounded-lg border border-current/20 bg-transparent px-3 py-2 text-textMain">
                <option value="all">{t('Todos los estados', 'All statuses')}</option>
                <option value="completed">{t('Completado', 'Completed')}</option>
                <option value="pending">{t('Pendiente', 'Pending')}</option>
              </select>
              <button type="button" disabled={!responses || !canExportResults}
                onClick={() => downloadCsv(responses.gameId, filteredPlayers, responses.questions, t, language)}
                title={!canExportResults ? t('Disponible en el plan Event', 'Available on the Event plan') : undefined}
                className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:opacity-90 disabled:opacity-40">
                {t('Exportar CSV', 'Export CSV')}
              </button>
              {!canExportResults && <p className="text-sm text-textSub">
                {t('Exportar resultados está disponible en el plan Event.', 'Results export is available on the Event plan.')}
              </p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-sm tabular-nums text-textSub">
                {filteredPlayers.length ? `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, filteredPlayers.length)}` : '0'}
                {' '}{t('de', 'of')} {filteredPlayers.length}
              </p>
              <nav aria-label={t('Paginación de respuestas', 'Response pagination')} className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)}
                  className="rounded-lg border border-current/20 px-3 py-2 disabled:opacity-40">
                  {t('Anterior', 'Previous')}
                </button>
                <span className="text-sm tabular-nums text-textSub">{page} / {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)}
                  className="rounded-lg border border-current/20 px-3 py-2 disabled:opacity-40">
                  {t('Siguiente', 'Next')}
                </button>
              </nav>
            </div>
            {filteredPlayers.length === 0
              ? <p className="text-sm text-textSub">{t('No hay respuestas que coincidan con el filtro.', 'No responses match the filter.')}</p>
              : <div className="overflow-x-auto rounded-lg border border-current/10">
                <table className="admin-table w-full text-left text-sm">
                  <caption className="sr-only">{t('Detalle de respuestas', 'Response details')}</caption>
                  <thead><tr>
                    {[t('Participante', 'Participant'), t('Email', 'Email'), t('Estado', 'Status'),
                      t('Fecha de finalización', 'Completion date'), t('Teléfono', 'Phone'),
                      ...OPTIONAL_REGISTRATION_FIELDS.map(field => t(field.es, field.en)), ...responses.questions.map(question => question.text)]
                      .map((label, index) => <th key={`${label}-${index}`} scope="col" className="whitespace-nowrap">{label}</th>)}
                  </tr></thead>
                  <tbody>{visiblePlayers.map(player => (
                    <tr key={String(player.playerId)} className="border-t border-current/10">
                      <th scope="row" className="whitespace-nowrap p-2 font-medium">
                        {player.name?.trim() || `#${player.playerId}`}
                      </th>
                      <td className="p-2">{player.email || '—'}</td>
                      <td className="p-2">{player.completed
                        ? t('Completado', 'Completed') : t('Pendiente', 'Pending')}</td>
                      <td className="whitespace-nowrap p-2 text-textSub">
                        {dateLabel(player.completedAt, language) ?? '—'}
                      </td>
                      <td className="p-2">{player.phone || '—'}</td>
                      {OPTIONAL_REGISTRATION_FIELDS.map(({ key }) => <td key={key} className="p-2">{player[key] || '—'}</td>)}
                      {responses.questions.map(question => <td key={question.id} className="min-w-40 p-2">
                        {formatAnswer(player, question)}
                      </td>)}
                    </tr>
                  ))}</tbody>
                </table>
              </div>}
          </section>
        </>
      )}
    </section>
  )
}
