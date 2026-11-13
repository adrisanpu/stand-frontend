import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getOperatorGameConfiguration, type OperatorGameConfiguration } from '../../api/operatorGames'
import { stackPrizeApi, type StackPrizeItem, type StackPrizeSettingsResponse, type StackPrizeRule } from '../../api/stackPrizes'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import StackRuleEditor, { invalidStackRules } from '../settings/StackRuleEditor'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import SaveButton from '../ui/SaveButton'
import IconButton from '../ui/IconButton'
import { fetchSharedPrizeCatalog } from '../../api/sharedPrizeCatalog'
import { kivlyApi } from '../../api/kivlyApi'
import { LegacyPrizeSettings } from '../settings/OperatorPrizeSettings'
import { getGameById } from '../../games'

type Props = {
  data: OperatorGameConfiguration
  readOnly: boolean
  headerAside?: ReactNode
  onBusyChange: (busy: boolean) => void
  onDirtyChange: (dirty: boolean) => void
  onReadyChange?: (ready: boolean) => void
}

export default function RewardConditions(props: Props) {
  return props.data.game.gameType === 'STACK' ? <StackConditions {...props} /> : <NativeConditions {...props} />
}

const stockDrafts = (catalog: StackPrizeItem[]) =>
  Object.fromEntries(catalog.map(item => [item.id, item.stockTotal === null ? '' : String(item.stockTotal)]))
const validCount = (value: string) => /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value.trim()))

function StackConditions({ data, readOnly, headerAside, onBusyChange, onDirtyChange, onReadyChange }: Props) {
  const { t } = useOperatorLanguage()
  const { plan, loading: planLoading, error: planError } = useCurrentUser()
  const [snapshot, setSnapshot] = useState<StackPrizeSettingsResponse | null>(null)
  const [rules, setRules] = useState<StackPrizeRule[]>([])
  const [stock, setStock] = useState<Record<string, string>>({})
  const [available, setAvailable] = useState<StackPrizeItem[]>([])
  const [catalog, setCatalog] = useState<StackPrizeItem[]>([])
  const [rulesDirty, setRulesDirty] = useState(false)
  const [error, setError] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const [saved, setSaved] = useState(false)
  const [reload, setReload] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  useEffect(() => {
    let cancelled = false
    setSnapshot(null)
    setError('')
    setSelectionError('')
    void Promise.all([
      stackPrizeApi.get(data.game.gameId), fetchSharedPrizeCatalog(),
      kivlyApi.getAccountConnection().then(async connection => {
        if (connection.connected && !connection.locationId) throw new Error('Missing Kivly location')
        return {
          locationId: connection.locationId,
          rewards: connection.connected ? await kivlyApi.listRewards(data.game.gameId) : [],
        }
      }),
    ]).then(([result, shared, kivly]) => {
      if (cancelled) return
      if (!result.ok || result.program?.version !== 3 || !result.programRevision)
        throw new Error('Invalid reward conditions response')
      setSnapshot(result)
      const choices: StackPrizeItem[] = [
        ...result.program.catalog,
        ...shared.catalog.filter(prize => !result.program.catalog.some(item => item.sharedPrizeId === prize.id))
          .map((prize): StackPrizeItem => ({
            id: `shared_${prize.id}`, source: 'stand', sharedPrizeId: prize.id, name: prize.name,
            imageKey: prize.imageKey, imageUrl: prize.imageUrl, stockTotal: null,
          })),
        ...kivly.rewards.filter(reward => !result.program.catalog.some(item =>
          item.source === 'kivly' && item.rewardId === reward.id && item.locationId === kivly.locationId))
          .map((reward): StackPrizeItem => ({
            id: `kivly_${reward.id}`, source: 'kivly', rewardId: reward.id,
            locationId: kivly.locationId ?? '', name: reward.name, imageUrl: reward.imageUrl, stockTotal: null,
          })),
      ]
      setAvailable(choices)
      setCatalog(result.program.catalog)
      setRules(result.program.rules)
      setStock(stockDrafts(result.program.catalog))
    }).catch(() => {
      if (!cancelled) setError(t('No se pudieron cargar las condiciones.', 'Could not load conditions.'))
    })
    return () => { cancelled = true }
    // Language changes must not discard unsaved conditions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.game.gameId, reload])
  const save = async () => {
    if (saving.current || !snapshot?.programRevision || readOnly) return
    saving.current = true
    setBusy(true)
    onBusyChange(true)
    setError('')
    setSaved(false)
    try {
      const current = await getOperatorGameConfiguration(data.game.gameId)
      if (current.game.isActive !== true || current.game.lifecycleState !== 'active') throw new Error('GameInactive')
      let next = snapshot
      const catalogChanged = catalog.length !== snapshot.program.catalog.length || changedStock.length > 0
      if (catalogChanged) {
        await stackPrizeApi.save(data.game.gameId, { ...next.program, catalog: catalog.map(item =>
          changedStock.includes(item.id) ? { ...item, stockTotal: stock[item.id].trim() === '' ? null : Number(stock[item.id]) } : item) })
        next = await stackPrizeApi.get(data.game.gameId)
        if (!next.ok || next.program?.version !== 3 || !next.programRevision)
          throw new Error('Invalid reward conditions response')
        if (catalog.some(prize => !next.program.catalog.some(item => item.id === prize.id
          && item.source === prize.source && item.sharedPrizeId === prize.sharedPrizeId
          && item.rewardId === prize.rewardId && item.locationId === prize.locationId
          && item.stockTotal === (changedStock.includes(prize.id)
            ? stock[prize.id].trim() === '' ? null : Number(stock[prize.id]) : prize.stockTotal))))
          throw new Error('Prize associations not confirmed')
      }
      if (rulesDirty) {
        const result = await stackPrizeApi.saveRules(data.game.gameId, rules, next.programRevision ?? snapshot.programRevision)
        next = { ...next, program: result.program, programRevision: result.programRevision }
      }
      setSnapshot(next)
      setCatalog(next.program.catalog)
      setRules(next.program.rules)
      setStock(stockDrafts(next.program.catalog))
      setRulesDirty(false)
      setDirty(false)
      onDirtyChange(false)
      setSaved(true)
    } catch {
      setError(t('No se pudo confirmar el guardado. Recarga las condiciones antes de reintentar; puede haber cambios o la partida ya no está activa.',
        'Could not confirm saving. Reload conditions before retrying; settings may have changed or the event is no longer active.'))
    } finally {
      saving.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
  const savedStock = snapshot ? stockDrafts(snapshot.program.catalog) : {}
  const changedStock = Object.keys(stock).filter(id => stock[id] !== savedStock[id])
  const invalidStock = changedStock.some(id => stock[id].trim() !== '' && !validCount(stock[id]))
  const markDirty = () => { setDirty(true); onDirtyChange(true); setSaved(false) }
  const readyCallback = useRef(onReadyChange)
  readyCallback.current = onReadyChange
  useEffect(() => {
    readyCallback.current?.(!!snapshot && !busy && !error && !planError && !planLoading
      && !dirty && !selectionError && !invalidStock && !invalidStackRules(rules))
  }, [snapshot, busy, error, planError, planLoading, dirty, selectionError, invalidStock, rules])
  return <div className="space-y-2">
    {planError && <p role="alert">{t('No se pudo consultar el plan. Cierra y vuelve a abrir el panel antes de editar condiciones.',
      'Could not load your plan. Close and reopen the panel before editing conditions.')}</p>}
    {error && <div role="alert" className="space-y-2"><p>{error}</p>
      <div className="flex justify-end"><IconButton icon="reload" label={t('Recargar condiciones', 'Reload conditions')} disabled={busy} onClick={() => {
        if (dirty && !window.confirm(t('Se descartarán los cambios de condiciones sin guardar.', 'Unsaved condition changes will be discarded.'))) return
        setDirty(false)
        setRulesDirty(false)
        onDirtyChange(false)
        setSaved(false)
        setReload(value => value + 1)
      }} /></div>
    </div>}
    {!snapshot && !error && <p role="status">{t('Cargando condiciones…', 'Loading conditions…')}</p>}
    {snapshot && <>
      {!available.length && <p>{t(
        'No hay premios en el catálogo. Crea premios en Administración > Premios para seleccionarlos aquí.',
        'The catalog has no prizes. Create prizes in Administration > Prizes to select them here.',
      )}</p>}
      <fieldset disabled={readOnly || busy || !!error || !!planError || planLoading || snapshot.state !== 'open'}
        className="min-w-0">
        <StackRuleEditor rules={rules} catalog={catalog} available={available} raffles={getFeaturesByPlan(plan).raffles}
          headerAside={headerAside}
          onAddPrize={(ruleIndex, groupIndex, prizeId) => {
            const prize = available.find(item => item.id === prizeId)
            if (!prize) return
            if (!catalog.some(item => item.id === prizeId)) {
              if (catalog.length >= 32) {
                setSelectionError(t('La partida admite como máximo 32 premios.', 'The event supports at most 32 prizes.'))
                return
              }
              setCatalog(current => [...current, prize])
              setStock(current => ({ ...current, [prizeId]: '' }))
            }
            setRules(current => current.map((rule, index) => index === ruleIndex ? {
              ...rule, id: crypto.randomUUID(), groups: rule.groups.map((group, index) => index === groupIndex
                ? { allocations: [...group.allocations, { prizeId, quantity: 1 }] } : group),
            } : rule))
            setRulesDirty(true)
            markDirty()
          }}
          stock={stock} onStockChange={(id, value) => { setStock(current => ({ ...current, [id]: value })); markDirty() }}
          onChange={next => { setRules(next); setRulesDirty(true); markDirty() }} />
      </fieldset>
      {selectionError && <p role="alert">{selectionError}</p>}
      <p className="text-xs text-textSub">{t(
        'Al quitar un premio de todas las condiciones y guardar, se libera su substock no repartido. Se conservan los premios ya adjudicados.',
        'Removing a prize from every condition and saving releases its unassigned sub-stock. Previously awarded prizes are preserved.',
      )}</p>
      {catalog.some(prize => prize.stockTotal === null && rules.some(rule => rule.groups.some(group =>
        group.allocations.some(allocation => allocation.prizeId === prize.id)))) && <p className="text-sm text-textSub">{t(
        'Define el substock de los premios seleccionados: cada cantidad reserva unidades exclusivas para esta partida. Vacío no reserva unidades.',
        'Set the sub-stock for selected prizes: each quantity reserves exclusive units for this event. Blank reserves no units.',
      )}</p>}
      {dirty && invalidStackRules(rules) && <p role="alert">{t(
        'Revisa las reglas: cada grupo necesita premios, cantidades entre 1 y 10, top entre 1 y 100 y puntuaciones enteras no negativas con un rango válido.',
        'Check the rules: each group needs prizes, quantities from 1 to 10, top from 1 to 100 and non-negative integer scores with a valid range.',
      )}</p>}
      {dirty && invalidStock && <p role="alert">{t('El substock debe ser un número entero mayor o igual que 0.',
        'Sub-stock must be a whole number greater than or equal to 0.')}</p>}
      {saved && <p role="status" className="text-sm text-textSub">{t('Condiciones guardadas. Se conservan los premios ya adjudicados.', 'Conditions saved. Previously awarded prizes are preserved.')}</p>}
      {!readOnly && <div className="flex justify-end">
        <SaveButton iconOnly
          disabled={busy || !!error || !!planError || planLoading || !dirty || invalidStackRules(rules) || invalidStock || snapshot.state !== 'open'}
          onClick={() => void save()}>{t('Guardar condiciones', 'Save conditions')}</SaveButton>
      </div>}
    </>}
  </div>
}

function NativeConditions({ data, readOnly, headerAside, onBusyChange, onDirtyChange, onReadyChange }: Props) {
  const { t } = useOperatorLanguage()
  const catalog = data.prizeCatalog ?? {}
  const { plan } = useCurrentUser()
  const definition = getGameById(data.game.gameType)
  if (definition) return <LegacyPrizeSettings gameId={data.game.gameId} gameDefinition={definition}
    settings={data.configuration} plan={plan} editConditions readOnly={readOnly} conditionsHeaderAside={headerAside}
    onPersist={() => undefined} onSavingChange={onBusyChange} onDirtyChange={onDirtyChange} onReadyChange={onReadyChange} />
  return <div className="space-y-2">
    <p className="text-sm text-textSub">{t(
      'Cada mecánica conserva sus condiciones actuales. El catálogo de premios se gestiona en Administración > Premios; los sorteos siguen siendo manuales.',
      'Each game keeps its existing conditions. Manage the prize catalog in Administration > Prizes; raffles remain manual.',
    )}</p>
    {!!Object.keys(catalog).length && <ul className="grid gap-1.5 sm:grid-cols-2" aria-label={t('Premios configurados', 'Configured prizes')}>
      {Object.entries(catalog).map(([slot, prize]) => prize && <li key={slot}
        className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 p-3 text-sm">
        <span className="shrink-0 text-xs text-textSub">
          {slot === 'ranking' ? t('Ranking', 'Ranking') : slot === 'validation' ? t('Validación', 'Validation') : t('Sorteo', 'Raffle')}
        </span>
        <span className="min-w-0 truncate font-medium" title={prize.name}>{prize.name}</span>
      </li>)}
    </ul>}
    {!Object.keys(catalog).length && <p>{t('Esta partida no tiene recompensas configuradas.', 'This event has no configured rewards.')}</p>}
  </div>
}
