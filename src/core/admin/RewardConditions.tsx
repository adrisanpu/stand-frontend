import { useEffect, useRef, useState } from 'react'
import { getOperatorGameConfiguration, saveRankingCondition, type OperatorGameConfiguration } from '../../api/operatorGames'
import { stackPrizeApi, type StackPrizeSettingsResponse, type StackPrizeRule } from '../../api/stackPrizes'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import StackRuleEditor, { invalidStackRules } from '../settings/StackRuleEditor'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import SaveButton from '../ui/SaveButton'
import IconButton from '../ui/IconButton'

type Props = {
  data: OperatorGameConfiguration
  readOnly: boolean
  onBusyChange: (busy: boolean) => void
  onDirtyChange: (dirty: boolean) => void
}

export default function RewardConditions(props: Props) {
  return props.data.game.gameType === 'STACK' ? <StackConditions {...props} /> : <NativeConditions {...props} />
}

function StackConditions({ data, readOnly, onBusyChange, onDirtyChange }: Props) {
  const { t } = useOperatorLanguage()
  const { plan, loading: planLoading, error: planError } = useCurrentUser()
  const [snapshot, setSnapshot] = useState<StackPrizeSettingsResponse | null>(null)
  const [rules, setRules] = useState<StackPrizeRule[]>([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [reload, setReload] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  useEffect(() => {
    let cancelled = false
    setSnapshot(null)
    setError('')
    void stackPrizeApi.get(data.game.gameId).then(result => {
      if (cancelled) return
      if (!result.ok || result.program?.version !== 3 || !result.programRevision)
        throw new Error('Invalid reward conditions response')
      setSnapshot(result)
      setRules(result.program.rules)
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
      const result = await stackPrizeApi.saveRules(data.game.gameId, rules, snapshot.programRevision)
      setSnapshot({ ...snapshot, program: result.program, programRevision: result.programRevision })
      setRules(result.program.rules)
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
  return <div className="space-y-2">
    {planError && <p role="alert">{t('No se pudo consultar el plan. Cierra y vuelve a abrir el panel antes de editar condiciones.',
      'Could not load your plan. Close and reopen the panel before editing conditions.')}</p>}
    {error && <div role="alert" className="space-y-2"><p>{error}</p>
      <IconButton icon="reload" label={t('Recargar condiciones', 'Reload conditions')} disabled={busy} onClick={() => {
        if (dirty && !window.confirm(t('Se descartarán los cambios de condiciones sin guardar.', 'Unsaved condition changes will be discarded.'))) return
        setDirty(false)
        onDirtyChange(false)
        setSaved(false)
        setReload(value => value + 1)
      }} />
    </div>}
    {!snapshot && !error && <p role="status">{t('Cargando condiciones…', 'Loading conditions…')}</p>}
    {snapshot && <>
      {!snapshot.program.catalog.length && <p>{t(
        'No hay premios configurados en esta partida. El catálogo se gestiona desde Administración > Premios. Aquí solo se seleccionan premios existentes.',
        'This event has no configured prizes. Manage its catalog from Administration > Prizes. Only existing prizes can be selected here.',
      )}</p>}
      <fieldset disabled={readOnly || busy || !!error || !!planError || planLoading || snapshot.state !== 'open'}
        className="min-w-0">
        <StackRuleEditor rules={rules} catalog={snapshot.program.catalog} raffles={getFeaturesByPlan(plan).raffles}
          onChange={next => { setRules(next); setDirty(true); onDirtyChange(true); setSaved(false) }} />
      </fieldset>
      {dirty && invalidStackRules(rules) && <p role="alert">{t(
        'Revisa las reglas: cada grupo necesita premios, cantidades entre 1 y 10, top entre 1 y 100 y puntuaciones enteras no negativas con un rango válido.',
        'Check the rules: each group needs prizes, quantities from 1 to 10, top from 1 to 100 and non-negative integer scores with a valid range.',
      )}</p>}
      {saved && <p role="status" className="text-sm text-textSub">{t('Condiciones guardadas. Se conservan los premios ya adjudicados.', 'Conditions saved. Previously awarded prizes are preserved.')}</p>}
      {!readOnly && <div className="flex justify-end">
        <SaveButton iconOnly
          disabled={busy || !!error || !!planError || planLoading || !dirty || invalidStackRules(rules) || snapshot.state !== 'open'}
          onClick={() => void save()}>{t('Guardar condiciones', 'Save conditions')}</SaveButton>
      </div>}
    </>}
  </div>
}

function NativeConditions({ data, readOnly, onBusyChange, onDirtyChange }: Props) {
  const { t } = useOperatorLanguage()
  const [top, setTop] = useState(data.prizeCatalog?.ranking?.topX ?? 3)
  const [revision, setRevision] = useState(data.rewardConditionsRevision)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const catalog = data.prizeCatalog ?? {}
  const save = async () => {
    if (saving.current || readOnly) return
    saving.current = true
    setBusy(true)
    onBusyChange(true)
    try {
      setRevision(await saveRankingCondition(data.game.gameId, top, revision))
      setDirty(false)
      onDirtyChange(false)
      setSaved(true)
    } catch {
      setError(t('No se pudo confirmar el guardado. Cierra y vuelve a abrir la configuración para recargar antes de reintentar.',
        'Could not confirm saving. Close and reopen settings to reload before retrying.'))
    } finally {
      saving.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
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
    {data.game.gameType === 'T1MER' && catalog.ranking && <>
      <label className="flex max-w-sm items-center justify-between gap-3 rounded-xl border border-white/10 p-3 text-sm">
        <span>{t('Puestos premiados (top)', 'Rewarded positions (top)')}</span>
        <input type="number" min={1} max={100} disabled={readOnly || busy || !!error}
          className="h-9 w-20 rounded-xl border border-white/10 bg-white/5 px-2.5"
          value={Number.isFinite(top) ? top : ''} onChange={event => {
            setTop(event.target.valueAsNumber); setDirty(true); onDirtyChange(true); setSaved(false)
          }} />
      </label>
      {dirty && (!Number.isInteger(top) || top < 1 || top > 100) && <p role="alert">{t(
        'Los puestos premiados deben ser un número entero entre 1 y 100.',
        'Rewarded positions must be a whole number from 1 to 100.',
      )}</p>}
    </>}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status" className="text-sm text-textSub">{t('Condiciones guardadas.', 'Conditions saved.')}</p>}
    {data.game.gameType === 'T1MER' && catalog.ranking && !readOnly && <div className="flex justify-end">
      <SaveButton iconOnly disabled={busy || !!error || !dirty || !Number.isInteger(top) || top < 1 || top > 100}
        onClick={() => void save()}>{t('Guardar condiciones', 'Save conditions')}</SaveButton>
    </div>}
  </div>
}
