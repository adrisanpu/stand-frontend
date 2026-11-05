import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import SaveButton from '../ui/SaveButton'
import type { GameDefinition } from '../types'
import type { GamePrize, PrizeCatalog, PrizeSlot } from '../prizes'
import type { Plan } from '../../auth/featureFlags'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import {
  fetchPrizeGame, savePrizeCatalog,
} from '../../api/prizeMedia'
import { fetchSharedPrizeCatalog, type SharedPrize } from '../../api/sharedPrizeCatalog'
import { prizeInventoryApi, type PrizeInventory } from '../../api/prizeInventory'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import {
  getOperatorPrizeSlotVisibility, readMaxPrizeValidation, readMaxPrizeRanking, readMaxPrizeRaffle,
} from './operatorPrizeSlots'
import StackPrizeSettings from './StackPrizeSettings'

type Props = {
  gameId: string
  gameDefinition: GameDefinition
  settings: Record<string, unknown> | null
  plan: Plan | null | undefined
  onPersist: (patch: Record<string, unknown>) => void
  onSavingChange?: (saving: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
}
type Draft = {
  name: string
  limit: string
  topX: string
  imageKey: string | null
  imageUrl: string | null
  sharedPrizeId: string
}
const slotNames = ['validation', 'ranking', 'raffle'] as const
const nameKeys = { validation: 'prizeValidation', ranking: 'prizeTopX', raffle: 'prizeRaffle' } as const
const limitKeys = { validation: 'maxPrizeValidation', ranking: 'maxPrizeRanking', raffle: 'maxPrizeRaffle' } as const
const inputClass = 'w-full h-9 px-2.5 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm focus:border-white/20 focus:outline-none min-w-0'
const labelClass = 'mb-1 block text-[11px] font-medium text-gray-400'

function draftsFrom(catalog: PrizeCatalog): Record<PrizeSlot, Draft> {
  return Object.fromEntries(slotNames.map(slot => {
    const prize = catalog[slot]
    return [slot, {
      name: prize?.name ?? '', limit: prize?.limit == null ? '' : String(prize.limit),
      topX: String(prize?.topX ?? 3), imageKey: prize?.imageKey ?? null,
      imageUrl: prize?.imageUrl ?? null, sharedPrizeId: prize?.sharedPrizeId ?? '',
    }]
  })) as Record<PrizeSlot, Draft>
}

function legacyCatalog(settings: Props['settings'], slots: Record<PrizeSlot, boolean>): PrizeCatalog {
  const limits = {
    validation: readMaxPrizeValidation(settings),
    ranking: readMaxPrizeRanking(settings),
    raffle: readMaxPrizeRaffle(settings),
  }
  const catalog: PrizeCatalog = {}
  for (const slot of slotNames) {
    if (!slots[slot]) continue
    const name = settings?.[nameKeys[slot]]
    catalog[slot] = {
      name: typeof name === 'string' ? name : '',
      limit: limits[slot] ?? null,
      ...(slot === 'ranking' ? { topX: typeof settings?.topX === 'number' ? settings.topX : 3 } : {}),
    }
  }
  return catalog
}

function validInteger(value: string, min: number, max = Number.MAX_SAFE_INTEGER): boolean {
  return /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max
}

export default function OperatorPrizeSettings(props: Props) {
  return props.gameDefinition.id === 'STACK'
    ? <StackPrizeSettings gameId={props.gameId} raffles={getFeaturesByPlan(props.plan).raffles}
        onPersist={props.onPersist} onSavingChange={props.onSavingChange} onDirtyChange={props.onDirtyChange} />
    : <LegacyPrizeSettings {...props} />
}

function LegacyPrizeSettings({
  gameId, gameDefinition, settings, plan, onPersist, onSavingChange, onDirtyChange,
}: Props) {
  const { t } = useOperatorLanguage()
  const slots = getOperatorPrizeSlotVisibility(gameDefinition, getFeaturesByPlan(plan))
  const [catalog, setCatalog] = useState<PrizeCatalog>({})
  const [sharedCatalog, setSharedCatalog] = useState<SharedPrize[]>([])
  const [inventory, setInventory] = useState<PrizeInventory | null>(null)
  const [drafts, setDrafts] = useState(() => draftsFrom(legacyCatalog(settings, slots)))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [numberErrors, setNumberErrors] = useState<Partial<Record<PrizeSlot, boolean>>>({})
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [refreshWarning, setRefreshWarning] = useState(false)
  const [cacheWarning, setCacheWarning] = useState(false)
  const savingRef = useRef(false)
  const latest = useRef({ settings, slots, onSavingChange })
  latest.current = { settings, slots, onSavingChange }
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      latest.current.onSavingChange?.(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setSaved(false)
    Promise.all([fetchSharedPrizeCatalog(), prizeInventoryApi.get()]).then(([shared, balances]) => {
      if (cancelled) return null
      setSharedCatalog(shared.catalog)
      setInventory(balances)
      return fetchPrizeGame(gameId)
    }).then(data => {
      if (!data) return
      if (cancelled) return
      if (!data.ok) throw new Error('Load failed')
      const hasCatalog = Object.prototype.hasOwnProperty.call(data, 'prizeCatalog')
      const next = hasCatalog ? data.prizeCatalog ?? {} : legacyCatalog(latest.current.settings, latest.current.slots)
      if (!hasCatalog && gameDefinition.id === 'EMPAREJA2' && next.validation) {
        const max = data.settings?.empareja2?.maxValidations
        if (typeof max === 'number' && max >= 0) next.validation.limit = max
      }
      setCatalog(next)
      setDrafts(draftsFrom(next))
    }).catch(() => {
      if (!cancelled) setLoadError(true)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [gameId, gameDefinition.id, loadAttempt])

  const changeDraft = (slot: PrizeSlot, patch: Partial<Draft>) => {
    setDrafts(current => ({ ...current, [slot]: { ...current[slot], ...patch } }))
    setSaved(false)
    onDirtyChange?.(true)
  }

  const handleSave = async () => {
    if (savingRef.current || loading || loadError || refreshWarning) return
    const invalid: Partial<Record<PrizeSlot, boolean>> = {}
    for (const slot of slotNames) {
      if (!slots[slot]) continue
      const draft = drafts[slot]
      if ((draft.limit.trim() !== '' && !validInteger(draft.limit, 0))
        || (slot === 'ranking' && !validInteger(draft.topX, 1, 100))) invalid[slot] = true
    }
    setNumberErrors(invalid)
    setSaveError('')
    setSaved(false)
    setRefreshWarning(false)
    setCacheWarning(false)
    if (Object.keys(invalid).length) return
    savingRef.current = true
    setSaving(true)
    latest.current.onSavingChange?.(true)
    let persisted: PrizeCatalog | undefined
    try {
      const next = { ...catalog }
      for (const slot of slotNames) {
        if (!slots[slot]) continue
        const draft = drafts[slot]
        const prize: GamePrize = {
          name: draft.name.trim(), limit: draft.limit.trim() === '' ? null : Number(draft.limit),
          sharedPrizeId: draft.sharedPrizeId || undefined, imageKey: draft.imageKey,
          imageUrl: draft.imageUrl,
          ...(slot === 'ranking' ? { topX: Number(draft.topX) } : {}),
        }
        next[slot] = prize
      }
      await savePrizeCatalog(gameId, next)
      persisted = next
    } catch (error) {
      setSaveError(error instanceof Error && error.message ? error.message : 'unknown')
    }
    if (persisted) {
      // A failed URL refresh must not turn a confirmed write into a reported save failure.
      let display = persisted
      let refreshedCatalog = false
      try {
        const refreshed = await fetchPrizeGame(gameId)
        if (!refreshed.ok || !Object.prototype.hasOwnProperty.call(refreshed, 'prizeCatalog')) throw new Error('Refresh failed')
        display = refreshed.prizeCatalog ?? {}
        refreshedCatalog = true
      } catch {
        setRefreshWarning(true)
      }
      setCatalog(display)
      setDrafts(draftsFrom(display))
      const cacheCatalog: PrizeCatalog = {}
      for (const slot of slotNames) {
        const prize = display[slot]
        if (prize) cacheCatalog[slot] = { ...prize }
      }
      // Upload keys may be promoted on commit; only publish keys read back from the server.
      const patch: Record<string, unknown> = refreshedCatalog ? { prizeCatalog: cacheCatalog } : {}
      for (const slot of slotNames) {
        if (!slots[slot]) continue
        const prize = display[slot]
        patch[nameKeys[slot]] = prize?.name || undefined
        patch[limitKeys[slot]] = prize?.limit ?? undefined
        if (slot === 'ranking') patch.topX = prize?.topX ?? 3
        if (slot === 'validation') patch.maxValidations = undefined
      }
      setSaved(true)
      onDirtyChange?.(false)
      try {
        onPersist(patch)
      } catch {
        setCacheWarning(true)
      }
    }
    savingRef.current = false
    setSaving(false)
    latest.current.onSavingChange?.(false)
  }

  const noSlots = !slotNames.some(slot => slots[slot])
  return (
    <div className="space-y-3">
      {noSlots && <p>{t('No hay premios configurables para este juego con tu plan actual.', 'No prizes can be configured for this game on your current plan.')}</p>}
      {loading && <p role="status">{t('Cargando premios...', 'Loading prizes...')}</p>}
      {loadError && <div role="alert">
        <p>{t('No se pudieron cargar los premios. Reintenta antes de guardar.', 'Prizes could not be loaded. Retry before saving.')}</p>
        <button type="button" onClick={() => setLoadAttempt(value => value + 1)}>{t('Reintentar', 'Retry')}</button>
      </div>}
      {!loading && !loadError && sharedCatalog.length === 0 && <p className="text-sm text-textSub">
        {t('Añade premios en Administración > Premios antes de asignarlos a esta partida.', 'Add prizes in Administration > Prizes before assigning them to this event.')}
        {' '}<Link className="underline" to="/admin/prizes">{t('Abrir catálogo', 'Open catalog')}</Link>
      </p>}
      <fieldset disabled={loading || loadError || saving} className="space-y-2 min-w-0">
        {slotNames.filter(slot => slots[slot]).map(slot => {
          const draft = drafts[slot]
          const balance = inventory?.catalog.find(prize => prize.id === draft.sharedPrizeId)?.inventory
          const title = slot === 'validation' ? t('Validación / participación', 'Validation / participation')
            : slot === 'ranking' ? t('Ranking', 'Ranking') : t('Sorteo', 'Raffle')
          const id = `op-prize-${slot}`
          return (
            <section key={slot} aria-labelledby={`${id}-title`} className="space-y-1.5 rounded-lg border border-white/10 p-2.5">
              <h3 id={`${id}-title`} className="text-xs font-semibold text-gray-300">{title}</h3>
              <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.45fr)]">
                <div className="min-w-0">
                  <label className={labelClass} htmlFor={`${id}-shared-prize`}>{t('Premio compartido', 'Shared prize')}</label>
                  <div className="flex min-w-0 items-center gap-2">
                    {draft.imageUrl && <img src={draft.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-contain" />}
                    <select id={`${id}-shared-prize`} className={inputClass} value={draft.sharedPrizeId}
                      onChange={event => {
                        const selected = sharedCatalog.find(prize => prize.id === event.target.value)
                        changeDraft(slot, {
                          sharedPrizeId: selected?.id ?? '', name: selected?.name ?? '',
                          imageKey: selected?.imageKey ?? null, imageUrl: selected?.imageUrl ?? null,
                        })
                      }}>
                      <option value="">{t('Sin premio asignado', 'No prize assigned')}</option>
                      {sharedCatalog.map(prize => <option key={prize.id} value={prize.id}>{prize.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor={`${id}-limit`}>{t('Límite por evento', 'Event cap')}</label>
                  <input id={`${id}-limit`} className={inputClass} inputMode="numeric" placeholder="∞" value={draft.limit}
                    aria-invalid={!!numberErrors[slot]} aria-describedby={numberErrors[slot] ? `${id}-number-error` : undefined}
                    onChange={event => changeDraft(slot, { limit: event.target.value })} />
                </div>
                <p className="text-[11px] text-textSub">{t('Límite opcional de esta partida; vacío significa sin límite. El stock físico se gestiona en Administración > Premios.',
                  'Optional cap for this event; blank means unlimited. Manage physical stock in Administration > Prizes.')}</p>
                {draft.sharedPrizeId && <p className="text-xs text-textSub">{t('Disponible compartido', 'Shared available')}: {
                  balance?.initialized ? balance.available : t('Sin inicializar', 'Uninitialized')
                }</p>}
                {inventory?.mode === 'legacy' && <p className="text-xs text-textSub">{t('Modo anterior: se mantiene el stock previo hasta la activación general.',
                  'Legacy mode: previous stock remains until general activation.')}</p>}
                {draft.limit.trim() === '0' && <p className="text-xs text-amber-300">{t('Límite por evento: 0. Esta partida no repartirá este premio.',
                  'Event cap: 0. This event will not award this prize.')}</p>}
                {balance?.initialized && balance.available === 0 && <p className="text-xs text-amber-300">{t('Se ha agotado el stock compartido del premio.',
                  'Shared prize stock is exhausted.')}</p>}
              </div>
              {slot === 'ranking' && <p className="text-[11px] text-textSub">{t(
                'La condición top se edita en Configurar partida > Condiciones.',
                'Edit the top condition under Event settings > Conditions.',
              )}</p>}
              {numberErrors[slot] && <p id={`${id}-number-error`} role="alert" className="text-sm text-red-300">
                {t('El límite debe ser un entero ≥ 0 o vacío (sin límite). Top X debe ser un entero entre 1 y 100.', 'Limit must be a whole number ≥ 0 or empty (unlimited). Top X must be a whole number from 1 to 100.')}
              </p>}
            </section>
          )
        })}
      </fieldset>
      {saveError && <p role="alert" className="text-red-300">{t('No se han guardado los cambios. Reintenta.', 'Changes were not saved. Please retry.')} {saveError !== 'unknown' ? saveError : ''}</p>}
      {saved && <p role="status" className="text-green-300">{t('Guardado.', 'Saved.')}</p>}
      {refreshWarning && <p role="status">{t('Los premios se guardaron en el servidor, pero no se pudo actualizar la vista. Se conserva la vista previa; vuelve a abrir para refrescar antes de guardar de nuevo.', 'Prizes were saved on the server, but the display could not be refreshed. The preview is retained; reopen to refresh before saving again.')}</p>}
      {cacheWarning && <p role="status">{t('Los premios se guardaron en el servidor, pero no se pudo actualizar la caché local. Vuelve a abrir la partida para refrescar.', 'Prizes were saved on the server, but the local cache could not be updated. Reopen the game to refresh.')}</p>}
      <SaveButton onClick={() => void handleSave()} disabled={loading || loadError || saving || refreshWarning || noSlots}
        className="w-full">
        {saving ? t('Guardando...', 'Saving...') : t('Guardar', 'Save')}
      </SaveButton>
    </div>
  )
}
