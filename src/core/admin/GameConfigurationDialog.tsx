import IconButton from '../ui/IconButton'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { getOperatorGameConfiguration, type OperatorGameConfiguration } from '../../api/operatorGames'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getGameById } from '../../games'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import Raffle from '../widgets/Raffle'
import type { GameConfigSaveRegistration } from '../types'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import RewardConditions from './RewardConditions'
import SaveButton from '../ui/SaveButton'

export default function GameConfigurationDialog({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const { language, t } = useOperatorLanguage()
  const { plan } = useCurrentUser()
  const [data, setData] = useState<OperatorGameConfiguration | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [mechanicsDirty, setMechanicsDirty] = useState(false)
  const [conditionsDirty, setConditionsDirty] = useState(false)
  const [section, setSection] = useState<'configuration' | 'conditions' | 'prizes'>('configuration')
  const [showRaffle, setShowRaffle] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [saveUncertain, setSaveUncertain] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const rules = useRef<GameConfigSaveRegistration | null>(null)
  const savedPatch = useRef<Record<string, unknown> | null>(null)
  const readSavedPatch = () => savedPatch.current
  const discardDialog = useRef<HTMLDivElement>(null)
  const registerSave = useCallback((value: GameConfigSaveRegistration | null) => { rules.current = value }, [])
  const changeBusy = useCallback((value: boolean) => { busyRef.current = value; setBusy(value) }, [])
  useEffect(() => {
    if (discard) discardDialog.current?.querySelector('button')?.focus()
  }, [discard])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (busyRef.current || mechanicsDirty || conditionsDirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [mechanicsDirty, conditionsDirty])
  useEffect(() => {
    const previousFocus = document.activeElement
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const overlay = dialog.current?.parentElement
    const siblings = Array.from(document.body.children).filter(element => element !== overlay && !element.hasAttribute('inert'))
    siblings.forEach(element => element.setAttribute('inert', ''))
    dialog.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      siblings.forEach(element => element.removeAttribute('inert'))
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [])
  useEffect(() => {
    let cancelled = false
    setData(null)
    setLoadError(false)
    void getOperatorGameConfiguration(gameId).then(result => {
      if (!cancelled) setData(result)
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [gameId, reload])
  const close = () => {
    if (busyRef.current) return
    if (mechanicsDirty || conditionsDirty) setDiscard(true)
    else onClose()
  }
  const definition = data ? getGameById(data.game.gameType) : undefined
  // T1MER's old component only edits registration, not game mechanics.
  const Component = definition?.id === 'T1MER' ? undefined : definition?.GameConfigComponent
  const readOnly = data?.game.isActive !== true || data.game.lifecycleState !== 'active'
  const settings = useMemo(() => {
    if (!data) return {}
    const typed = data.game.type?.[data.game.gameType]
    return {
      ...data.configuration, ...(typeof typed === 'object' && typed !== null && !Array.isArray(typed) ? typed : {}),
      ...(data.game.gameType === 'IMPOSTOR' && data.game.maxPlayers != null ? { maxPlayers: data.game.maxPlayers } : {}),
      ...(data.game.gameType === 'EMPAREJA2' ? { catalogPairCount: data.empareja2CatalogPairCount } : {}),
    }
  }, [data])
  const save = async () => {
    if (!rules.current || busyRef.current || readOnly) return
    const invalid = rules.current.validate?.()
    if (invalid) { setMessage(invalid); setSaveError(true); return }
    changeBusy(true)
    setMessage('')
    try {
      const current = await getOperatorGameConfiguration(gameId)
      if (!current.game.isActive || current.game.lifecycleState !== 'active') throw new Error('GameInactive')
      savedPatch.current = null
      await rules.current.save()
      const confirmed = await getOperatorGameConfiguration(gameId)
      const patch = readSavedPatch()
      if (!patch || Object.entries(patch).some(([key, value]) =>
        (data?.game.gameType !== 'INFOCARDS' || key === 'cardLayouts') &&
        !['refreshGameScreen', 'processed', 'cardsCount', 'close'].includes(key)
        && JSON.stringify(confirmed.configuration[key]) !== JSON.stringify(value))) {
        throw new Error('Configuration update not confirmed')
      }
      setMechanicsDirty(false)
      setSaveError(false)
      setMessage(t('Configuración guardada.', 'Settings saved.'))
    } catch {
      setSaveUncertain(true)
      setSaveError(true)
      setMessage(t('No se pudo confirmar el guardado. Cierra y vuelve a abrir el panel para recargar antes de reintentar.',
        'Could not confirm saving. Close and reopen the panel to reload before retrying.'))
    } finally { changeBusy(false) }
  }
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div ref={dialog} lang={language} role="dialog" aria-modal="true" aria-labelledby="event-config-title" tabIndex={-1}
      className="flex max-h-[92dvh] w-full max-w-4xl flex-col rounded-2xl border border-current/20 bg-[var(--color-background)] text-textMain shadow-xl"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); close() }
        if (event.key !== 'Tab') return
        const controls = Array.from((discard ? discardDialog.current : dialog.current)?.querySelectorAll<HTMLElement>(
          'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? []).filter(element => !element.closest('fieldset:disabled') && !element.closest('[hidden]')
          && !element.closest('details:not([open])'))
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
          event.preventDefault(); first?.focus()
        }
      }}>
      <header className="flex items-center justify-between gap-3 border-b border-current/15 px-5 py-3">
        <h2 id="event-config-title" className="text-xl font-semibold">{data ? data.game.gameName : t('Cargando configuración…', 'Loading settings…')}</h2>
        <IconButton icon="remove" label={t('Cerrar configuración', 'Close settings')} type="button" disabled={busy} onClick={close} />
      </header>
      <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
        {!data && !loadError && <p role="status">{t('Cargando configuración…', 'Loading settings…')}</p>}
        {loadError && <div role="alert"><p>{t('No se pudo cargar esta partida. Comprueba tu sesión y el backend.', 'Could not load this event. Check your session and backend.')}</p>
          <button type="button" className="mt-3 underline" onClick={() => setReload(value => value + 1)}>{t('Reintentar', 'Retry')}</button>
        </div>}
        {data && <>
          {readOnly && <p role="status">{t('Solo lectura: esta partida está inactiva o en proceso de cierre.', 'Read only: this event is inactive or closing.')}</p>}
          <nav role="tablist" aria-label={t('Secciones de configuración', 'Settings sections')}
            className="flex gap-1 overflow-x-auto border-b border-current/15">
            {([
              ['configuration', t('Configuración', 'Configuration')],
              ['conditions', t('Condiciones', 'Conditions')],
              ['prizes', t('Premios y sorteo', 'Prizes and raffle')],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`event-tab-${id}`}
                aria-selected={section === id} aria-controls={`event-panel-${id}`}
                tabIndex={section === id ? 0 : -1}
                onClick={() => setSection(id)}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
                  section === id ? 'border-primary text-textMain' : 'border-transparent text-textSub hover:text-textMain'
                }`}>
                {label}
              </button>
            ))}
          </nav>
          <section role="tabpanel" id="event-panel-configuration" aria-labelledby="event-tab-configuration"
            hidden={section !== 'configuration'} tabIndex={0} className="space-y-3 py-2">
            {Component ? <>
              <fieldset disabled={readOnly || busy || saveUncertain} onChangeCapture={() => { setMechanicsDirty(true); setMessage('') }}
                onClickCapture={event => { if ((event.target as HTMLElement).closest('button')) { setMechanicsDirty(true); setMessage('') } }}>
                <Component gameId={gameId} gameName={data.game.gameName} settings={settings} settingsLoaded
                  readOnly={readOnly} onBusyChange={changeBusy} onDirtyChange={setMechanicsDirty} onChange={(patch: unknown) => {
                    if (typeof patch === 'object' && patch !== null) savedPatch.current = { ...patch }
                  }} registerSave={registerSave} />
              </fieldset>
            </> : <p>{t('Este juego no tiene ajustes de mecánica editables.', 'This game has no editable mechanic settings.')}</p>}
            {message && <p role={saveError ? 'alert' : 'status'}>{message}</p>}
            {Component && !readOnly && <div className="flex justify-end">
              <SaveButton iconOnly disabled={busy || saveUncertain || !mechanicsDirty}
                onClick={() => void save()}>
                {t('Guardar configuración', 'Save configuration')}
              </SaveButton>
            </div>}
          </section>
          <section role="tabpanel" id="event-panel-conditions" aria-labelledby="event-tab-conditions"
            hidden={section !== 'conditions'} tabIndex={0} className="space-y-3 py-2">
            <fieldset disabled={busy}>
              <RewardConditions data={data} readOnly={readOnly} onBusyChange={changeBusy} onDirtyChange={setConditionsDirty} />
            </fieldset>
          </section>
          <section role="tabpanel" id="event-panel-prizes" aria-labelledby="event-tab-prizes"
            hidden={section !== 'prizes'} tabIndex={0} className="space-y-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-current/15 p-3">
              <p className="min-w-0 flex-1 text-sm text-textSub">{t(
                'El catálogo de premios se configura en su panel de Administración. Aquí puedes gestionar el sorteo manual de esta partida.',
                'Configure the prize catalog in its Administration panel. Manage this event’s manual raffle here.',
              )}</p>
              <Link to="/admin/prizes"
                onClick={event => {
                  if (busyRef.current) {
                    event.preventDefault()
                    return
                  }
                  if ((mechanicsDirty || conditionsDirty) && !window.confirm(t(
                    'Hay cambios sin guardar. ¿Descartarlos y abrir el catálogo de premios?',
                    'There are unsaved changes. Discard them and open the prize catalog?',
                  ))) event.preventDefault()
                }}
                className="inline-flex shrink-0 rounded-xl border border-current/20 px-3 py-2 text-sm font-medium">
                {t('Abrir catálogo de premios', 'Open prize catalog')}
              </Link>
            </div>
            <h3 className="text-base font-semibold">{t('Sorteo manual', 'Manual raffle')}</h3>
            {readOnly
              ? <p>{t('Los sorteos solo están disponibles en partidas activas.', 'Raffles are only available for active events.')}</p>
              : getFeaturesByPlan(plan).raffles
                ? showRaffle
                  ? <Raffle embedded onBack={() => setShowRaffle(false)} onClose={() => setShowRaffle(false)}
                      gameId={gameId} gameType={definition?.id} />
                  : <button type="button" className="rounded-xl border border-current/20 px-4 py-3"
                      onClick={() => setShowRaffle(true)}>
                    {t('Abrir controles del sorteo', 'Open raffle controls')}
                  </button>
                : <p>{t('Disponible en el plan Event 24h.', 'Available on the Event 24h plan.')}</p>}
          </section>
        </>}
        {busy && <p role="status">{t('Guardando…', 'Saving…')}</p>}
        {discard && <div ref={discardDialog} role="alertdialog" aria-label={t('Descartar cambios', 'Discard changes')} className="space-y-3 rounded-xl border border-current/20 p-4">
          <p>{t('Hay cambios sin guardar. ¿Quieres descartarlos y cerrar?', 'There are unsaved changes. Discard them and close?')}</p>
          <button type="button" className="mr-4 underline" onClick={onClose}>{t('Descartar y cerrar', 'Discard and close')}</button>
          <button type="button" className="underline" onClick={() => setDiscard(false)}>{t('Seguir editando', 'Keep editing')}</button>
        </div>}
      </div>
    </div>
  </div>, document.body)
}
