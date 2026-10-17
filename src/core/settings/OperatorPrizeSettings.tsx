import { useState, useEffect, useRef } from 'react'
import type { GameDefinition } from '../types'
import type { GamePrize, PrizeCatalog, PrizeSlot } from '../prizes'
import type { Plan } from '../../auth/featureFlags'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import {
  fetchPrizeGame, savePrizeCatalog, uploadPrizeImage, validatePrizeImage, PrizeImageError,
} from '../../api/prizeMedia'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import {
  getOperatorPrizeSlotVisibility, readMaxPrizeValidation, readMaxPrizeRanking, readMaxPrizeRaffle,
} from './operatorPrizeSlots'

type Props = {
  gameId: string
  gameDefinition: GameDefinition
  settings: Record<string, unknown> | null
  plan: Plan | null | undefined
  onPersist: (patch: Record<string, unknown>) => void
  onSavingChange?: (saving: boolean) => void
}
type Draft = {
  name: string
  limit: string
  topX: string
  imageKey: string | null
  imageUrl: string | null
  file?: File
}
const slotNames = ['validation', 'ranking', 'raffle'] as const
const nameKeys = { validation: 'prizeValidation', ranking: 'prizeTopX', raffle: 'prizeRaffle' } as const
const limitKeys = { validation: 'maxPrizeValidation', ranking: 'maxPrizeRanking', raffle: 'maxPrizeRaffle' } as const
const inputClass = 'w-full h-11 px-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none min-w-0'
const labelClass = 'mb-1 block text-xs font-medium text-gray-400'

function draftsFrom(catalog: PrizeCatalog): Record<PrizeSlot, Draft> {
  return Object.fromEntries(slotNames.map(slot => {
    const prize = catalog[slot]
    return [slot, {
      name: prize?.name ?? '', limit: prize?.limit == null ? '' : String(prize.limit),
      topX: String(prize?.topX ?? 3), imageKey: prize?.imageKey ?? null,
      imageUrl: prize?.imageUrl ?? null,
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

export default function OperatorPrizeSettings({
  gameId, gameDefinition, settings, plan, onPersist, onSavingChange,
}: Props) {
  const { t } = useOperatorLanguage()
  const slots = getOperatorPrizeSlotVisibility(gameDefinition, getFeaturesByPlan(plan))
  const [catalog, setCatalog] = useState<PrizeCatalog>({})
  const [drafts, setDrafts] = useState(() => draftsFrom(legacyCatalog(settings, slots)))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState<Partial<Record<PrizeSlot, boolean>>>({})
  const [imageErrors, setImageErrors] = useState<Partial<Record<PrizeSlot, string>>>({})
  const [numberErrors, setNumberErrors] = useState<Partial<Record<PrizeSlot, boolean>>>({})
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [refreshWarning, setRefreshWarning] = useState(false)
  const [cacheWarning, setCacheWarning] = useState(false)
  const savingRef = useRef(false)
  const validatingRef = useRef(new Set<PrizeSlot>())
  const filesVersion = useRef({ validation: 0, ranking: 0, raffle: 0 })
  const previewUrls = useRef<Partial<Record<PrizeSlot, string>>>({})
  const latest = useRef({ settings, slots, onSavingChange })
  latest.current = { settings, slots, onSavingChange }
  const alive = useRef(true)

  const clearPreview = (slot: PrizeSlot) => {
    const url = previewUrls.current[slot]
    if (url) URL.revokeObjectURL(url)
    delete previewUrls.current[slot]
  }

  useEffect(() => {
    alive.current = true
    const versions = filesVersion.current
    return () => {
      alive.current = false
      for (const slot of slotNames) {
        versions[slot]++
        clearPreview(slot)
      }
      latest.current.onSavingChange?.(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setSaved(false)
    fetchPrizeGame(gameId).then(data => {
      if (cancelled) return
      if (!data.ok) throw new Error('Load failed')
      const hasCatalog = Object.prototype.hasOwnProperty.call(data, 'prizeCatalog')
      const next = hasCatalog ? data.prizeCatalog ?? {} : legacyCatalog(latest.current.settings, latest.current.slots)
      if (!hasCatalog && gameDefinition.id === 'EMPAREJA2' && next.validation) {
        const max = data.settings?.empareja2?.maxValidations
        if (typeof max === 'number' && max >= 0) next.validation.limit = max
      }
      for (const slot of slotNames) clearPreview(slot)
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
  }

  const chooseImage = async (slot: PrizeSlot, file: File) => {
    const version = ++filesVersion.current[slot]
    validatingRef.current.add(slot)
    setValidating(current => ({ ...current, [slot]: true }))
    setImageErrors(current => ({ ...current, [slot]: undefined }))
    try {
      await validatePrizeImage(file)
      if (!alive.current || version !== filesVersion.current[slot]) return
      clearPreview(slot)
      const imageUrl = URL.createObjectURL(file)
      previewUrls.current[slot] = imageUrl
      changeDraft(slot, { file, imageUrl })
    } catch (error) {
      if (!alive.current || version !== filesVersion.current[slot]) return
      setImageErrors(current => ({
        ...current, [slot]: error instanceof PrizeImageError ? error.code : 'invalid',
      }))
    } finally {
      if (alive.current && version === filesVersion.current[slot]) {
        validatingRef.current.delete(slot)
        setValidating(current => ({ ...current, [slot]: false }))
      }
    }
  }

  const removeImage = (slot: PrizeSlot) => {
    filesVersion.current[slot]++
    validatingRef.current.delete(slot)
    setValidating(current => ({ ...current, [slot]: false }))
    clearPreview(slot)
    setImageErrors(current => ({ ...current, [slot]: undefined }))
    changeDraft(slot, { file: undefined, imageKey: null, imageUrl: null })
  }

  const handleSave = async () => {
    if (savingRef.current || validatingRef.current.size || loading || loadError || refreshWarning) return
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
        const imageKey = draft.file ? await uploadPrizeImage(gameId, slot, draft.file) : draft.imageKey
        const prize: GamePrize = {
          name: draft.name.trim(), limit: draft.limit.trim() === '' ? null : Number(draft.limit),
          imageKey,
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
        if (!prize) continue
        cacheCatalog[slot] = prize.imageUrl?.startsWith('blob:')
          ? { ...prize, imageUrl: null }
          : { ...prize }
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
      try {
        onPersist(patch)
      } catch {
        setCacheWarning(true)
      }
      for (const slot of slotNames) {
        if (previewUrls.current[slot] && display[slot]?.imageUrl !== previewUrls.current[slot]) clearPreview(slot)
      }
    }
    savingRef.current = false
    setSaving(false)
    latest.current.onSavingChange?.(false)
  }

  const noSlots = !slotNames.some(slot => slots[slot])
  const imageErrorText = (code: string) => code === 'type'
    ? t('Selecciona un archivo .png de tipo image/png.', 'Choose a .png file with image/png type.')
    : code === 'size'
      ? t('La imagen PNG debe ocupar como máximo 5 MB.', 'The PNG image must be no larger than 5 MB.')
      : t('El archivo no es una imagen PNG válida o no se puede decodificar.', 'The file is not a valid PNG image or cannot be decoded.')

  return (
    <div className="space-y-4">
      {noSlots && <p>{t('No hay premios configurables para este juego con tu plan actual.', 'No prizes can be configured for this game on your current plan.')}</p>}
      {loading && <p role="status">{t('Cargando premios...', 'Loading prizes...')}</p>}
      {loadError && <div role="alert">
        <p>{t('No se pudieron cargar los premios. Reintenta antes de guardar.', 'Prizes could not be loaded. Retry before saving.')}</p>
        <button type="button" onClick={() => setLoadAttempt(value => value + 1)}>{t('Reintentar', 'Retry')}</button>
      </div>}
      <fieldset disabled={loading || loadError || saving} className="space-y-3 min-w-0">
        {slotNames.filter(slot => slots[slot]).map(slot => {
          const draft = drafts[slot]
          const title = slot === 'validation' ? t('Validación / participación', 'Validation / participation')
            : slot === 'ranking' ? t('Ranking', 'Ranking') : t('Sorteo', 'Raffle')
          const id = `op-prize-${slot}`
          return (
            <section key={slot} aria-labelledby={`${id}-title`} className="space-y-2 border-b border-white/10 pb-3">
              <h3 id={`${id}-title`} className="text-sm font-medium text-gray-300">{title}</h3>
              <div className={`grid grid-cols-1 gap-2 items-start ${slot === 'ranking' ? 'sm:grid-cols-[minmax(0,1fr)_12rem_4rem_5rem]' : 'sm:grid-cols-[minmax(0,1fr)_12rem_5rem]'}`}>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor={`${id}-name`}>{t('Premio', 'Prize')}</label>
                  <input id={`${id}-name`} className={inputClass} value={draft.name} placeholder={t('🎁 Nombre del premio', '🎁 Prize name')}
                    onChange={event => changeDraft(slot, { name: event.target.value })} />
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor={`${id}-image`}>{t('Imagen PNG', 'PNG image')}</label>
                  <div className="flex h-11 items-center gap-2">
                    {draft.imageUrl && <img src={draft.imageUrl} alt={t('Vista previa del premio', 'Prize preview')} className="h-11 w-11 shrink-0 rounded-lg object-contain" />}
                    <div className="relative flex h-11 min-w-0 flex-1 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 px-2 text-xs hover:bg-primary/20 focus-within:ring-2 focus-within:ring-primary">
                      <span aria-hidden="true">{draft.imageUrl || draft.imageKey || draft.file ? t('Cambiar', 'Replace') : t('Elegir PNG', 'Choose PNG')}</span>
                      <input id={`${id}-image`} type="file" accept=".png,image/png"
                        aria-label={`${title}: ${t('Imagen PNG', 'PNG image')}`}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-describedby={`${id}-image-help${imageErrors[slot] ? ` ${id}-image-error` : ''}`}
                        aria-invalid={!!imageErrors[slot]}
                        onChange={event => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          if (file) void chooseImage(slot, file)
                        }} />
                    </div>
                    {(draft.imageUrl || draft.imageKey || draft.file || validating[slot]) && (
                      <button type="button" className="h-11 w-8 shrink-0 rounded-lg border border-red-500/30 text-red-400 text-lg hover:bg-red-500/20"
                        aria-label={t('Quitar imagen', 'Remove image')} title={t('Quitar imagen', 'Remove image')}
                        onClick={() => removeImage(slot)}><span aria-hidden="true">&times;</span></button>
                    )}
                  </div>
                  <p id={`${id}-image-help`} className="mt-1 text-xs text-gray-400">{t('PNG, máx. 5 MB.', 'PNG, max. 5 MB.')}</p>
                  {validating[slot] && <p role="status">{t('Comprobando PNG...', 'Checking PNG...')}</p>}
                  {imageErrors[slot] && <p id={`${id}-image-error`} role="alert" className="text-xs text-red-300">{imageErrorText(imageErrors[slot]!)}</p>}
                </div>
                {slot === 'ranking' && <div className="min-w-0">
                  <label className={labelClass} htmlFor={`${id}-topx`}>Top X</label>
                  <input id={`${id}-topx`} className={inputClass} inputMode="numeric" value={draft.topX}
                    aria-invalid={!!numberErrors[slot]} aria-describedby={numberErrors[slot] ? `${id}-number-error` : undefined}
                    onChange={event => changeDraft(slot, { topX: event.target.value })} />
                </div>}
                <div className="min-w-0">
                  <label className={labelClass} htmlFor={`${id}-limit`}>{t('Límite', 'Limit')}</label>
                  <input id={`${id}-limit`} className={inputClass} inputMode="numeric" placeholder="∞" value={draft.limit}
                    aria-invalid={!!numberErrors[slot]} aria-describedby={numberErrors[slot] ? `${id}-number-error` : undefined}
                    onChange={event => changeDraft(slot, { limit: event.target.value })} />
                </div>
              </div>
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
      <button type="button" onClick={() => void handleSave()} disabled={loading || loadError || saving || refreshWarning || Object.values(validating).some(Boolean) || noSlots}
        className="w-full p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 disabled:opacity-50 disabled:cursor-not-allowed">
        {saving ? t('Guardando...', 'Saving...') : t('Guardar', 'Save')}
      </button>
    </div>
  )
}
