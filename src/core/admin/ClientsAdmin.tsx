import { Fragment, useEffect, useState } from 'react'
import { getClientHistory, removeClientFromGame, searchClients, type ClientAward, type ClientHistory, type ClientSummary } from '../../api/clients'
import { getGameById } from '../../games'
import { useOperatorLanguage } from '../shell/operatorLanguage'

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
  const [historyReload, setHistoryReload] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')
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
    setConfirmRemove(null)
    setRemoveError('')
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
  }, [selectedId, historyReload])

  const clientLabel = (client: ClientSummary) => client.name?.trim() || client.email
  const sourceLabel = (award: ClientAward) => award.source === 'kivly' ? 'Kivly'
    : award.source === 'stand' ? 'STAND' : t('Origen no disponible', 'Source unavailable')

  const removeParticipation = async (gameId: string, playerId: number) => {
    if (removing || !selectedId) return
    setRemoving(true)
    setRemoveError('')
    try {
      await removeClientFromGame(gameId, playerId)
      setConfirmRemove(null)
      setClients(current => current.map(client => client.id === selectedId
        ? { ...client, participationCount: Math.max(0, client.participationCount - 1) } : client))
      setHistoryReload(value => value + 1)
    } catch {
      setRemoveError(t('No se pudo eliminar al jugador de la partida.', 'Could not remove the player from the event.'))
    } finally {
      setRemoving(false)
    }
  }

  const historyPanel = selectedId && (
    <section id={`client-history-${selectedId}`} aria-label={t('Historial del cliente', 'Client history')} className="py-2">
      {historyStatus === 'loading' && <p role="status">{t('Cargando historial…', 'Loading history…')}</p>}
      {historyStatus === 'error' && <p role="alert">{t('No se pudo cargar el historial.', 'Could not load history.')}</p>}
      {removeError && <p role="alert" className="text-sm text-red-400">{removeError}</p>}
      {historyStatus === 'ready' && history && history.client.id === selectedId && (
        history.participations.length === 0
          ? <p className="text-sm text-textSub">{t('No hay participaciones disponibles.', 'No participation records are available.')}</p>
          : <table className="admin-table w-full text-left text-sm" aria-label={t('Participaciones', 'Participations')}>
            <thead>
              <tr>
                {[t('Partida', 'Event'), t('Fecha', 'Date'), t('Premio', 'Prize'), t('Origen', 'Source'), t('Estado', 'Status'), t('Acciones', 'Actions')]
                  .map(label => <th key={label} scope="col" className="whitespace-nowrap p-2">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {history.participations.map((participation, index) => {
                const definition = participation.gameType ? getGameById(participation.gameType) : undefined
                const span = Math.max(participation.awards.length, 1)
                const date = dateLabel(participation.joinedAt, language)
                const lead = <>
                  <th scope="row" rowSpan={span} className="p-2 align-top font-medium">
                    <span className="flex items-center gap-2">
                      {definition?.assets?.logo && <img src={definition.assets.logo} alt="" title={definition.name} className="h-8 w-8 shrink-0 object-contain" />}
                      {participation.gameName || participation.gameId}
                    </span>
                  </th>
                  <td rowSpan={span} className="whitespace-nowrap p-2 align-top text-textSub">
                    {date ? <time dateTime={participation.joinedAt ?? undefined}>{date}</time> : '—'}
                  </td>
                </>
                const key = `:`
                const playerId = participation.playerId
                const action = <td rowSpan={span} className="p-2 align-top">
                  {playerId === undefined ? '—' : confirmRemove === key
                    ? <span className="flex flex-wrap gap-2">
                      <button type="button" disabled={removing} className="min-h-9 rounded-md bg-red-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
                        onClick={() => void removeParticipation(participation.gameId, playerId)}>
                        {removing ? t('Eliminando…', 'Removing…') : t('Confirmar eliminación', 'Confirm removal')}
                      </button>
                      <button type="button" disabled={removing} className="min-h-9 rounded-md border border-current/20 px-3 text-xs"
                        onClick={() => setConfirmRemove(null)}>{t('Cancelar', 'Cancel')}</button>
                    </span>
                    : <button type="button" disabled={removing} className="min-h-9 whitespace-nowrap rounded-md border border-red-400/60 px-3 text-xs text-red-300 disabled:opacity-50"
                      aria-label={t(`Eliminar de la partida `, `Remove from event `)}
                      onClick={() => { setRemoveError(''); setConfirmRemove(key) }}>
                      {t('Eliminar de la partida', 'Remove from event')}
                    </button>}
                </td>
                if (!participation.awards.length) return (
                  <tr key={`${participation.gameId}-${index}`} className="border-t border-current/10">
                    {lead}
                    <td colSpan={3} className="p-2 text-textSub">{t('Sin premios registrados.', 'No recorded prizes.')}</td>
                    {action}
                  </tr>
                )
                return participation.awards.map((award, awardIndex) => (
                  <tr key={`${participation.gameId}-${index}-${award.id}`} className={awardIndex ? '' : 'border-t border-current/10'}>
                    {awardIndex === 0 && lead}
                    <td className="p-2 align-top">
                      <span className="flex items-center gap-2">
                        {award.imageUrl && <img src={award.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />}
                        <span className="font-medium">{award.name || t('Premio sin nombre', 'Unnamed prize')}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap p-2 align-top text-textSub">{sourceLabel(award)}</td>
                    <td className="p-2 align-top">
                      <ul className="space-y-0.5 text-xs text-textSub">
                        {awardStatus(award, language, t).map(status => <li key={status}>{status}</li>)}
                      </ul>
                    </td>
                    {awardIndex === 0 && action}
                  </tr>
                ))
              })}
            </tbody>
          </table>
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
        <div className="overflow-x-auto rounded-lg border border-current/10">
          <table className="admin-table w-full text-left text-sm" aria-label={t('Listado de clientes', 'Client list')}>
            <caption className="sr-only">{t('Listado de clientes', 'Client list')}</caption>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">{t('Selección', 'Selection')}</span></th>
                {[t('Cliente', 'Client'), t('Email', 'Email'), t('Teléfono', 'Phone'), t('Participaciones', 'Participations')]
                  .map(label => <th key={label} scope="col" className="whitespace-nowrap">{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {clients.map(client => {
                const isSelected = selectedId === client.id
                return (
                  <Fragment key={client.id}>
                    <tr onClick={() => setSelectedId(current => current === client.id ? null : client.id)}
                      className={`cursor-pointer border-t border-current/10 ${isSelected ? 'bg-primary/5' : ''}`}>
                      <td className="w-10">
                        <input type="radio" name="client-selection" checked={isSelected}
                          aria-label={t(`Ver historial de ${clientLabel(client)}`, `View history for ${clientLabel(client)}`)}
                          aria-controls={isSelected ? `client-history-${client.id}` : undefined}
                          className="h-4 w-4 accent-primary"
                          onClick={event => event.stopPropagation()}
                          onChange={() => setSelectedId(current => current === client.id ? null : client.id)} />
                      </td>
                      <th scope="row" className="break-words font-medium">{clientLabel(client)}</th>
                      <td className="whitespace-nowrap">{client.email}</td>
                      <td className="whitespace-nowrap">{client.phone || <span className="text-textSub">—</span>}</td>
                      <td className="tabular-nums">{client.participationCount}</td>
                    </tr>
                    {isSelected && <tr className="bg-primary/5">
                      <td colSpan={5} className="px-3 pb-3">{historyPanel}</td>
                    </tr>}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
