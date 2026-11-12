import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  prizeInventoryApi, type InventoryPrize, type PrizeInventory as Inventory,
  type PrizeMovement,
} from '../../api/prizeInventory'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import type { SharedPrize } from '../../api/sharedPrizeCatalog'
import { AdminIconButton } from './AdminIcon'

const field = 'h-9 rounded-md border border-current/20 bg-surface px-2 text-sm min-w-0'
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const barColors = { available: 'bg-emerald-500', assigned: 'bg-red-500', redeemed: 'bg-[#9c6b6b]' }

function GameShares({ prize }: { prize: InventoryPrize }) {
  const { t } = useOperatorLanguage()
  if (!prize.games.length) return <p className="py-2 text-sm text-textSub">{t(
    'Este premio aún no está asignado a ninguna partida.', 'This prize is not assigned to any event yet.')}</p>
  const gameBar = (gameId: string) => {
    const game = prize.games.find(item => item.gameId === gameId)
    if (prize.reservation && game?.limit === null) return <span className="text-xs text-textSub">{t(
      'Define el substock de esta partida.', 'Set this event\'s sub-stock.',
    )}</span>
    if (prize.reservation && game?.assigned != null) return <DistributionBar parts={[
      { key: 'available', label: t('Disponible', 'Available'), value: game.remaining ?? 0 },
      { key: 'assigned', label: t('Repartido', 'Assigned'), value: Math.max(game.assigned - (prize.source === 'kivly' ? 0 : game.redeemed ?? 0), 0) },
      ...(prize.source === 'kivly' ? [] : [{ key: 'redeemed' as const, label: t('Canjeado', 'Redeemed'), value: game.redeemed ?? 0 }]),
    ]} />
    return <span className="text-xs text-textSub">{t('No disponible', 'Unavailable')}</span>
  }
  return <div className="space-y-2 py-2">
    <table className="admin-table w-full text-left text-sm" aria-label={t('Reparto por partida', 'Allocation by event')}>
      <thead><tr>{[t('Partida', 'Event'), t('Estado', 'Status'), t('Substock', 'Sub-stock'), t('Distribución', 'Distribution')]
        .map(label => <th key={label} scope="col" className="p-2 whitespace-nowrap">{label}</th>)}</tr></thead>
      <tbody>{prize.games.map(game => <tr key={game.gameId} className="border-t border-current/10">
        <th scope="row" className="p-2 font-medium">{game.name}</th>
        <td className="p-2">{game.active ? t('Activa', 'Active') : t('Inactiva', 'Inactive')}</td>
        <td className="p-2 tabular-nums">{game.limit ?? <span className="text-textSub">{t('Sin reserva', 'No reservation')}</span>}</td>
        <td className="p-2">{gameBar(game.gameId)}</td>
      </tr>)}</tbody>
    </table>
    <p className="text-xs text-textSub">{t('Cada substock es una reserva exclusiva. El stock general es su suma. Se edita en Condiciones de cada partida.',
      'Each sub-stock is an exclusive reservation. General stock is their sum. Edit it in each event\'s Conditions.')}</p>
  </div>
}

type BarPart = { key: keyof typeof barColors; label: string; value: number }

function DistributionBar({ parts }: { parts: BarPart[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0)
  const percent = (value: number) => total ? Math.round(value / total * 100) : 0
  const summary = parts.map(part => `${part.label}: ${part.value} (${percent(part.value)}%)`).join(' · ')
  return <div className="min-w-[11rem] space-y-1" role="img" aria-label={summary} title={summary}>
    <div className="flex h-2.5 overflow-hidden rounded-full bg-current/10">
      {parts.map(part => part.value > 0 && <span key={part.key} className={barColors[part.key]}
        style={{ width: `${part.value / total * 100}%` }} />)}
    </div>
    <div aria-hidden="true" className="flex gap-3 whitespace-nowrap text-[11px] tabular-nums text-textSub">
      {parts.map(part => <span key={part.key} className="inline-flex items-center gap-1">
        <span className={`h-2 w-2 rounded-full ${barColors[part.key]}`} />{part.value} · {percent(part.value)}%
      </span>)}
    </div>
  </div>
}

function StockBar({ prize }: { prize: InventoryPrize }) {
  const { t } = useOperatorLanguage()
  if (prize.reservation) {
    if (prize.reservation.error || prize.reservation.available === null) return <span className="text-textSub">{t(
      prize.reservation.error === 'ReservationBelowAssigned' ? 'Revisar reservas' : 'Define los substocks',
      prize.reservation.error === 'ReservationBelowAssigned' ? 'Review reservations' : 'Set sub-stocks',
    )}</span>
    return <DistributionBar parts={[
      { key: 'available', label: t('Disponible', 'Available'), value: prize.reservation.available },
      { key: 'assigned', label: t('Repartido', 'Assigned'), value: Math.max(prize.reservation.assigned - (prize.reservation.redeemed ?? 0), 0) },
      ...(prize.reservation.redeemed === null ? [] : [{ key: 'redeemed' as const, label: t('Canjeado', 'Redeemed'), value: prize.reservation.redeemed }]),
    ]} />
  }
  return <span className="text-textSub">{t('Reserva pendiente de cargar', 'Reservation not loaded')}</span>
}

function Movements({ prizeId }: { prizeId: string }) {
  const { t } = useOperatorLanguage()
  const [items, setItems] = useState<PrizeMovement[]>([])
  const [cursor, setCursor] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [game, setGame] = useState('')
  const [kind, setKind] = useState('')
  const [state, setState] = useState('')
  const lock = useRef(false)
  const alive = useRef(true)
  const load = async (next?: string) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const page = await prizeInventoryApi.movements(prizeId, next)
      if (!alive.current) return
      setItems(previous => [...new Map([...previous, ...page.items].map(item => [item.key, item])).values()])
      setCursor(page.cursor)
    } catch (cause) { if (alive.current) setError(message(cause)) }
    finally { lock.current = false; if (alive.current) setBusy(false) }
  }
  useEffect(() => {
    alive.current = true
    void load()
    return () => { alive.current = false }
  }, [prizeId])
  const filtered = items.filter(item => (!game || item.gameId === game) && (!kind || item.kind === kind)
    && (!state || Object.values(item.units ?? {}).some(unit => unit.state === state)))
  return <div className="space-y-2 py-2">
    <h3 className="font-semibold">{t('Movimientos', 'Movements')}</h3>
    <p className="text-sm">{t('Los filtros solo afectan a las filas cargadas.', 'Filters apply only to loaded rows.')} ({items.length})</p>
    <div className="flex flex-wrap gap-2">
      <label>{t('Partida', 'Event')} <select className={field} value={game} onChange={event => setGame(event.target.value)}>
        <option value="">{t('Todas', 'All')}</option>
        {[...new Map(items.filter(item => item.gameId).map(item => [item.gameId!, item.gameName ?? item.gameId!])).entries()]
          .map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label>{t('Tipo', 'Kind')} <select className={field} value={kind} onChange={event => setKind(event.target.value)}>
        <option value="">{t('Todos', 'All')}</option>
        {(['assignment', 'initialize', 'replenish', 'adjust'] as const).map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>{t('Estado', 'State')} <select className={field} value={state} onChange={event => setState(event.target.value)}>
        <option value="">{t('Todos', 'All')}</option>
        {[...new Set(items.flatMap(item => Object.values(item.units ?? {}).map(unit => unit.state)))].map(value => <option key={value}>{value}</option>)}
      </select></label>
    </div>
    <ul className="max-h-72 space-y-2 overflow-y-auto">{filtered.map(item => <li key={item.key} className="border-b border-current/10 py-2 text-sm">
      <span>{item.createdAt} · {item.kind} · {item.quantity} · {item.gameName ?? item.gameId} · {item.name} · {item.source}</span>
      {item.historical && <strong> · {t('Histórico', 'Historical')}</strong>}
      {item.reason && <p>{item.reason}</p>}
      {Object.entries(item.units ?? {}).map(([id, unit]) => <p key={id}>{id}: {unit.state} · {unit.condition} {unit.deliveredAt ?? ''}</p>)}
    </li>)}</ul>
    {!busy && !filtered.length && <p>{t('Sin movimientos cargados para estos filtros.', 'No loaded movements match these filters.')}</p>}
    {error && <p role="alert">{error}</p>}
    {cursor !== null && <AdminIconButton icon={error ? 'reload' : 'more'} small disabled={busy} onClick={() => void load(cursor)}
      label={error ? t('Reintentar página', 'Retry page') : t('Cargar más movimientos', 'Load more movements')} />}
  </div>
}

function ImportHistory({ games, imports, unresolved, refresh }: {
  games: Map<string, string>; imports: Record<string, boolean>
  unresolved: number
  refresh: () => Promise<Inventory>
}) {
  const { t } = useOperatorLanguage()
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [progress, setProgress] = useState('')
  const cursors = useRef(new Map<string, string | null | undefined>())
  const attempted = useRef(new Set<string>())
  const lock = useRef(false)
  const alive = useRef(true)
  const gameIds = [...games.keys()].sort().join(',')
  const run = async () => {
    if (lock.current || [...games.keys()].every(id => imports[id])) return
    lock.current = true; setBusy(true)
    const failures: Record<string, string> = { ...errors }
    delete failures.refresh
    try {
      for (const [gameId, name] of games) {
        if (imports[gameId] || attempted.current.has(gameId) || !alive.current) continue
        attempted.current.add(gameId)
        delete failures[gameId]
        setProgress(name)
        try {
          do {
            if (cursors.current.has(gameId) && cursors.current.get(gameId) === null) break
            const page = await prizeInventoryApi.importHistory(gameId, cursors.current.get(gameId) ?? undefined)
            cursors.current.set(gameId, page.cursor)
          } while (alive.current && cursors.current.get(gameId) !== null)
        } catch (cause) {
          failures[gameId] = `${name}: ${message(cause)}`
        }
      }
      if (alive.current) await refresh()
    } catch (cause) {
      failures.refresh = message(cause)
    } finally {
      lock.current = false
      if (alive.current) {
        setErrors(failures); setBusy(false); setProgress('')
      }
    }
  }
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    if (!busy && [...games.keys()].some(id => !imports[id] && !attempted.current.has(id))) void run()
  }, [gameIds, busy])
  const failed = Object.values(errors)
  const pending = [...games.keys()].some(id => !imports[id])
  if (!busy && !failed.length && !pending && !unresolved) return null
  return <div className="space-y-2 text-sm" aria-label={t('Histórico de premios', 'Prize history')}>
    <p role="status">{busy
      ? `${t('Importando históricos automáticamente', 'Importing history automatically')}… ${progress}`
      : failed.length || pending || unresolved > 0 ? t('Hay históricos pendientes de importar o conciliar.', 'Some history needs importing or reconciliation.')
        : t('Históricos actualizados automáticamente.', 'History updated automatically.')}
      {unresolved > 0 && <span> {t('Sin resolver', 'Unresolved')}: {unresolved}.</span>}</p>
    <details>
      <summary className="cursor-pointer">{t('Estado por partida', 'Status by event')} ({[...games.keys()].filter(id => imports[id]).length}/{games.size})</summary>
      <ul className="max-h-48 overflow-y-auto pt-2">{[...games].map(([id, name]) => <li key={id}>{name}: {imports[id]
        ? t('Importación completa', 'Import complete') : t('Pendiente de conciliar', 'Pending reconciliation')}</li>)}</ul>
      {(pending || unresolved > 0) && !busy && <p className="pt-2 text-textSub">{t(
        'Si quedan premios sin vincular, revisa su selección del catálogo general en los ajustes de la partida y reintenta. No se vinculan nombres ambiguos automáticamente.',
        'For unlinked prizes, review their shared catalog selection in event settings, then retry. Ambiguous names are never linked automatically.',
      )}</p>}
    </details>
    {failed.length > 0 && <p role="alert">{failed.join(' · ')} — {t('Se conserva la página para reintentar.', 'The page is retained for retry.')}</p>}
    {!busy && (failed.length > 0 || pending) && <AdminIconButton icon="reload" small
      label={t('Reintentar importación', 'Retry import')} onClick={() => {
      for (const id of games.keys()) {
        if (!imports[id]) {
          attempted.current.delete(id)
          if (cursors.current.get(id) === null) cursors.current.delete(id)
        }
      }
      void run()
    }} />}
  </div>
}

export default function PrizeInventory({ catalogVersion = 0, catalog = [], catalogActions, catalogAdd, catalogEditor,
  catalogBusy = false }: {
  catalogVersion?: number; catalog?: SharedPrize[]; catalogActions?: (id: string) => ReactNode
  catalogAdd?: ReactNode
  catalogEditor?: { prizeId: string; content: ReactNode }; catalogBusy?: boolean
}) {
  const { t } = useOperatorLanguage()
  const [data, setData] = useState<Inventory | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [chosen, setChosen] = useState('')
  const [view, setView] = useState<'stock' | 'movements'>('stock')
  const [historyVersion, setHistoryVersion] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [deleteUncertain, setDeleteUncertain] = useState(false)
  const lock = useRef(false)
  const refreshVersion = useRef(0)
  useEffect(() => { if (catalogBusy) setSelected('') }, [catalogBusy])
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current
    const next = await prizeInventoryApi.get()
    if (version === refreshVersion.current) { setData(next); setError('') }
    return next
  }, [])
  const refreshHistory = useCallback(async () => {
    const next = await refresh()
    setHistoryVersion(value => value + 1)
    return next
  }, [refresh])
  useEffect(() => {
    const reload = () => {
      void refreshHistory().catch(cause => setError(message(cause)))
    }
    const visible = () => { if (document.visibilityState === 'visible') reload() }
    reload()
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', visible)
    return () => {
      refreshVersion.current += 1
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [catalogVersion, refreshHistory])
  const games = new Map<string, string>(Object.keys(data?.imports ?? {}).map(id => [id, id]))
  data?.catalog.forEach(prize => prize.games.forEach(game => {
    if (games.has(game.gameId)) games.set(game.gameId, game.name)
  }))
  const entries = new Map((data?.catalog ?? []).map(item => [item.id, item]))
  const shared = new Map(catalog.map(item => [item.id, item]))
  const ids = [...new Set([...shared.keys(), ...entries.keys()])]
  const chosenId = ids.includes(chosen) ? chosen : ''
  const chosenPrize = entries.get(chosenId)
  const canDeleteKivly = chosenPrize?.source === 'kivly' && chosenPrize.games.length === 0
    && !chosenPrize.inventory.initialized && !chosenPrize.inventory.available
    && !chosenPrize.inventory.assigned && !chosenPrize.inventory.historicalAssigned
    && !chosenPrize.inventory.redeemed && !chosenPrize.inventory.historicalRedeemed
  const open = (id: string) => { setChosen(id); setSelected(id); setView('stock') }
  const toggle = (id: string) => {
    if (catalogBusy || deleting || deleteConfirmation) return
    if (chosenId === id && selected === id) setSelected('')
    else open(id)
  }
  const movementsOpen = !!chosenId && selected === chosenId && view === 'movements'
  return <div className="space-y-4 pt-3">
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>{t('Cargando inventario…', 'Loading inventory…')}</p>}
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {catalogAdd}
        <div aria-hidden="true" title={t(
          'Stock = suma de las reservas exclusivas de todas las partidas. Kivly no confirma canjes externos.',
          'Stock = sum of exclusive reservations across all events. Kivly does not confirm external redemptions.',
        )} className="flex flex-wrap items-center gap-3 text-xs text-textSub">
          {([['available', t('Disponible', 'Available')], ['assigned', t('Repartido', 'Assigned')], ['redeemed', t('Canjeado', 'Redeemed')]] as const)
            .map(([key, label]) => <span key={key} className="inline-flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${barColors[key]}`} />{label}
            </span>)}
        </div>
        <div role="group" aria-label={t('Acciones del premio seleccionado', 'Selected prize actions')}
          className="ml-auto flex flex-wrap items-center gap-2">
          <fieldset className="flex flex-wrap items-center gap-2">
            {chosenPrize?.source !== 'kivly' && catalogActions?.(chosenId)}
            {chosenPrize?.source === 'kivly' && <AdminIconButton icon="delete" tone="danger"
              label={t('Eliminar de STAND y Kivly', 'Delete from STAND and Kivly')}
              disabled={!canDeleteKivly || catalogBusy || deleting || deleteUncertain}
              onClick={() => setDeleteConfirmation(true)} />}
            <AdminIconButton icon="history" label={t('Ver movimientos', 'View movements')}
              disabled={!chosenPrize || catalogBusy} aria-pressed={movementsOpen}
              onClick={() => { if (movementsOpen) setView('stock'); else { setSelected(chosenId); setView('movements') } }} />
          </fieldset>
          <AdminIconButton icon="reload" label={t('Actualizar inventario', 'Refresh inventory')}
            disabled={deleting}
            onClick={() => void refreshHistory().then(() => setDeleteUncertain(false)).catch(cause => setError(message(cause)))} />
        </div>
        {deleteConfirmation && <div role="alertdialog" aria-label={t('Eliminar premio Kivly', 'Delete Kivly prize')}
          className="space-y-2 rounded-lg border border-red-500/30 p-3 text-sm">
          <p>{t('Se eliminará este premio de STAND y del catálogo de Kivly. Esta acción no se puede deshacer.',
            'This prize will be deleted from STAND and the Kivly catalog. This cannot be undone.')} {chosenPrize?.name}</p>
          <div className="flex gap-2">
            <AdminIconButton icon="confirm" tone="danger" label={t('Confirmar eliminación', 'Confirm deletion')}
              disabled={deleting} onClick={() => {
                if (lock.current || !canDeleteKivly) return
                lock.current = true
                setDeleting(true); setError('')
                void (async () => {
                  try {
                    await prizeInventoryApi.removeKivlyPrize(chosenId)
                  } catch (cause) {
                    setDeleteUncertain(true)
                    setError(`${message(cause)} — ${t(
                      'No se pudo confirmar la eliminación. Actualiza el inventario antes de reintentar.',
                      'Deletion could not be confirmed. Refresh inventory before retrying.',
                    )}`)
                    return
                  }
                  setSelected(''); setChosen('')
                  await refreshHistory()
                })().catch(cause => setError(message(cause))).finally(() => {
                  lock.current = false; setDeleting(false); setDeleteConfirmation(false)
                })
              }} />
            <AdminIconButton icon="cancel" label={t('Cancelar', 'Cancel')} disabled={deleting}
              onClick={() => setDeleteConfirmation(false)} />
          </div>
        </div>}
      </div>
      <div className="overflow-x-auto">
        <table className="admin-table w-full text-left text-sm">
          <caption className="sr-only">{t('Catálogo e inventario de premios', 'Prize catalog and inventory')}</caption>
          <thead><tr>
            <th scope="col" className="p-2"><span className="sr-only">{t('Selección', 'Selection')}</span></th>
            {[t('Foto', 'Photo'), t('Nombre', 'Name'), t('Origen', 'Origin'),
            t('Stock', 'Stock'), t('Distribución', 'Distribution'), t('Partidas', 'Events')]
            .map(label => <th key={label} scope="col" className="p-2 whitespace-nowrap">{label}</th>)}</tr></thead>
          <tbody>{ids.map(id => {
            const item = entries.get(id)
            const definition = shared.get(id)
            const name = definition?.name ?? item!.name
            const imageUrl = definition?.imageUrl ?? item?.imageUrl
            const editing = catalogEditor?.prizeId === id
            const expanded = editing || (!catalogBusy && selected === id)
            const isChosen = chosenId === id
            const assigned = item ? item.inventory.assigned + item.inventory.historicalAssigned : 0
            const pending = item?.canjeados === null || !item ? null : assigned - item.canjeados
            return <Fragment key={id}>
              <tr onClick={() => toggle(id)} aria-expanded={expanded}
                className={`cursor-pointer border-t border-current/10 ${isChosen ? 'bg-primary/5' : ''}`}>
                <td className="w-10 p-2">
                  <input type="radio" name="prize-selection" checked={chosenId === id}
                    aria-label={`${t('Seleccionar', 'Select')} ${name}`} disabled={catalogBusy || deleting || deleteConfirmation}
                    className="h-4 w-4 accent-primary" onClick={event => event.stopPropagation()}
                    onChange={() => open(id)} />
                </td>
                <td className="w-12 p-2">{imageUrl
                  ? <img src={imageUrl} alt="" className="h-9 w-9 object-contain" />
                  : <span aria-hidden="true" className="block h-9 w-9 rounded-md bg-current/5" />}</td>
                <th scope="row" className="p-2 font-medium">{name}</th>
                <td className="p-2">{item?.source === 'kivly' ? 'Kivly' : 'STAND'}</td>
                {!item ? <td colSpan={3} className="p-2 text-textSub">{t('Saldo pendiente de cargar. Actualiza el inventario.', 'Balance not loaded. Refresh inventory.')}</td>
                  : <>
                    <td className="p-2 tabular-nums" title={t('Suma de substocks reservados', 'Sum of reserved sub-stocks')}>
                      {item.reservation ? item.reservation.total ?? t('Define los substocks', 'Set sub-stocks')
                        : t('Reserva pendiente de cargar', 'Reservation not loaded')}
                    </td>
                    <td className="p-2"><StockBar prize={item} /></td>
                    <td className="p-2 tabular-nums">{item.games.length
                      ? item.games.length : <span className="text-textSub">{t('Ninguna', 'None')}</span>}</td>
                  </>}
              </tr>
              {expanded && <tr className="bg-primary/5"><td colSpan={7} className="px-3 pb-3">
                <section id={`prize-detail-${id}`} aria-label={`${t('Detalle', 'Detail')}: ${name}`}
                  className="rounded-lg border border-current/10 px-3 py-2">
                  {item?.reservation?.error && <p role="alert" className="pt-2 text-sm">{t(
                    item.reservation.error === 'ReservationBelowAssigned'
                      ? 'Hay reservas menores que los premios ya repartidos. Revisa los substocks en Condiciones.'
                      : 'Define un substock numérico en cada partida para calcular el stock general y repartir premios.',
                    item.reservation.error === 'ReservationBelowAssigned'
                      ? 'Some reservations are below already assigned prizes. Review sub-stocks in Conditions.'
                      : 'Set a numeric sub-stock in each event to calculate general stock and award prizes.',
                  )}</p>}
                  {item && pending !== null && pending < 0 && <p role="alert" className="pt-2 text-sm">{t(
                    'Los canjes superan los repartos registrados. Revisa el histórico antes de interpretar el stock.',
                    'Redemptions exceed recorded assignments. Review history before interpreting stock.',
                  )}</p>}
                  {editing ? catalogEditor.content : item && (view === 'stock'
                    ? !(pending !== null && pending < 0) && <GameShares key={id} prize={item} />
                    : <>
                      <p className="pt-2 text-sm text-textSub">{t('Repartidos históricos', 'Historical assigned')}: {item.inventory.historicalAssigned}
                        {' · '}{t('Canjeados históricos', 'Historical redeemed')}: {item.canjeados === null ? t('Desconocido', 'Unknown') : item.inventory.historicalRedeemed}
                        {' · '}{t('Repartidos actuales', 'Current assigned')}: {item.inventory.assigned}
                        {' · '}{t('Canjeados actuales', 'Current redeemed')}: {item.canjeados === null ? t('Desconocido', 'Unknown') : item.inventory.redeemed}</p>
                      <Movements key={`${id}-${historyVersion}`} prizeId={id} />
                    </>)}
                </section>
              </td></tr>}
            </Fragment>
          })}</tbody>
        </table>
      </div>
    </div>
    {data && <>
      <ImportHistory games={games} imports={data.imports} unresolved={data.unresolved}
        refresh={refreshHistory} />
    </>}
  </div>
}
