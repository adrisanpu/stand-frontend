import { useEffect, useRef, useState } from 'react'
import { stackPrizeApi, type StackPrizeCondition, type StackPrizeItem, type StackPrizeProgram, type StackPrizeRule, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import { kivlyApi, type KivlyReward } from '../../api/kivlyApi'
import { PrizeImageError, uploadPrizeImage, validatePrizeImage } from '../../api/prizeMedia'
import { useOperatorLanguage } from '../shell/operatorLanguage'

const field = 'rounded-xl border border-white/15 bg-surface px-3 py-2 text-sm min-w-0'
const action = 'rounded-xl border border-primary/30 bg-primary/20 px-3 py-2 text-sm hover:bg-primary/30 disabled:opacity-40'
const conditions: StackPrizeCondition[] = ['completed', 'top_finish', 'top_final', 'raffle']
const newId = () => crypto.randomUUID()

export default function StackPrizeSettings({ gameId, raffles, onPersist, onSavingChange }: {
  gameId: string
  raffles: boolean
  onPersist: (patch: Record<string, unknown>) => void
  onSavingChange?: (saving: boolean) => void
}) {
  const { t } = useOperatorLanguage()
  const text = useRef(t)
  text.current = t
  const [data, setData] = useState<StackPrizeSettingsResponse | null>(null)
  const [program, setProgram] = useState<StackPrizeProgram | null>(null)
  const [rewards, setRewards] = useState<KivlyReward[]>([])
  const [locationId, setLocationId] = useState<string | null>(null)
  const [catalogError, setCatalogError] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [name, setName] = useState('')
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
    void stackPrizeApi.get(gameId).then((response) => {
      if (cancelled) return
      if (response.ok !== true || response.program?.version !== 3) throw new Error('Invalid prize configuration')
      setData(response)
      setProgram(response.program)
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : text.current('No se pudieron cargar los premios.', 'Could not load prizes.'))
    })
    return () => { cancelled = true }
  }, [gameId, revision])
  useEffect(() => {
    let cancelled = false
    setRewards([])
    setLocationId(null)
    setCatalogError('')
    void kivlyApi.getAccountConnection().then(async (connection) => {
      if (!connection.connected) return
      const catalog = await kivlyApi.listRewards(gameId)
      if (!cancelled) { setLocationId(connection.locationId); setRewards(catalog) }
    }).catch(() => {
      if (!cancelled) setCatalogError(text.current('No se pudo cargar Kivly. Comprueba la conexión antes de guardar sus premios.',
        'Could not load Kivly. Check the connection before saving its rewards.'))
    })
    return () => { cancelled = true }
  }, [gameId, catalogRevision])

  const change = (next: StackPrizeProgram) => { setProgram(next); setDirty(true); setMessage('') }
  const run = async (work: () => Promise<void>) => {
    if (busy) return
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
    setData((previous) => previous ? {
      ...previous, program: saved, enabled: true,
      inventory: saved.catalog.map((prize) => {
        const old = previous.inventory.find((item) => item.prizeId === prize.id)
        const consumed = old ? Math.max(0, old.total - old.remaining) : 0
        return { prizeId: prize.id, total: prize.stockTotal, remaining: Math.max(0, prize.stockTotal - consumed) }
      }),
    } : previous)
    onPersist({ stackPrizeProgram: saved, prizeCatalog: {} })
    setMessage(t('Premios guardados. Los premios ya ganados se conservan.', 'Prizes saved. Previously earned prizes are preserved.'))
  })
  const chooseImage = (prize: StackPrizeItem, file: File) => run(async () => {
    if (!program) return
    await validatePrizeImage(file)
    const imageKey = await uploadPrizeImage(gameId, 'ranking', file)
    const oldPreview = previews.current.get(prize.id)
    if (oldPreview) URL.revokeObjectURL(oldPreview)
    const imageUrl = URL.createObjectURL(file)
    previews.current.set(prize.id, imageUrl)
    change({ ...program, catalog: program.catalog.map((item) => item.id === prize.id ? { ...item, imageKey, imageUrl } : item) })
    setMessage(t('Imagen preparada; guarda para aplicarla.', 'Image ready; save to apply it.'))
  })
  if (!program || !data) return <div className="space-y-3">
    {error ? <p role="alert" className="text-red-300">{error}</p> : <p role="status">{t('Cargando premios...', 'Loading prizes...')}</p>}
    {error && <button className={action} onClick={() => setRevision((value) => value + 1)}>{t('Reintentar', 'Retry')}</button>}
  </div>
  const editable = data.state === 'open'
  const available = [...program.catalog, ...rewards.filter((reward) => !program.catalog.some((prize) =>
    prize.source === 'kivly' && prize.rewardId === reward.id && prize.locationId === locationId)).map((reward): StackPrizeItem => ({
      id: `kivly_${reward.id}`, source: 'kivly', rewardId: reward.id, name: reward.name, locationId: locationId ?? '', stockTotal: 100,
    }))]
  const invalidProgram = program.catalog.some((prize) => {
    const stock = data.inventory.find((item) => item.prizeId === prize.id)
    const allocated = stock ? stock.total - stock.remaining : 0
    return !Number.isInteger(prize.stockTotal) || prize.stockTotal < Math.max(1, allocated) || prize.stockTotal > 1000
  }) || program.rules.some((rule) => rule.groups.length === 0 || rule.groups.some((group) =>
    group.allocations.length === 0 || group.allocations.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10))
    || (rule.condition.startsWith('top_') && (!Number.isInteger(rule.topX) || (rule.topX ?? 0) < 1 || (rule.topX ?? 101) > 100)))
  const updateRule = (index: number, rule: StackPrizeRule) => change({
    ...program, rules: program.rules.map((previous, i) => i === index ? { ...rule, id: newId() } : previous),
  })
  const addPrize = (ruleIndex: number, groupIndex: number, id: string) => {
    const selected = available.find((item) => item.id === id)
    if (!selected) return
    const existing = program.catalog.some((item) => item.id === id)
    if (!existing && program.catalog.length >= 32) return
    const prize = existing ? selected : { ...selected, id: newId() }
    change({
      ...program, catalog: existing ? program.catalog : [...program.catalog, prize],
      rules: program.rules.map((rule, index) => index === ruleIndex ? { ...rule, id: newId(),
        groups: rule.groups.map((group, i) => i === groupIndex
          ? { allocations: [...group.allocations, { prizeId: prize.id, quantity: 1 }] } : group),
      } : rule),
    })
  }
  return <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 pb-4">
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="text-sm text-accent">{message}</p>}
    {catalogError && <div role="alert" className="text-sm text-amber-300">{catalogError}
      <button type="button" className="ml-2 underline" disabled={busy} onClick={() => setCatalogRevision((value) => value + 1)}>{t('Reintentar', 'Retry')}</button>
    </div>}
    {!editable && <p role="status" className="text-sm text-textSub">{t('El juego se está cerrando o está cerrado. Los premios no se pueden editar.',
      'The game is closing or closed. Prizes cannot be edited.')}</p>}
    <fieldset disabled={busy || !editable} className="space-y-4">
      <section className="rounded-xl border border-white/10 p-3 space-y-3">
        <h3 className="text-sm font-semibold">{t('Catálogo e inventario', 'Catalog and stock')}</h3>
        <div className="flex gap-2">
          <input aria-label={t('Nombre del premio STAND', 'STAND prize name')} value={name} maxLength={200} onChange={(event) => setName(event.target.value)}
            className={`${field} flex-1 w-full`} placeholder={t('Nombre del nuevo premio STAND', 'New STAND prize name')} />
          <button type="button" className={action} disabled={!name.trim() || program.catalog.length >= 32} onClick={() => {
            change({ ...program, catalog: [...program.catalog, { id: newId(), source: 'stand', name: name.trim(), limit: null, stockTotal: 100 }] })
            setName('')
          }}>{t('Añadir', 'Add')}</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {available.map((prize) => {
            const configured = program.catalog.some((item) => item.id === prize.id)
            const stock = data.inventory.find((item) => item.prizeId === prize.id)
            const remaining = Math.max(0, prize.stockTotal - (stock ? stock.total - stock.remaining : 0))
            return <div key={prize.id} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {prize.imageUrl && <img src={prize.imageUrl} alt={`${t('Vista previa del premio', 'Prize preview')} ${prize.name}`} className="w-9 h-9 shrink-0 object-contain" />}
                <span className="min-w-0 flex-1 break-words font-medium">{prize.name}</span>
                <span className="text-xs text-textSub">{prize.source === 'kivly' ? 'Kivly' : 'STAND'}</span>
              </div>
              {configured ? <>
                <label className="flex flex-wrap items-center gap-2 text-xs text-textSub">{t('Stock total', 'Total stock')}
                  <input type="number" min={1} max={1000} value={Number.isFinite(prize.stockTotal) ? prize.stockTotal : ''} className={`${field} w-20 text-textMain`}
                    aria-label={`${t('Inventario total Y de', 'Total stock Y for')} ${prize.name}`}
                    onChange={(event) => change({ ...program, catalog: program.catalog.map((item) =>
                      item.id === prize.id ? { ...item, stockTotal: event.target.valueAsNumber } : item) })} />
                </label>
                <p className="text-xs text-textSub">{t('Disponibles', 'Available')}: {Number.isFinite(remaining) ? remaining : '—'}</p>
              </> : <button type="button" className={action} disabled={program.catalog.length >= 32}
                onClick={() => change({ ...program, catalog: [...program.catalog, { ...prize, id: newId() }] })}>
                {t('Añadir al inventario', 'Add to stock')}
              </button>}
              {prize.source === 'stand' && <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded text-xs text-textSub underline focus-within:ring-2 focus-within:ring-primary">
                  {prize.imageKey ? t('Cambiar imagen', 'Change image') : t('+ Imagen opcional', '+ Optional image')}
                  <input type="file" accept="image/png" className="sr-only" aria-label={`${t('Imagen de', 'Image for')} ${prize.name}`} onChange={(event) => {
                    const file = event.target.files?.[0]; if (file) void chooseImage(prize, file)
                  }} />
                </label>
                {prize.imageKey && <button type="button" className="text-xs text-textSub underline" aria-label={`${t('Quitar imagen de', 'Remove image for')} ${prize.name}`}
                  onClick={() => change({ ...program, catalog: program.catalog.map((item) => item.id === prize.id ? { ...item, imageKey: null, imageUrl: null } : item) })}>
                  {t('Quitar imagen', 'Remove image')}
                </button>}
              </div>}
            </div>
          })}
        </div>
        <p className="text-xs text-textSub">{t('Stock compartido entre reglas. Crea y edita los premios Kivly en su web. Imágenes STAND: PNG, máx. 5 MB.',
          'Stock is shared between rules. Create and edit Kivly rewards on its website. STAND images: PNG, max. 5 MB.')}</p>
      </section>
      <h3 className="text-sm font-semibold">{t('Cuándo y qué entregar', 'When and what to award')}</h3>
      {program.rules.map((rule, index) => <section key={index} aria-label={`${t('Regla', 'Rule')} ${index + 1}`}
        className="rounded-xl border border-primary/25 bg-primary/5 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-primary">{t('Regla', 'Rule')} {index + 1}</span>
          <button type="button" className="text-xs text-textSub underline" aria-label={`${t('Quitar regla', 'Remove rule')} ${index + 1}`}
            onClick={() => change({ ...program, rules: program.rules.filter((_, i) => i !== index) })}>{t('Quitar regla', 'Remove rule')}</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{t('Cuando', 'When')}</span>
          <select aria-label={`${t('Condición', 'Condition')} ${index + 1}`} className={`${field} flex-1`} value={rule.condition}
            onChange={(event) => {
              const condition = event.target.value as StackPrizeCondition
              updateRule(index, { ...rule, condition, topX: condition.startsWith('top_') ? 10 : undefined })
            }}>
            {conditions.filter((condition) => condition !== 'raffle' || raffles || rule.condition === 'raffle')
              .map((condition) => <option key={condition} value={condition}>{label(condition)}</option>)}
          </select>
          {rule.condition.startsWith('top_') && <label className="flex items-center gap-2">top
            <input type="number" min={1} max={100} value={Number.isFinite(rule.topX) ? rule.topX : ''} className={`${field} w-20`} aria-label={`Top ${index + 1}`}
              onChange={(event) => updateRule(index, { ...rule, topX: event.target.valueAsNumber })} />
          </label>}
        </div>
        {rule.groups.map((group, groupIndex) => <div key={groupIndex}>
          {groupIndex > 0 && <p className="py-2 text-center text-xs font-bold text-primary">{t('O · un grupo al azar', 'OR · one random group')}</p>}
          <div className="rounded-xl border border-white/15 bg-surface/50 p-3 space-y-2">
            <div className="flex justify-between gap-2 text-xs">
              <span>{t('Grupo', 'Group')} {groupIndex + 1}</span>
              {rule.groups.length > 1 && <button type="button" className="underline" aria-label={`${t('Quitar grupo', 'Remove group')} ${index + 1}.${groupIndex + 1}`}
                onClick={() => updateRule(index, { ...rule, groups: rule.groups.filter((_, i) => i !== groupIndex) })}>{t('Quitar grupo', 'Remove group')}</button>}
            </div>
            {group.allocations.map((allocation, allocationIndex) => {
              const prize = program.catalog.find((item) => item.id === allocation.prizeId)
              return <div key={allocation.prizeId}>
                {allocationIndex > 0 && <p className="text-xs font-bold text-primary py-1">{t('Y', 'AND')}</p>}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 break-words">{prize?.name}</span>
                  <label className="flex items-center gap-1 text-xs text-textSub">{t('Unid.', 'Qty.')}
                    <input type="number" min={1} max={10} value={Number.isFinite(allocation.quantity) ? allocation.quantity : ''} className={`${field} w-16`}
                      aria-label={`${t('Cantidad de', 'Quantity of')} ${prize?.name} · ${index + 1}.${groupIndex + 1}`}
                      onChange={(event) => updateRule(index, { ...rule, groups: rule.groups.map((item, i) => i === groupIndex ? {
                        allocations: item.allocations.map((entry, n) => n === allocationIndex ? { ...entry, quantity: event.target.valueAsNumber } : entry),
                      } : item) })} />
                  </label>
                  <button type="button" className="px-2 py-1 text-textSub" aria-label={`${t('Quitar premio', 'Remove prize')} ${prize?.name} · ${index + 1}.${groupIndex + 1}`}
                    onClick={() => updateRule(index, { ...rule, groups: rule.groups.map((item, i) => i === groupIndex
                      ? { allocations: item.allocations.filter((_, n) => n !== allocationIndex) } : item) })}>×</button>
                </div>
              </div>
            })}
            {group.allocations.length === 0 && <p className="text-xs text-amber-300">{t('Selecciona al menos un premio.', 'Select at least one prize.')}</p>}
            <select className={`${field} w-full`} aria-label={`${t('Añadir premio al grupo', 'Add prize to group')} ${index + 1}.${groupIndex + 1}`}
              value="" disabled={group.allocations.length >= 8} onChange={(event) => addPrize(index, groupIndex, event.target.value)}>
              <option value="">{group.allocations.length ? t('Y añadir premio…', 'AND add prize…') : t('Seleccionar premio…', 'Select prize…')}</option>
              {(['stand', 'kivly'] as const).map((source) => <optgroup key={source} label={source === 'stand' ? 'STAND' : 'Kivly'}>
                {available.filter((prize) => prize.source === source && !group.allocations.some((item) => item.prizeId === prize.id))
                  .map((prize) => <option key={prize.id} value={prize.id} disabled={program.catalog.length >= 32 && !program.catalog.some((item) => item.id === prize.id)}>{prize.name}</option>)}
              </optgroup>)}
            </select>
          </div>
        </div>)}
        <button type="button" className={action} disabled={rule.groups.length >= 8}
          onClick={() => updateRule(index, { ...rule, groups: [...rule.groups, { allocations: [] }] })}>{t('O añadir grupo', 'OR add group')}</button>
        <p className="text-xs text-textSub">{t('Sale un grupo al azar, con la misma probabilidad. Se entregan sus premios disponibles; los grupos agotados no participan.',
          'One group is chosen at random with equal probability. Its available prizes are awarded; exhausted groups are excluded.')}</p>
      </section>)}
      <button type="button" className={action} disabled={program.rules.length >= 8} onClick={() => change({ ...program,
        rules: [...program.rules, { id: newId(), condition: 'completed', groups: [{ allocations: [] }] }],
      })}>{t('Añadir regla', 'Add rule')}</button>
    </fieldset>
    </div>
    <div className="settings-footer border-t border-white/10 pt-3">
      <button type="button" className={`${action} w-full font-semibold`} disabled={busy || !editable || invalidProgram || (!dirty && data.enabled)}
        onClick={() => void save()}>{busy ? t('Guardando…', 'Saving…') : t('Guardar reglas de premios', 'Save prize rules')}</button>
    </div>
  </div>
}
