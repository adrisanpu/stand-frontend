import { useEffect, useRef, useState } from 'react'
import { stackPrizeApi, type StackPrizeCondition, type StackPrizeItem, type StackPrizeProgram, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { kivlyApi, type KivlyReward } from '../../api/kivlyApi'
import { PrizeImageError, uploadPrizeImage, validatePrizeImage } from '../../api/prizeMedia'
import { useOperatorLanguage } from '../shell/operatorLanguage'

const field = 'rounded-xl border border-white/15 bg-surface px-3 py-2 text-sm min-w-0'
const action = 'rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm disabled:opacity-40'
const conditions: StackPrizeCondition[] = ['completed', 'top_finish', 'top_final', 'raffle']
const newId = () => crypto.randomUUID()

export default function StackPrizeSettings({ gameId, raffles, onPersist, onSavingChange }: {
  gameId: string
  raffles: boolean
  onPersist: (patch: Record<string, unknown>) => void
  onSavingChange?: (saving: boolean) => void
}) {
  const { t } = useOperatorLanguage()
  const [data, setData] = useState<StackPrizeSettingsResponse | null>(null)
  const [program, setProgram] = useState<StackPrizeProgram | null>(null)
  const [rewards, setRewards] = useState<KivlyReward[]>([])
  const [locationId, setLocationId] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmExclude, setConfirmExclude] = useState(false)
  const [dirty, setDirty] = useState(false)
  const previews = useRef(new Map<string, string>())
  useEffect(() => () => {
    previews.current.forEach((url) => URL.revokeObjectURL(url))
    previews.current.clear()
  }, [gameId])
  const label = (condition: StackPrizeCondition) => ({
    completed: t('complete una partida', 'a player completes a game'),
    top_finish: t('entre en el top al terminar su partida', 'a player finishes in the top'),
    top_final: t('esté en el top al cerrar el juego', 'a player is in the top when the game closes'),
    raffle: t('gane un sorteo', 'a player wins a raffle'),
  })[condition]
  useEffect(() => {
    let cancelled = false
    setData(null)
    setProgram(null)
    setError('')
    setDirty(false)
    setLocationId(null)
    setRewards([])
    setCatalogError('')
    void stackPrizeApi.get(gameId).then((response) => {
      if (cancelled) return
      if (response.ok !== true || response.program?.version !== 1) throw new Error('Invalid prize configuration')
      setData(response)
      setProgram(response.program)
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : t('No se pudieron cargar los premios.', 'Could not load prizes.'))
    })
    void kivlyApi.getAccountConnection().then(async (conn) => {
      if (!conn.connected) return
      const catalog = await kivlyApi.listRewards(gameId)
      if (!cancelled) { setLocationId(conn.locationId); setRewards(catalog) }
    }).catch(() => {
      if (!cancelled) setCatalogError(t('No se pudo cargar Kivly. Puedes consultar STAND, pero comprueba Kivly antes de guardar sus premios.',
        'Could not load Kivly. STAND is available, but check Kivly before saving its rewards.'))
    })
    return () => { cancelled = true }
  }, [gameId, revision, t])
  const change = (next: StackPrizeProgram) => { setProgram(next); setDirty(true); setMessage('') }
  const run = async (work: () => Promise<void>) => {
    setBusy(true); onSavingChange?.(true); setError(''); setMessage('')
    try { await work() } catch (cause) {
      setError(cause instanceof PrizeImageError
        ? t('Selecciona una imagen PNG válida de como máximo 5 MB.', 'Choose a valid PNG image no larger than 5 MB.')
        : cause instanceof Error ? cause.message : t('No se pudo guardar.', 'Could not save.'))
    } finally { setBusy(false); onSavingChange?.(false) }
  }
  const save = () => run(async () => {
    if (!program) return
    const saved = await stackPrizeApi.save(gameId, program)
    setProgram(saved)
    setDirty(false)
    setData((previous) => previous ? { ...previous, program: saved, enabled: true } : previous)
    onPersist({ stackPrizeProgram: saved, prizeCatalog: {} })
    setMessage(t('Reglas guardadas. Se aplican a los nuevos intentos y próximos sorteos; los premios ganados se conservan.',
      'Rules saved. They apply to new attempts and future raffles; earned prizes are preserved.'))
  })
  const close = (exclude: boolean) => run(async () => {
    const next = await stackPrizeApi.close(gameId, exclude ? data?.pendingPlayers.map((p) => p.playerId) : [])
    setData(next); setConfirmClose(false); setConfirmExclude(false)
    setMessage(next.state === 'closed'
      ? t('Juego cerrado. Los premios finales se entregan automáticamente.', 'Game closed. Final prizes are delivered automatically.')
      : t('Cierre solicitado. No se admiten nuevos intentos. Esperando las partidas en curso.', 'Closing requested. New attempts are blocked. Waiting for active games.'))
  })
  const addStand = () => {
    if (!program || !name.trim()) return
    change({ ...program, catalog: [...program.catalog, { id: newId(), source: 'stand', name: name.trim(), limit: null }] })
    setName('')
  }
  const chooseImage = (prize: StackPrizeItem, file: File) => run(async () => {
    if (!program) return
    await validatePrizeImage(file)
    const imageKey = await uploadPrizeImage(gameId, 'ranking', file)
    const oldPreview = previews.current.get(prize.id)
    if (oldPreview) URL.revokeObjectURL(oldPreview)
    const imageUrl = URL.createObjectURL(file)
    previews.current.set(prize.id, imageUrl)
    change({ ...program, catalog: program.catalog.map((p) => p.id === prize.id ? { ...p, imageKey, imageUrl } : p) })
    setMessage(t('Imagen preparada; guarda las reglas para aplicarla.', 'Image ready; save the rules to apply it.'))
  })
  if (!program || !data) return <div className="space-y-3">
    {error ? <p role="alert" className="text-red-300">{error}</p> : <p role="status">{t('Cargando premios...', 'Loading prizes...')}</p>}
    {error && <button className={action} onClick={() => setRevision((r) => r + 1)}>{t('Reintentar', 'Retry')}</button>}
  </div>
  const editable = data.state === 'open'
  const available = [...program.catalog, ...rewards.filter((r) => !program.catalog.some((p) =>
    p.source === 'kivly' && p.rewardId === r.id && p.locationId === locationId)).map((r): StackPrizeItem => ({
      id: `kivly_${r.id}`, source: 'kivly', rewardId: r.id, name: r.name, locationId: locationId ?? '',
    }))]
  return <div className="space-y-5">
    <header>
      <h2 className="font-semibold text-lg">{t('Reglas de premios', 'Prize rules')}</h2>
      <p className="text-sm text-textSub">{t('Define cuándo se gana y qué se entrega. STAND: recogida con QR. Kivly: asignación automática a la cuenta del club.',
        'Choose when prizes are earned and what to deliver. STAND: collect with QR. Kivly: automatic assignment to the club account.')}</p>
    </header>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="text-sm text-accent">{message}</p>}
    {catalogError && <div role="alert" className="text-sm text-amber-300">{catalogError}
      <button type="button" className="ml-2 underline" disabled={busy || dirty} onClick={() => setRevision((r) => r + 1)}>{t('Reintentar', 'Retry')}</button>
    </div>}
    <fieldset disabled={busy || !editable} className="space-y-4">
      <div className="rounded-2xl border border-white/10 p-4 space-y-3">
        <h3 className="text-sm font-semibold">{t('Tus premios STAND', 'Your STAND prizes')}</h3>
        <div className="flex gap-2">
          <input aria-label={t('Nombre del premio STAND', 'STAND prize name')} value={name} maxLength={200} onChange={(e) => setName(e.target.value)}
            className={`${field} flex-1 w-full`} placeholder={t('Por ejemplo: porción de pizza', 'For example: pizza slice')} />
          <button type="button" className={action} disabled={!name.trim() || program.catalog.length >= 32} onClick={addStand}>{t('Añadir', 'Add')}</button>
        </div>
        {program.catalog.filter((p) => p.source === 'stand').map((p) => <div key={p.id} className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-2 text-sm">
          {p.imageUrl && <img src={p.imageUrl} alt={`${t('Vista previa del premio', 'Prize preview')} ${p.name}`} className="w-10 h-10 object-contain" />}
          <span className="flex-1">{p.name} <span className="text-xs text-textSub">STAND</span></span>
          <label className={`${action} cursor-pointer`}>{p.imageKey ? t('Cambiar imagen', 'Change image') : t('Imagen opcional', 'Optional image')}
            <input type="file" accept="image/png" className="sr-only" aria-label={`${t('Imagen de', 'Image for')} ${p.name}`} onChange={(e) => {
              const file = e.target.files?.[0]; if (file) void chooseImage(p, file)
            }} />
          </label>
          {p.imageKey && <button type="button" className="text-textSub underline" aria-label={`${t('Quitar imagen de', 'Remove image for')} ${p.name}`}
            onClick={() => change({ ...program, catalog: program.catalog.map((item) => item.id === p.id ? { ...item, imageKey: null, imageUrl: null } : item) })}>
            {t('Quitar imagen', 'Remove image')}
          </button>}
        </div>)}
        <p className="text-xs text-textSub">{t('PNG, máx. 5 MB.', 'PNG, max. 5 MB.')}</p>
      </div>
      <input className={`${field} w-full`} value={search} onChange={(e) => setSearch(e.target.value)}
        aria-label={t('Buscar premios', 'Search prizes')} placeholder={t('Buscar entre premios STAND y Kivly…', 'Search STAND and Kivly prizes…')} />
      {program.rules.map((rule, index) => <section key={index} className="rounded-2xl border border-primary/25 bg-primary/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{t('Cuando', 'When')}</span>
          <select aria-label={`${t('Condición', 'Condition')} ${index + 1}`} className={`${field} flex-1`} value={rule.condition}
            onChange={(e) => {
              const condition = e.target.value as StackPrizeCondition
              change({ ...program, rules: program.rules.map((r, i) => i === index
                ? { id: newId(), condition, prizeIds: r.prizeIds, ...(condition.startsWith('top_') ? { topX: 10 } : {}) } : r) })
            }}>
            {conditions.filter((c) => c !== 'raffle' || raffles || rule.condition === 'raffle').map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
          {rule.condition.startsWith('top_') && <label className="flex items-center gap-2">top
            <input type="number" min={1} max={100} value={rule.topX ?? 10} className={`${field} w-20`} aria-label={`Top ${index + 1}`}
              onChange={(e) => change({ ...program, rules: program.rules.map((r, i) => i === index ? { ...r, id: newId(), topX: e.target.valueAsNumber } : r) })} />
          </label>}
          <button type="button" className="text-textSub underline" onClick={() => change({ ...program, rules: program.rules.filter((_, i) => i !== index) })}>{t('Quitar regla', 'Remove rule')}</button>
        </div>
        <p className="text-sm">{t('entregar', 'deliver')} {rule.prizeIds.length === 0 && <span className="text-textSub">{t('— selecciona uno o varios premios', '— select one or more prizes')}</span>}</p>
        <div className="flex flex-wrap gap-2">
          {rule.prizeIds.map((id) => {
            const p = program.catalog.find((item) => item.id === id)
            return <button type="button" key={id} className="rounded-full border border-primary/30 px-3 py-1 text-sm"
              aria-label={`${t('Quitar premio', 'Remove prize')} ${p?.name}`}
              onClick={() => change({ ...program, rules: program.rules.map((r, i) => i === index ? { ...r, id: newId(), prizeIds: r.prizeIds.filter((pid) => pid !== id) } : r) })}>
              {p?.name} · {p?.source === 'kivly' ? 'Kivly' : 'STAND'}
            </button>
          })}
        </div>
        <select className={`${field} w-full`} aria-label={`${t('Añadir premio a regla', 'Add prize to rule')} ${index + 1}`} value="" disabled={rule.prizeIds.length >= 8}
          onChange={(e) => {
            const selected = available.find((item) => item.id === e.target.value)
            if (!selected) return
            const existing = program.catalog.some((item) => item.id === selected.id)
            if (!existing && program.catalog.length >= 32) return
            const p = existing ? selected : { ...selected, id: newId() }
            change({ ...program, catalog: existing ? program.catalog : [...program.catalog, p],
              rules: program.rules.map((r, i) => i === index ? { ...r, id: newId(), prizeIds: [...r.prizeIds, p.id] } : r) })
          }}>
          <option value="">{t('Seleccionar premio…', 'Select prize…')}</option>
          {(['stand', 'kivly'] as const).map((source) => <optgroup key={source} label={source === 'stand' ? 'STAND · QR' : 'Kivly · Wallet'}>
            {available.filter((p) => p.source === source && !rule.prizeIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase())).map((p) =>
              <option key={p.id} value={p.id} disabled={program.catalog.length >= 32 && !program.catalog.some((item) => item.id === p.id)}>{p.name}</option>)}
          </optgroup>)}
        </select>
        {rule.prizeIds.length > 0 && <button type="button" className="text-xs text-textSub underline"
          onClick={() => change({ ...program, rules: program.rules.map((r, i) => i === index ? { ...r, id: newId(), prizeIds: [] } : r) })}>
          {t('Vaciar selección', 'Clear selection')}
        </button>}
      </section>)}
      <button type="button" className={action} disabled={program.rules.length >= 8} onClick={() => change({ ...program,
        rules: [...program.rules, { id: newId(), condition: 'completed', prizeIds: [] }] })}>{t('Añadir regla', 'Add rule')}</button>
      <label className="block space-y-2 text-sm">
        <span>{t('Web oficial del club Kivly', 'Official Kivly club website')}</span>
        <input type="url" aria-label={t('Web oficial del club Kivly', 'Official Kivly club website')} className={`${field} w-full`} value={program.storefrontUrl} placeholder="https://tu-negocio.kivly.store"
          onChange={(e) => change({ ...program, storefrontUrl: e.target.value })} />
        <span className="block text-xs text-textSub">{t('Solo el origen del negocio, sin /add-to-wallet ni identificadores de clientes.',
          'Only the business origin, without /add-to-wallet or customer identifiers.')}</span>
      </label>
      <button type="button" className={`${action} w-full font-semibold`} disabled={program.rules.some((r) => r.prizeIds.length === 0) || (!dirty && data.enabled)}
        onClick={() => void save()}>{busy ? t('Guardando…', 'Saving…') : t('Guardar reglas de premios', 'Save prize rules')}</button>
    </fieldset>
    {data.enabled && <section className="border-t border-white/10 pt-4 space-y-3">
      <h3 className="font-semibold">{t('Cierre del juego', 'Game closure')}</h3>
      <p className="text-sm text-textSub">{data.state === 'closed' ? t('Cerrado: ranking definitivo y premios conservados.', 'Closed: final ranking and prizes preserved.')
        : data.state === 'closing' ? t('Cerrando: esperando partidas en curso.', 'Closing: waiting for active games.')
          : t('El cierre es definitivo. No es lo mismo que pausar el juego.', 'Closure is final. It is different from pausing the game.')}</p>
      {data.pendingPlayers.map((p) => <p key={p.playerId} className="text-sm">#{p.playerId} · {p.name}</p>)}
      {data.state !== 'closed' && <>
        <button type="button" className={action} disabled={busy || dirty} onClick={() => data.state === 'closing' ? void close(false) : setConfirmClose(true)}>
          {t(data.state === 'closing' ? 'Comprobar y finalizar cierre' : 'Cerrar juego y entregar premios finales', data.state === 'closing' ? 'Check and finish closure' : 'Close game and deliver final prizes')}
        </button>
        {confirmClose && <div role="alert" className="space-y-2 text-sm"><p>{t('Se bloquearán nuevos intentos. Al terminar los pendientes, el ranking será definitivo. Esta acción no se puede deshacer.',
          'New attempts will be blocked. Once pending games finish, the ranking becomes final. This cannot be undone.')}</p>
          <button className={action} disabled={busy} onClick={() => void close(false)}>{t('Confirmar cierre', 'Confirm closure')}</button>
          <button className="ml-3 underline" onClick={() => setConfirmClose(false)}>{t('Cancelar', 'Cancel')}</button></div>}
        {data.state === 'closing' && data.pendingPlayers.length > 0 && <button className="block text-sm text-amber-300 underline" disabled={busy} onClick={() => setConfirmExclude(true)}>
          {t('Excluir los intentos pendientes', 'Exclude pending attempts')}</button>}
        {confirmExclude && <div role="alert" className="text-sm space-y-2"><p>{t('Todos los intentos pendientes mostrados se excluirán sin puntuación ni premios. Sus resultados tardíos serán rechazados.',
          'All pending attempts shown will be excluded without a score or prizes. Late results will be rejected.')}</p>
          <button className={action} disabled={busy} onClick={() => void close(true)}>{t('Confirmar exclusión y cierre', 'Confirm exclusion and close')}</button>
          <button className="ml-3 underline" onClick={() => setConfirmExclude(false)}>{t('Cancelar', 'Cancel')}</button></div>}
      </>}
    </section>}
    {data.awards.length > 0 && <section className="space-y-2 border-t border-white/10 pt-4">
      <div className="flex justify-between gap-2"><h3 className="font-semibold">{t('Entregas', 'Deliveries')}</h3>
        <button className="text-sm underline" disabled={busy || dirty} onClick={() => setRevision((r) => r + 1)}>{t('Actualizar', 'Refresh')}</button></div>
      {data.awards.map((a) => <div key={a.id} className="text-sm flex flex-wrap justify-between gap-2 border-b border-white/5 py-2">
        <span>#{a.playerId} · {a.name} · {a.source === 'kivly' ? 'Kivly' : 'STAND'}</span>
        <span className={a.state.includes('required') ? 'text-amber-300' : 'text-textSub'}>{({
          available: t('Pendiente de recogida', 'Awaiting collection'),
          delivered: t('Recogido', 'Collected'),
          queued: t('En cola', 'Queued'),
          sending: t('Confirmando en Kivly', 'Confirming in Kivly'),
          confirmed: t('Asignado en Kivly', 'Assigned in Kivly'),
          reconciliation_required: t('Requiere comprobación', 'Verification required'),
          connection_required: t('Revisar conexión Kivly', 'Check Kivly connection'),
        })[a.state]}{a.lastError && <span className="block text-amber-300">{a.lastError}</span>}</span>
      </div>)}
    </section>}
  </div>
}
