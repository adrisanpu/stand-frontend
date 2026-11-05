import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { archiveOperatorGame, deleteOperatorGamePermanently, listOperatorGames, operatorGameHomeUrl, setOperatorGameActive, unarchiveOperatorGame, type OperatorGame } from '../../api/operatorGames'
import { games as catalog, getGameById } from '../../games'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import CreateGameDialog from './CreateGameDialog'
import GameConfigurationDialog from './GameConfigurationDialog'
import GameShowcase from './GameShowcase'

const actionPaths = {
  create: 'M12 5v14M5 12h14',
  open: 'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',
  activate: 'm8 5 11 7-11 7Z',
  deactivate: 'M7 5h3v14H7zM14 5h3v14h-3z',
  closing: 'M5 3h14M5 21h14M7 3v4l10 10v4M17 3v4L7 17v4',
  archive: 'M4 8h16v13H4zM3 3h18v5H3zM9 12h6',
  restore: 'M4 10v11h16V10M3 3h18v5H3zM12 17V10m-3 3 3-3 3 3',
  delete: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  reload: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M18 18a8 8 0 0 1-14-6',
  confirm: 'm5 12 4 4L19 6',
  cancel: 'm6 6 12 12M6 18 18 6',
  configure: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
}

function ActionIcon({ name }: { name: keyof typeof actionPaths }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
    <path d={actionPaths[name]} />
  </svg>
}

export default function AdminGames() {
  const { language, t } = useOperatorLanguage()
  const [params, setParams] = useSearchParams()
  const archived = params.get('archived') === '1'
  const [search, setSearch] = useState('')
  const [games, setGames] = useState<OperatorGame[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [version, setVersion] = useState(0)
  const [loadedArchive, setLoadedArchive] = useState<boolean | null>(null)
  const [confirm, setConfirm] = useState<{ gameId: string; action: 'archive' | 'delete' | 'deactivate' } | null>(null)
  const [confirmationName, setConfirmationName] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const busy = useRef(false)
  const [actionError, setActionError] = useState('')
  const [configureId, setConfigureId] = useState<string | null>(null)
  const [chosenId, setChosenId] = useState('')
  const actionDialog = useRef<HTMLDivElement>(null)

  const runAction = async (game: OperatorGame, action: 'archive' | 'delete' | 'restore' | 'toggle') => {
    if (busy.current) return
    busy.current = true
    setBusyId(game.gameId)
    setActionError('')
    try {
      if (action !== 'toggle') {
        if (action === 'archive') await archiveOperatorGame(game.gameId)
        else if (action === 'restore') await unarchiveOperatorGame(game.gameId)
        else await deleteOperatorGamePermanently(game.gameId, confirmationName)
        setGames(current => current.filter(item => item.gameId !== game.gameId))
      } else {
        const nextActive = !game.isActive
        const activity = await setOperatorGameActive(game.gameId, nextActive)
        setGames(current => current.map(item => item.gameId === game.gameId ? { ...item, ...activity } : item))
      }
      setConfirm(null)
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? error.code : undefined
      const knownErrors: Record<string, string> = {
        GameDeletionInProgress: t('El borrado está iniciado. Recarga las partidas y reintenta para completarlo. No se puede desarchivar.', 'Deletion has started. Reload events and retry to finish. Restoration is unavailable.'),
        GameMediaDeletionFailed: t('No se pudieron eliminar todos los archivos. Recarga y reintenta el borrado.', 'Not all media could be deleted. Reload and retry deletion.'),
        GameDeletionCheckIncomplete: t('No se pudo preparar el borrado en esta petición; no se ha eliminado ningún dato. Recarga y reintenta.', 'Deletion could not be prepared in this request; no data has been deleted. Reload and retry.'),
        GameDeletionUnavailable: t('El borrado no está disponible por la configuración del backend. No se ha confirmado ningún borrado.', 'Deletion is unavailable due to backend configuration. No deletion has been confirmed.'),
      }
      setActionError((typeof code === 'string' && knownErrors[code]) || t(
        'No se pudo confirmar el cambio. Recarga las partidas para comprobar su estado antes de reintentar.',
        'Could not confirm the change. Reload events to check their state before retrying.',
      ))
    } finally {
      busy.current = false
      setBusyId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setConfirm(null)
    setConfirmationName('')
    setActionError('')
    void listOperatorGames(archived).then(result => {
      if (cancelled) return
      setGames(result)
      setLoadedArchive(archived)
      setStatus('ready')
    }).catch(() => {
      if (!cancelled) setStatus('error')
    })
    return () => { cancelled = true }
  }, [version, archived])

  const closing = games.some(game => game.lifecycleState === 'closing' || game.stackPrizeState === 'closing')
  useEffect(() => {
    if (!closing || busyId !== null || actionError || configureId) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void listOperatorGames(archived).then(result => {
        if (!cancelled) setGames(result)
      }).catch(() => {
        if (!cancelled) setActionError(t(
          'No se pudo actualizar el estado de las partidas. Recarga para comprobarlo.',
          'Could not update event status. Reload events to check it.',
        ))
      })
    }, 10000)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [closing, games, archived, busyId, actionError, version, configureId, t])

  const dateLabel = (game: OperatorGame) => game.createdAt
    ? new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'es-ES', { dateStyle: 'medium' }).format(new Date(game.createdAt))
    : t('No disponible', 'Unavailable')
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
  const terms = normalize(search).split(/\s+/).filter(Boolean)
  const typeOf = (game: OperatorGame) => getGameById(game.gameType)?.id ?? game.gameType.toUpperCase()
  const counts = games.reduce<Record<string, number>>((result, game) => {
    const type = typeOf(game)
    result[type] = (result[type] ?? 0) + 1
    return result
  }, {})
  const requestedType = params.get('game')?.toUpperCase() ?? ''
  const selectedType = catalog.some(game => game.id === requestedType)
    ? requestedType
    : (catalog.find(game => counts[game.id]) ?? catalog[0])?.id ?? ''
  const selectGameType = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('game', id)
    setParams(next, { replace: true })
  }
  const typeGames = games.filter(game => typeOf(game) === selectedType)
  const filtered = typeGames.filter(game => {
    const fields = normalize([
      game.gameName, game.gameType, getGameById(game.gameType)?.name ?? '',
      game.createdAt ?? '', dateLabel(game), game.playerCount?.toString() ?? '',
    ].join(' '))
    return terms.every(term => fields.includes(term))
  })
  const setCatalogOpen = (open: boolean) => {
    const next = new URLSearchParams(params)
    if (open) next.set('create', '1')
    else next.delete('create')
    setParams(next, { replace: true })
  }
  const ready = status === 'ready' && loadedArchive === archived
  const confirmingGame = confirm ? games.find(game => game.gameId === confirm.gameId) : undefined

  useEffect(() => {
    if (!confirm) return
    const previousFocus = document.activeElement
    actionDialog.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [confirm])

  const hasGameParam = params.has('game')
  useEffect(() => {
    if (!ready || hasGameParam || !selectedType) return
    const next = new URLSearchParams(params)
    next.set('game', selectedType)
    setParams(next, { replace: true })
  }, [ready, hasGameParam, selectedType, params, setParams])
  useEffect(() => { setChosenId('') }, [selectedType, archived])
  const chosenGame = filtered.find(game => game.gameId === chosenId) ?? filtered[0]

  const renderActions = (game: OperatorGame | undefined) => {
    const stack = game?.gameType.toUpperCase() === 'STACK'
    const isClosing = !!game && (game.lifecycleState === 'closing' || (!game.lifecycleState && game.stackPrizeState === 'closing'))
    const canEnter = !!game && (game.isActive === true || !!game.lifecycleState || (stack && (game.stackPrizeState === 'closing' || game.stackPrizeState === 'closed')))
    const blocked = !game || busyId !== null || !!actionError
    const activityLabel = isClosing ? t('Desactivando…', 'Deactivating…') : game?.isActive ? t('Desactivar', 'Deactivate') : t('Activar', 'Activate')
    return <>
      <div className="flex flex-wrap gap-2">
        {archived ? <>
          <button type="button" disabled={blocked || !!game?.deletionStartedAt}
            aria-label={t('Desarchivar', 'Restore')} title={t('Desarchivar', 'Restore')}
            className="rounded-xl border border-current/20 p-3 disabled:opacity-50"
            onClick={() => game && void runAction(game, 'restore')}><ActionIcon name="restore" /></button>
          <button type="button" disabled={blocked} className="rounded-xl border border-red-400/40 p-3 disabled:opacity-50"
            aria-label={t('Borrar definitivamente', 'Delete permanently')} title={t('Borrar definitivamente', 'Delete permanently')}
            onClick={() => { if (game) { setConfirmationName(''); setConfirm({ gameId: game.gameId, action: 'delete' }) } }}>
            <ActionIcon name="delete" />
          </button>
        </> : <>
          {game && canEnter ? <Link to={operatorGameHomeUrl(game.gameId)} className="rounded-xl border border-current/20 bg-primary/20 p-3"
            title={t('Entrar', 'Open')}
            aria-label={t(`Entrar en la partida ${game.gameName}`, `Open event ${game.gameName}`)}>
            <ActionIcon name="open" />
          </Link> : <button type="button" disabled className="rounded-xl border border-current/20 p-3 opacity-50"
            aria-label={t('Entrar', 'Open')} title={t('Entrar', 'Open')}><ActionIcon name="open" /></button>}
          <button type="button" disabled={blocked} className="rounded-xl border border-current/20 p-3 disabled:opacity-50"
            aria-label={game ? t(`Configurar partida ${game.gameName}`, `Configure event ${game.gameName}`) : t('Configurar partida', 'Event settings')}
            title={t('Configurar partida', 'Event settings')} onClick={() => game && setConfigureId(game.gameId)}>
            <ActionIcon name="configure" />
          </button>
          <button type="button" disabled={blocked || isClosing || game?.isActive === undefined}
            aria-label={activityLabel} title={activityLabel}
            className="rounded-xl border border-current/20 p-3 disabled:opacity-50"
            onClick={() => { if (game) { if (game.isActive) setConfirm({ gameId: game.gameId, action: 'deactivate' }); else void runAction(game, 'toggle') } }}>
            <ActionIcon name={isClosing ? 'closing' : game?.isActive ? 'deactivate' : 'activate'} />
          </button>
          <button type="button" disabled={blocked || game?.isActive !== false} className="rounded-xl border border-red-400/40 p-3 disabled:opacity-50"
            aria-label={t('Archivar', 'Archive')} title={t('Archivar', 'Archive')}
            onClick={() => game && setConfirm({ gameId: game.gameId, action: 'archive' })}><ActionIcon name="archive" /></button>
        </>}
      </div>
      {game?.deletionStartedAt && <p role="status" className="text-xs text-textSub">{t(
        'Borrado iniciado. No se puede desarchivar; reintenta el borrado para completarlo.',
        'Deletion started. Restoration is unavailable; retry deletion to finish.',
      )}</p>}
      {isClosing && <p role="status" className="text-xs text-textSub">{t(
        'Cerrando; puedes archivar para detenerlo ahora.',
        'Closing; archive now to stop it.',
      )}</p>}
      {game && game.isActive === undefined && <p className="text-xs text-textSub">{t('Estado no disponible. Recarga tras actualizar el backend.', 'Status unavailable. Reload after updating the backend.')}</p>}
      {game?.isActive === false && !archived && !canEnter && <p className="text-xs text-textSub">{t('Activa la partida para entrar.', 'Activate the event to open it.')}</p>}
      {game && busyId === game.gameId && <p role="status" className="text-sm">{t('Guardando…', 'Saving…')}</p>}
    </>
  }
  const statusLabel = (game: OperatorGame) => {
    if (archived) return t('Archivada', 'Archived')
    if (game.lifecycleState === 'closing' || (!game.lifecycleState && game.stackPrizeState === 'closing')) return t('Cerrando', 'Closing')
    if (game.isActive === true) return t('Activa', 'Active')
    if (game.isActive === false) return t('Pausada', 'Paused')
    return t('No disponible', 'Unavailable')
  }
  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <label htmlFor="event-search" className="sr-only">{t('Buscar partidas', 'Search events')}</label>
          <input id="event-search" type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder={t('Buscar por partida, fecha o jugadores…', 'Search by event, date or players…')}
            className="w-full rounded-xl border border-current/20 bg-surface px-4 py-3 text-sm text-textMain" />
        </div>
        {actionError && <div role="alert" className="card space-y-2 p-4">
          <p>{actionError}</p>
          <button type="button" disabled={busyId !== null} className="rounded-xl border border-current/20 p-3 disabled:opacity-50"
            aria-label={t('Recargar partidas', 'Reload events')} title={t('Recargar partidas', 'Reload events')} onClick={() => {
            setActionError('')
            setConfirm(null)
            setVersion(version + 1)
          }}><ActionIcon name="reload" /></button>
        </div>}
        <div className="flex items-center justify-end gap-2">
        <button type="button" disabled={busyId !== null} aria-pressed={archived}
          aria-label={archived ? t('Volver a partidas', 'Back to events') : t('Ver partidas archivadas', 'View archived events')}
          title={archived ? t('Volver a partidas', 'Back to events') : t('Ver partidas archivadas', 'View archived events')}
          onClick={() => {
            const next = new URLSearchParams(params)
            if (archived) next.delete('archived')
            else next.set('archived', '1')
            setParams(next)
          }}
          className="rounded-xl border border-current/20 p-3 disabled:opacity-50">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
            {archived ? <path d="m14 6-6 6 6 6M8 12h13" /> : <><path d="M4 8h16v13H4zM3 3h18v5H3zM9 12h6" /></>}
          </svg>
        </button>
        <button type="button" disabled={busyId !== null} onClick={() => setCatalogOpen(true)}
          aria-label={t('Crear partida', 'Create event')} title={t('Crear partida', 'Create event')}
          className="shrink-0 rounded-xl border border-current/20 bg-primary/20 p-3 disabled:opacity-50">
          <ActionIcon name="create" />
        </button>
        </div>
      </div>
      {archived && <h2 className="text-xl font-semibold">{t('Partidas archivadas', 'Archived events')}</h2>}
      {(status === 'loading' || (status === 'ready' && !ready)) && <p role="status">{t('Cargando partidas…', 'Loading events…')}</p>}
      {status === 'error' && <div className="card space-y-3 p-6">
        <p role="alert">{t('No se pudieron cargar tus partidas. Comprueba tu conexión y tu sesión.', 'Could not load your events. Check your connection and session.')}</p>
        <button type="button" className="rounded-xl border border-current/20 p-3" onClick={() => setVersion(version + 1)}
          aria-label={t('Reintentar', 'Retry')} title={t('Reintentar', 'Retry')}>
          <ActionIcon name="reload" />
        </button>
      </div>}
      {ready && <GameShowcase games={catalog} counts={counts} selectedId={selectedType} onSelect={selectGameType} />}
      {ready && games.length === 0 && <div className="card space-y-3 p-6">
        <h2 className="text-xl font-semibold">{archived ? t('No tienes partidas archivadas', 'No archived events') : t('Todavía no tienes partidas', 'No events yet')}</h2>
        <p className="text-textSub">{archived
          ? t('Aquí aparecerán las partidas que archives. Desarchivarlas no las activa.', 'Archived events appear here. Restoring them does not activate them.')
          : t('Pulsa Crear partida para elegir un juego del catálogo.', 'Select Create event to choose a game from the catalog.')}</p>
      </div>}
      {ready && games.length > 0 && typeGames.length === 0 && <p role="status" className="text-center text-textSub">
        {archived ? t('Este juego no tiene partidas archivadas.', 'This game has no archived events.') : t('Este juego no tiene partidas.', 'This game has no events.')}
      </p>}
      {ready && typeGames.length > 0 && filtered.length === 0 && <p role="status">
        {t('No hay partidas que coincidan con tu búsqueda.', 'No events match your search.')}
      </p>}
      {ready && filtered.length > 0 && <div className="card space-y-3 p-4">
        <div role="group" aria-label={t('Acciones de la partida seleccionada', 'Selected event actions')}
          className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <span className="text-sm text-textSub sm:pt-3">{chosenGame
            ? `${t('Seleccionada', 'Selected')}: ${chosenGame.gameName}`
            : t('Selecciona una partida para gestionar sus acciones.', 'Select an event to manage its actions.')}</span>
          <div className="space-y-2 sm:max-w-sm">{renderActions(chosenGame)}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label={archived ? t('Partidas archivadas', 'Archived events') : t('Mis partidas', 'My events')}>
            <caption className="sr-only">{archived ? t('Partidas archivadas', 'Archived events') : t('Mis partidas', 'My events')}</caption>
            <thead><tr>{[t('Selección', 'Selection'), t('Nombre', 'Name'), t('Estado', 'Status'), t('Creada', 'Created'), t('Jugadores', 'Players')]
              .map(label => <th key={label} scope="col" className="p-2 whitespace-nowrap">{label}</th>)}</tr></thead>
            <tbody>{filtered.map(game => {
              const selected = chosenGame?.gameId === game.gameId
              return <tr key={game.gameId} onClick={() => { if (busyId === null) setChosenId(game.gameId) }}
                className={`cursor-pointer border-t border-current/10 ${selected ? 'bg-primary/5' : ''}`}>
                <td className="w-10 p-2">
                  <input type="radio" name="event-selection" checked={selected} disabled={busyId !== null}
                    aria-label={`${t('Seleccionar', 'Select')} ${game.gameName}`} className="h-4 w-4 accent-primary"
                    onChange={() => setChosenId(game.gameId)} />
                </td>
                <th scope="row" className="break-words p-2 font-medium">{game.gameName}</th>
                <td className="p-2 whitespace-nowrap">{statusLabel(game)}</td>
                <td className="p-2 whitespace-nowrap">{game.createdAt ? <time dateTime={game.createdAt}>{dateLabel(game)}</time> : dateLabel(game)}</td>
                <td className="p-2 tabular-nums">{game.playerCount ?? t('No disponible', 'Unavailable')}</td>
              </tr>
            })}</tbody>
          </table>
        </div>
      </div>}
      {confirm && confirmingGame && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
          onClick={event => { if (event.target === event.currentTarget) setConfirm(null) }}>
          <div ref={actionDialog} lang={language} role="dialog" aria-modal="true" aria-labelledby="game-action-title" tabIndex={-1}
            className="w-full max-w-lg rounded-2xl border border-current/20 bg-[var(--color-background)] p-5 text-textMain shadow-xl"
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setConfirm(null)
              }
            }}>
            <h2 id="game-action-title" className="text-lg font-semibold">
              {confirm.action === 'deactivate'
                ? t(`¿Pausar ${confirmingGame.gameName}?`, `Pause ${confirmingGame.gameName}?`)
                : confirm.action === 'archive'
                ? t(`¿Archivar ${confirmingGame.gameName}?`, `Archive ${confirmingGame.gameName}?`)
                : t(`¿Borrar ${confirmingGame.gameName}?`, `Delete ${confirmingGame.gameName}?`)}
            </h2>
            <p className="mt-2 text-sm text-textSub">
              {confirm.action === 'deactivate'
                ? t('Se detendrán las nuevas participaciones; las iniciadas finalizarán.', 'New entries will stop; started games can finish.')
                : confirm.action === 'archive'
                ? t('Detiene el cierre y los trabajos pendientes. Podrás restaurarla; lo externo ya iniciado puede terminar.',
                  'Stops closing and pending work. You can restore it; external work already started may finish.')
                : t('Se borrarán sus datos locales. Kivly no se modifica; las entregas externas podrían completarse.', 'Its local data will be deleted. Kivly is unchanged; external deliveries may still complete.')}
            </p>
            {confirm.action === 'delete' && <label className="mt-4 block text-sm">
              {t(`Escribe ${confirmingGame.gameName} para confirmar`, `Type ${confirmingGame.gameName} to confirm`)}
              <input type="text" autoComplete="off" value={confirmationName} onChange={event => setConfirmationName(event.target.value)}
                autoFocus disabled={busyId !== null} className="mt-2 w-full rounded-lg border border-current/20 bg-surface px-3 py-2" />
            </label>}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" disabled={busyId !== null} className="rounded-xl border border-current/20 px-4 py-2 disabled:opacity-50"
                onClick={() => setConfirm(null)}>{t('Cancelar', 'Cancel')}</button>
              <button type="button" disabled={busyId !== null || !!actionError
                || (confirm.action === 'delete' && confirmationName !== confirmingGame.gameName)}
                aria-label={confirm.action === 'deactivate'
                  ? t('Confirmar desactivación', 'Confirm deactivation')
                  : confirm.action === 'archive'
                  ? t('Confirmar archivo', 'Confirm archival')
                  : t('Confirmar borrado definitivo', 'Confirm permanent deletion')}
                className="rounded-xl border border-current/20 bg-primary/20 px-4 py-2 disabled:opacity-50"
                onClick={() => void runAction(confirmingGame, confirm.action === 'deactivate' ? 'toggle' : confirm.action)}>
                {confirm.action === 'deactivate'
                  ? t('Pausar', 'Pause')
                  : confirm.action === 'archive'
                  ? t('Archivar', 'Archive')
                  : t('Borrar', 'Delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {params.get('create') === '1' && <CreateGameDialog onClose={() => setCatalogOpen(false)} />}
      {configureId && <GameConfigurationDialog key={configureId} gameId={configureId} onClose={() => {
        setConfigureId(null)
        setVersion(value => value + 1)
      }} />}
    </div>
  )
}
