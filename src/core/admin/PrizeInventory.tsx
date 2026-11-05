import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  prizeInventoryApi, type InventoryChange, type InventoryPrize, type PrizeInventory as Inventory,
  type PrizeMovement,
} from '../../api/prizeInventory'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import type { SharedPrize } from '../../api/sharedPrizeCatalog'

const button = 'rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-sm hover:bg-primary/20 disabled:opacity-40'
const field = 'h-9 rounded-md border border-current/20 bg-surface px-2 text-sm min-w-0'
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const isConflict = (error: unknown) => typeof error === 'object' && error !== null
  && 'status' in error && error.status === 409

function StockAction({ prize, reload, onBlockedChange }: {
  prize: InventoryPrize; reload: () => Promise<Inventory>; onBlockedChange: (blocked: boolean) => void
}) {
  const { t } = useOperatorLanguage()
  const [action, setAction] = useState<InventoryChange['action']>(prize.inventory.initialized ? 'replenish' : 'initialize')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [success, setSuccess] = useState(false)
  const pending = useRef<InventoryChange | null>(null)
  const lock = useRef(false)
  useEffect(() => {
    onBlockedChange(busy || conflict || pending.current !== null)
  }, [busy, conflict, error, onBlockedChange])
  useEffect(() => () => onBlockedChange(false), [onBlockedChange])
  useEffect(() => {
    if (!pending.current) {
      setAction(prize.inventory.initialized ? 'replenish' : 'initialize')
      setQuantity(''); setReason('')
    }
  }, [prize.inventory.initialized])
  const changed = () => { pending.current = null; setError(''); setSuccess(false) }
  const submit = async () => {
    if (lock.current || conflict) return
    const amount = Number(quantity)
    if (!pending.current && (!/^[+-]?\d+$/.test(quantity.trim()) || !Number.isSafeInteger(amount)
      || (action === 'initialize' && amount < 0) || (action === 'replenish' && amount <= 0)
      || (action !== 'initialize' && (!Number.isSafeInteger(prize.inventory.available + amount)
        || prize.inventory.available + amount < 0)) || !reason.trim())) {
      setError(t('Introduce una cantidad entera válida y un motivo. El saldo no puede ser negativo.',
        'Enter a valid whole quantity and a reason. The balance cannot be negative.'))
      return
    }
    pending.current ??= {
      action, prizeId: prize.id, quantity: amount, reason: reason.trim(),
      requestId: crypto.randomUUID(), expectedRevision: prize.inventory.revision,
    }
    lock.current = true
    setBusy(true); setError(''); setSuccess(false)
    let confirmed = false
    try {
      await prizeInventoryApi.change(pending.current)
      confirmed = true
      pending.current = null
      setQuantity(''); setReason(''); setSuccess(true)
      const refreshed = await reload()
      setAction(refreshed.catalog.find(item => item.id === prize.id)?.inventory.initialized ? 'replenish' : 'initialize')
    } catch (cause) {
      if (confirmed || isConflict(cause)) setConflict(true)
      setError(`${message(cause)} ${confirmed || isConflict(cause)
        ? t('Recarga los saldos antes de continuar.', 'Reload balances before continuing.')
        : t('Resultado no confirmado. Reintentar conserva la misma solicitud; editar crea una nueva.',
          'Result unconfirmed. Retry keeps the same request; editing creates a new one.')}`)
    } finally { lock.current = false; setBusy(false) }
  }
  return <form className="space-y-2 py-2" onSubmit={event => { event.preventDefault(); void submit() }}>
    <p className="text-sm text-textSub">{t(
      'Introduce unidades libres para nuevos premios, no el recuento físico total ni la suma de partidas. Los históricos no se descuentan de nuevo.',
      'Enter free units for new awards, not the total physical count or the sum of events. History is never deducted again.',
    )}</p>
    <fieldset disabled={busy || conflict} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">{t('Operación', 'Action')} <select className={field} value={action} onChange={event => {
        changed(); setAction(event.target.value as InventoryChange['action'])
      }}>
        {!prize.inventory.initialized && <option value="initialize">{t('Inicializar', 'Initialize')}</option>}
        {prize.inventory.initialized && <>
          <option value="replenish">{t('Reponer', 'Replenish')}</option>
          <option value="adjust">{t('Ajustar (variación con signo)', 'Adjust (signed delta)')}</option>
        </>}
      </select></label>
      <label className="flex flex-col gap-1">{t('Cantidad', 'Quantity')} <input className={`${field} w-28`} inputMode="numeric" value={quantity}
        onChange={event => { changed(); setQuantity(event.target.value) }} /></label>
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1">{t('Motivo obligatorio', 'Required reason')} <input className={field} value={reason} maxLength={300}
        onChange={event => { changed(); setReason(event.target.value) }} /></label>
      <button className={button} type="submit">{busy ? t('Enviando…', 'Sending…') : error ? t('Reintentar operación', 'Retry operation') : t('Aplicar', 'Apply')}</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    {success && <p role="status">{t('Operación confirmada.', 'Operation confirmed.')}</p>}
    {conflict && <button className={button} type="button" disabled={busy} onClick={() => {
      if (lock.current) return
      lock.current = true; setBusy(true)
      void reload().then(refreshed => {
        pending.current = null; setConflict(false); setError(''); setQuantity(''); setReason('')
        setAction(refreshed.catalog.find(item => item.id === prize.id)?.inventory.initialized ? 'replenish' : 'initialize')
      })
        .catch(cause => setError(message(cause))).finally(() => { lock.current = false; setBusy(false) })
    }}>{t('Recargar saldos', 'Reload balances')}</button>}
  </form>
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
    {cursor !== null && <button className={button} disabled={busy} onClick={() => void load(cursor)}>
      {busy ? t('Cargando…', 'Loading…') : error ? t('Reintentar página', 'Retry page') : t('Cargar más movimientos', 'Load more movements')}
    </button>}
  </div>
}

function ImportHistory({ games, imports, unresolved, refresh, onBusyChange }: {
  games: Map<string, string>; imports: Record<string, boolean>
  unresolved: number
  refresh: () => Promise<Inventory>; onBusyChange: (busy: boolean) => void
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
    lock.current = true; setBusy(true); onBusyChange(true)
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
        setErrors(failures); setBusy(false); setProgress(''); onBusyChange(false)
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
    {!busy && (failed.length > 0 || pending) && <button className={button} onClick={() => {
      for (const id of games.keys()) {
        if (!imports[id]) {
          attempted.current.delete(id)
          if (cursors.current.get(id) === null) cursors.current.delete(id)
        }
      }
      void run()
    }}>{t('Reintentar importación', 'Retry import')}</button>}
  </div>
}

export default function PrizeInventory({ catalogVersion = 0, catalog = [], catalogActions, catalogEditor,
  catalogBusy = false, onBlockedChange }: {
  catalogVersion?: number; catalog?: SharedPrize[]; catalogActions?: (id: string) => ReactNode
  catalogEditor?: { prizeId: string; content: ReactNode }; catalogBusy?: boolean
  onBlockedChange?: (blocked: boolean) => void
}) {
  const { t } = useOperatorLanguage()
  const [data, setData] = useState<Inventory | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [chosen, setChosen] = useState('')
  const [view, setView] = useState<'stock' | 'movements'>('stock')
  const [confirmation, setConfirmation] = useState(false)
  const [activating, setActivating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [detailBlocked, setDetailBlocked] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const lock = useRef(false)
  useEffect(() => { if (catalogBusy) setSelected('') }, [catalogBusy])
  useEffect(() => { onBlockedChange?.(detailBlocked) }, [detailBlocked, onBlockedChange])
  const refresh = async () => {
    const next = await prizeInventoryApi.get()
    setData(next); setError('')
    return next
  }
  const refreshHistory = async () => {
    const next = await refresh()
    setHistoryVersion(value => value + 1)
    return next
  }
  useEffect(() => { void refresh().catch(cause => setError(message(cause))) }, [catalogVersion])
  const games = new Map<string, string>(Object.keys(data?.imports ?? {}).map(id => [id, id]))
  data?.catalog.forEach(prize => prize.games.forEach(game => {
    if (games.has(game.gameId)) games.set(game.gameId, game.name)
  }))
  const ready = !importing && data && data.unresolved === 0 && [...games.keys()].every(id => data.imports[id] === true)
    && data.catalog.filter(prize => prize.games.length > 0).every(prize => prize.inventory.initialized)
  const entries = new Map((data?.catalog ?? []).map(item => [item.id, item]))
  const shared = new Map(catalog.map(item => [item.id, item]))
  const ids = [...new Set([...shared.keys(), ...entries.keys()])]
  const chosenId = ids.includes(chosen) ? chosen : ''
  const chosenPrize = entries.get(chosenId)
  return <div className="space-y-4 pt-3">
    <div className="flex items-center justify-between gap-2">
      <button className={button} onClick={() => void refreshHistory().catch(cause => setError(message(cause)))}>{t('Actualizar inventario', 'Refresh inventory')}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>{t('Cargando inventario…', 'Loading inventory…')}</p>}
      {data && (data.mode === 'legacy' ? <p className="rounded-lg border border-amber-400/40 p-3">{t(
        'Modo anterior: cada partida conserva su stock previo hasta la activación explícita. Inicializa las unidades libres para nuevos premios, nunca sumando partidas.',
        'Legacy mode: each event keeps its previous stock until explicit activation. Initialize free units for new awards, never by summing events.',
      )}</p> : <p>{t('Inventario compartido activo. Todas las partidas consumen las mismas unidades.', 'Shared inventory active. All events consume the same units.')}</p>)}
      <p className="text-xs text-textSub">{t(
        'Stock = disponibles + pendientes de canjear registrados. Repartidos y canjeados incluyen históricos. Stock desconocido si falta histórico; Kivly no confirma stock físico ni canjes externos.',
        'Stock = available + recorded unredeemed awards. Assigned and redeemed include history. Stock is unknown while history is pending; Kivly does not confirm physical stock or external redemptions.',
      )}</p>
      <div role="group" aria-label={t('Acciones del premio seleccionado', 'Selected prize actions')}
        className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-textSub">{chosenId
          ? shared.get(chosenId)?.name ?? chosenPrize?.name
          : t('Selecciona un premio para gestionar sus acciones.', 'Select a prize to manage its actions.')}</span>
        <fieldset disabled={detailBlocked} className="flex flex-wrap items-center justify-end gap-1">
          {chosenPrize?.source !== 'kivly' && catalogActions?.(chosenId)}
          <button className={button} disabled={!chosenPrize || catalogBusy}
            aria-expanded={selected === chosenId && !!selected && view === 'stock'}
            onClick={() => { setSelected(chosenId); setView('stock') }}>{t('Gestionar saldo', 'Manage balance')}</button>
          <button className={button} disabled={!chosenPrize || catalogBusy}
            aria-expanded={selected === chosenId && !!selected && view === 'movements'}
            onClick={() => { setSelected(chosenId); setView('movements') }}>{t('Ver movimientos', 'View movements')}</button>
        </fieldset>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t('Catálogo e inventario de premios', 'Prize catalog and inventory')}</caption>
          <thead><tr>{[t('Selección', 'Selection'), t('Foto', 'Photo'), t('Nombre', 'Name'), t('Origen', 'Origin'), t('Stock', 'Stock'),
            t('Disponibles', 'Available'), t('Canjeados', 'Redeemed'), t('Repartidos', 'Assigned'),
            t('Partidas', 'Events')]
            .map(label => <th key={label} scope="col" className="p-2 whitespace-nowrap">{label}</th>)}</tr></thead>
          <tbody>{ids.map(id => {
            const item = entries.get(id)
            const definition = shared.get(id)
            const name = definition?.name ?? item!.name
            const imageUrl = definition?.imageUrl ?? item?.imageUrl
            const editing = catalogEditor?.prizeId === id
            const expanded = editing || (!catalogBusy && selected === id)
            const assigned = item ? item.inventory.assigned + item.inventory.historicalAssigned : 0
            const pending = item?.canjeados === null || !item ? null : assigned - item.canjeados
            const historyPending = !data || data.unresolved > 0 || Object.values(data.imports).some(complete => !complete)
            const stock = !item || item.source === 'kivly' || pending === null || pending < 0
              || !Number.isSafeInteger(item.inventory.available + pending) || historyPending
              ? null : item.inventory.available + pending
            return <Fragment key={id}>
              <tr className={`border-t border-current/10 ${expanded ? 'bg-primary/5' : ''}`}>
                <td className="w-10 p-2">
                  <input type="radio" name="prize-selection" checked={chosenId === id}
                    aria-label={`${t('Seleccionar', 'Select')} ${name}`} disabled={detailBlocked || catalogBusy}
                    className="h-4 w-4 accent-primary"
                    onChange={() => { setChosen(id); setSelected('') }} />
                </td>
                <td className="w-12 p-2">{imageUrl
                  ? <img src={imageUrl} alt="" className="h-9 w-9 object-contain" />
                  : <span aria-hidden="true" className="block h-9 w-9 rounded-md bg-current/5" />}</td>
                <th scope="row" className="p-2 font-medium">{name}</th>
                <td className="p-2">{item?.source === 'kivly' ? 'Kivly' : 'STAND'}</td>
                {!item ? <td colSpan={5} className="p-2 text-textSub">{t('Saldo pendiente de cargar. Actualiza el inventario.', 'Balance not loaded. Refresh inventory.')}</td>
                  : <>
                    <td className="p-2 tabular-nums" title={t('Disponibles + pendientes de canjear registrados', 'Available + recorded unredeemed awards')}>
                      {item.source === 'kivly' ? t('Desconocido', 'Unknown') : !item.inventory.initialized
                        ? t('Sin inicializar', 'Uninitialized') : stock === null ? t('Desconocido', 'Unknown') : stock}
                    </td>
                    <td className="p-2 tabular-nums">{item.inventory.initialized ? item.inventory.available : t('Sin inicializar', 'Uninitialized')}</td>
                    <td className="p-2 tabular-nums">{item.canjeados === null ? t('Desconocido', 'Unknown') : item.canjeados}</td>
                    <td className="p-2 tabular-nums">{assigned}</td>
                    <td className="p-2">
                      {item.games.length ? <details>
                        <summary className="cursor-pointer whitespace-nowrap">{t('Ver partidas', 'View events')} ({item.games.length})</summary>
                        <ul className="max-h-40 min-w-[12rem] space-y-1 overflow-y-auto pt-2">{item.games.map(game => <li key={game.gameId}>
                          <span>{game.name} · {game.limit === null ? t('Sin límite', 'Unlimited') : game.limit}</span>
                          <span className="block text-xs text-textSub">{game.active ? t('Activa', 'Active') : t('Inactiva', 'Inactive')}</span>
                        </li>)}</ul>
                      </details> : <span className="text-textSub">{t('Ninguna', 'None')}</span>}
                    </td>
                  </>}
              </tr>
              {expanded && <tr className="bg-primary/5"><td colSpan={9} className="px-3 pb-3">
                <section id={`prize-detail-${id}`} aria-label={`${t('Detalle', 'Detail')}: ${name}`}
                  className="rounded-lg border border-current/10 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{name} · {editing ? t('Editar ficha', 'Edit details')
                      : view === 'stock' ? t('Gestionar saldo', 'Manage balance') : t('Histórico', 'History')}</h3>
                    {!editing && <button className={button} disabled={detailBlocked} onClick={() => setSelected('')}>
                      {t('Cerrar detalle', 'Close detail')}</button>}
                  </div>
                  {item && pending !== null && pending < 0 && <p role="alert" className="pt-2 text-sm">{t(
                    'Los canjes superan los repartos registrados. Revisa el histórico antes de interpretar el stock.',
                    'Redemptions exceed recorded assignments. Review history before interpreting stock.',
                  )}</p>}
                  {editing ? catalogEditor.content : item && (view === 'stock'
                    ? <StockAction key={id} prize={item} reload={refresh} onBlockedChange={setDetailBlocked} />
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
      {data && <>
      <ImportHistory games={games} imports={data.imports} unresolved={data.unresolved}
        refresh={refreshHistory} onBusyChange={setImporting} />
      {data.mode === 'legacy' && <>
        <p>{t('Sin resolver', 'Unresolved')}: {data.unresolved}. {t(
          'El histórico se importa automáticamente. Para activar, resuelve los registros pendientes e inicializa todos los premios asignados.',
          'History imports automatically. To activate, reconcile pending records and initialize all assigned prizes.',
        )}</p>
        <button className={button} disabled={!ready || activating} onClick={() => setConfirmation(true)}>{t('Activar inventario compartido', 'Activate shared inventory')}</button>
        {confirmation && <div role="dialog" aria-label={t('Confirmar activación', 'Confirm activation')} className="border border-amber-400/40 rounded-lg p-3 space-y-3">
          <p>{t('Todas las partidas compartirán las mismas unidades. Los nuevos premios sin inicializar no se repartirán. Esta acción sustituye el stock anterior por partida.',
            'All events will share the same units. New uninitialized prizes will not be awarded. This replaces previous per-event stock.')}</p>
          <button className={button} disabled={!ready || activating} onClick={() => {
            if (lock.current) return
            lock.current = true; setActivating(true); setError('')
            void prizeInventoryApi.activate().then(async () => { setConfirmation(false); await refresh() })
              .catch(async cause => {
                setConfirmation(false)
                try { await refresh() } catch { /* Keep the activation error visible even if refresh fails. */ }
                setError(message(cause))
              })
              .finally(() => { lock.current = false; setActivating(false) })
          }}>{t('Confirmar activación', 'Confirm activation')}</button>
          <button className={button} disabled={activating} onClick={() => setConfirmation(false)}>{t('Cancelar', 'Cancel')}</button>
        </div>}
      </>}
    </>}
  </div>
}
