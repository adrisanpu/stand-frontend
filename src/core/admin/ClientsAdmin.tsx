import { useEffect, useState } from 'react'
import { getClientHistory, searchClients, type ClientAward, type ClientHistory, type ClientSummary } from '../../api/clients'
import { getGameById } from '../../games'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import IconButton from '../ui/IconButton'

function dateLabel(value: string | null, language: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return null
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'es-ES', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
}

function awardStatus(
  award: ClientAward,
  language: string,
  t: (spanish: string, english?: string) => string,
) {
  const emailStates: Record<string, string> = {
    pending: t('Pendiente', 'Pending'),
    sending: t('Enviando', 'Sending'),
    accepted: t('Aceptado para envío', 'Accepted for sending'),
    failed: t('Fallido', 'Failed'),
    blocked: t('Bloqueado', 'Blocked'),
    reconciliation_required: t('Requiere revisión', 'Requires review'),
  }
  const assignmentStates: Record<string, string> = {
    queued: t('En cola', 'Queued'),
    confirmed: t('Confirmada', 'Confirmed'),
    connection_required: t('Requiere conexión', 'Connection required'),
    reconciliation_required: t('Requiere revisión', 'Requires review'),
  }
  const awardStates: Record<string, string> = {
    available: t('Pendiente de recogida', 'Awaiting collection'),
    delivered: t('Recogido', 'Collected'),
    queued: t('En cola', 'Queued'),
    confirmed: t('Confirmado', 'Confirmed'),
    connection_required: t('Requiere conexión', 'Connection required'),
    reconciliation_required: t('Requiere revisión', 'Requires review'),
  }
  const states = [
    t('Premio ganado', 'Prize won'),
    award.source === 'kivly'
      ? `${t('Asignación Kivly', 'Kivly assignment')}: ${assignmentStates[award.kivlyAssignmentState ?? ''] ?? t('Estado no disponible', 'Status unavailable')}`
      : `${t('Recogida STAND', 'STAND collection')}: ${award.collected
        ? t('Recogido', 'Collected')
        : awardStates[award.awardState ?? ''] ?? t('Estado no disponible', 'Status unavailable')}`,
  ]
  if (award.emailState) {
    states.push(`${t('Email', 'Email')}: ${emailStates[award.emailState] ?? t('Estado no disponible', 'Status unavailable')}`)
  }
  if (award.collectedAt) {
    states.push(`${t('Fecha de recogida', 'Collected')}: ${dateLabel(award.collectedAt, language) ?? award.collectedAt}`)
  }
  return states
}

export default function ClientsAdmin() {
  const { language, t } = useOperatorLanguage()
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [retry, setRetry] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [history, setHistory] = useState<ClientHistory | null>(null)
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('ready')
  useEffect(() => {
    if (search.trim() === query) return
    const timer = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, query])

  useEffect(() => {
    let cancelled = false
    setListStatus('loading')
    setSelectedId(null)
    void searchClients(page, query).then(result => {
      if (!cancelled) {
        setClients(result.clients)
        setTotal(result.total)
        setPage(result.page)
        setListStatus('ready')
      }
    }).catch(() => {
      if (!cancelled) setListStatus('error')
    })
    return () => { cancelled = true }
  }, [page, query, retry])

  useEffect(() => {
    if (!selectedId) {
      setHistory(null)
      setHistoryStatus('ready')
      return
    }
    let cancelled = false
    setHistoryStatus('loading')
    void getClientHistory(selectedId).then(result => {
      if (!cancelled) {
        setHistory(result)
        setHistoryStatus('ready')
      }
    }).catch(() => {
      if (!cancelled) {
        setHistory(null)
        setHistoryStatus('error')
      }
    })
    return () => { cancelled = true }
  }, [selectedId])

  const clientLabel = (client: ClientSummary) => client.name?.trim() || client.email
  const renderAward = (award: ClientAward) => (
    <article key={award.id} className="rounded-lg border border-current/10 px-3 py-2">
      <div className="flex items-center gap-2">
        {award.imageUrl && <img src={award.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded object-contain" />}
        <p className="font-medium">{award.name || t('Premio sin nombre', 'Unnamed prize')}</p>
      </div>
      <p className="text-xs text-textSub">{award.source === 'kivly' ? 'Kivly' : award.source === 'stand' ? 'STAND' : t('Origen no disponible', 'Source unavailable')}</p>
      <ul className="mt-1 space-y-0.5 text-sm text-textSub">
        {awardStatus(award, language, t).map(status => <li key={status}>{status}</li>)}
      </ul>
    </article>
  )

  const historyPanel = selectedId && (
    <section id={`client-history-${selectedId}`} aria-label={t('Historial del cliente', 'Client history')} className="border-t border-current/10 p-3 sm:p-4">
      <div className="mb-2 flex justify-end">
        <IconButton icon="remove" label={t('Cerrar', 'Close')} onClick={() => setSelectedId(null)} />
      </div>
      {historyStatus === 'loading' && <p role="status">{t('Cargando historial…', 'Loading history…')}</p>}
      {historyStatus === 'error' && <p role="alert">{t('No se pudo cargar el historial.', 'Could not load history.')}</p>}
      {historyStatus === 'ready' && history && history.client.id === selectedId && (
        <>
          <div className="space-y-3">
            {history.participations.map((participation, index) => {
              const definition = participation.gameType ? getGameById(participation.gameType) : undefined
              return (
              <article key={`${participation.gameId}-${index}`} className="rounded-lg bg-surface/50 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="flex items-center gap-2">
                    {definition?.assets?.logo && <img src={definition.assets.logo} alt={definition.name} className="h-8 w-8 shrink-0 object-contain" />}
                    <h3 className="font-medium">{participation.gameName || participation.gameId}</h3>
                  </div>
                  {dateLabel(participation.joinedAt, language) && (
                    <time dateTime={participation.joinedAt ?? undefined} className="text-xs text-textSub">
                      {dateLabel(participation.joinedAt, language)}
                    </time>
                  )}
                </div>
                {participation.awards.length > 0
                  ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{participation.awards.map(renderAward)}</div>
                  : <p className="mt-2 text-sm text-textSub">{t('Sin premios registrados.', 'No recorded prizes.')}</p>}
              </article>
              )
            })}
            {history.participations.length === 0 && (
              <p className="text-sm text-textSub">{t('No hay participaciones disponibles.', 'No participation records are available.')}</p>
            )}
          </div>
        </>
      )}
    </section>
  )

  return (
    <section aria-label={t('Clientes', 'Clients')} className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input type="search" value={search} maxLength={200}
          aria-label={t('Filtrar clientes', 'Filter clients')}
          placeholder={t('Buscar por nombre, email o teléfono', 'Search by name, email or phone')}
          onChange={event => setSearch(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-current/20 bg-transparent px-3 py-2 sm:max-w-md" />
        <nav aria-label={t('Paginación de clientes', 'Client pagination')} className="flex items-center gap-2">
          <span aria-live="polite" className="text-sm tabular-nums text-textSub">
            {total ? (page - 1) * 25 + 1 : 0}-{Math.min(page * 25, total)} {t('de', 'of')} {total}
          </span>
          <button type="button" aria-label={t('Página anterior', 'Previous page')}
            title={t('Página anterior', 'Previous page')} disabled={listStatus !== 'ready' || page <= 1}
            className="rounded-lg p-2 disabled:opacity-30" onClick={() => setPage(current => current - 1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 6-6 6 6 6" /></svg>
          </button>
          <button type="button" aria-label={t('Página siguiente', 'Next page')}
            title={t('Página siguiente', 'Next page')} disabled={listStatus !== 'ready' || page * 25 >= total}
            className="rounded-lg p-2 disabled:opacity-30" onClick={() => setPage(current => current + 1)}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </nav>
      </div>
      {listStatus === 'loading' && <p role="status">{t('Cargando clientes…', 'Loading clients…')}</p>}
      {listStatus === 'error' && (
        <div role="alert" className="space-y-2">
          <p>{t('No se pudieron cargar los clientes.', 'Could not load clients.')}</p>
          <button type="button" className="rounded-lg border border-current/20 px-3 py-2"
            onClick={() => setRetry(current => current + 1)}>{t('Reintentar', 'Retry')}</button>
        </div>
      )}
      {listStatus === 'ready' && clients.length === 0 && (
        <p className="text-textSub">{query
          ? t('No hay clientes que coincidan con el filtro.', 'No clients match the filter.')
          : t('Todavía no hay clientes con email verificado.', 'There are no clients with a verified email yet.')}</p>
      )}
      {listStatus === 'ready' && clients.length > 0 && (
        <ul aria-label={t('Listado de clientes', 'Client list')} className="divide-y divide-current/10 rounded-xl border border-current/10">
          {clients.map(client => (
            <li key={client.id}>
              <button type="button" onClick={() => setSelectedId(current => current === client.id ? null : client.id)}
                aria-expanded={selectedId === client.id}
                aria-controls={selectedId === client.id ? `client-history-${client.id}` : undefined}
                aria-label={t(`Ver historial de ${clientLabel(client)}`, `View history for ${clientLabel(client)}`)}
                className={`grid w-full gap-1 px-3 py-3 text-left sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center ${selectedId === client.id ? 'bg-primary/10' : 'hover:bg-surface'}`}>
                <span className="truncate font-medium">{clientLabel(client)}</span>
                <span className="truncate text-sm text-textSub">{client.email}</span>
                <span className="text-xs text-textSub sm:text-right">
                  {[client.phone, `${client.participationCount} ${t('participaciones', 'participations')}`].filter(Boolean).join(' · ')}
                </span>
              </button>
              {selectedId === client.id && historyPanel}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
