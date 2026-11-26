import IconButton from '../ui/IconButton'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  getOperatorGameConfiguration, updateSetupReview, finishSetupReview, SETUP_REVIEW_SECTIONS,
  type OperatorGameConfiguration, type SetupReviewProgress, type SetupReviewSection,
} from '../../api/operatorGames'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getGameById } from '../../games'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import Raffle from '../widgets/Raffle'
import type { GameConfigSaveRegistration } from '../types'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import RewardConditions from './RewardConditions'
import PrizeNotificationSettings from './PrizeNotificationSettings'
import SaveButton from '../ui/SaveButton'
import GameGate from '../shell/GameGate'
import GameFormSettings from './GameFormSettings'
import { inputManager } from '../input/inputManager'
import GamePlayPreview from './GamePlayPreview'
import type { ParticipantPhoneFrame } from '../participant/ParticipantPhonePreview'
import QRCode from '../widgets/QRCode'
import { getRedeemUrl } from '../lib/joinUrl'
import { ConfigurationActionsContext } from '../ui/ConfigurationActions'

export default function GameConfigurationDialog({ gameId: existingId, gameType, onClose, onCreated, requireSetup = false, initialSection = 'appearance' }: {
  gameId?: string; gameType?: string; onClose: (created?: boolean) => void
  onCreated?: (gameId: string) => void
  requireSetup?: boolean
  initialSection?: 'configuration' | 'appearance' | 'form' | 'questionnaire'
}) {
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [progress, setProgress] = useState<SetupReviewProgress | undefined>()
  const progressRef = useRef(progress)
  progressRef.current = progress
  const [setupError, setSetupError] = useState('')
  const [setupNotice, setSetupNotice] = useState('')
  const [ready, setReady] = useState<Partial<Record<SetupReviewSection, boolean>>>({})
  const invalidations = useRef(new Set<SetupReviewSection>())
  const [reviewVersion, setReviewVersion] = useState(0)
  const gameId = existingId ?? createdId
  const { language, t } = useOperatorLanguage()
  const { plan } = useCurrentUser()
  const [data, setData] = useState<OperatorGameConfiguration | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const busySources = useRef(new Set<string>())
  const savingMechanics = useRef(false)
  const [mechanicsDirty, setMechanicsDirty] = useState(false)
  const [mechanicsDraft, setMechanicsDraft] = useState<Record<string, unknown> | null>(null)
  const [phoneFrame, setPhoneFrame] = useState<ParticipantPhoneFrame>({})
  const [conditionsDirty, setConditionsDirty] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [section, setSection] = useState<SetupReviewSection>(initialSection)
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null)
  const [formSection, setFormSection] = useState<'appearance' | 'registration' | 'questionnaire'>(
    initialSection === 'questionnaire' ? 'questionnaire' : initialSection === 'form' ? 'registration' : 'appearance')
  const [discard, setDiscard] = useState(false)
  const [message, setMessage] = useState('')
  const [saveError, setSaveError] = useState(false)
  const [saveUncertain, setSaveUncertain] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const rules = useRef<GameConfigSaveRegistration | null>(null)
  const [rulesReady, setRulesReady] = useState(false)
  const savedPatch = useRef<Record<string, unknown> | null>(null)
  const readSavedPatch = () => savedPatch.current
  const discardDialog = useRef<HTMLDivElement>(null)
  const registerSave = useCallback((value: GameConfigSaveRegistration | null) => {
    rules.current = value
    setRulesReady(value !== null)
  }, [])
  const sourceBusy = useCallback((source: string, value: boolean) => {
    if (value) busySources.current.add(source)
    else busySources.current.delete(source)
    busyRef.current = busySources.current.size > 0
    setBusy(busyRef.current)
  }, [])
  const changeBusy = useCallback((value: boolean) => sourceBusy('mechanics', value), [sourceBusy])
  const formBusy = useCallback((value: boolean) => sourceBusy('form', value), [sourceBusy])
  const conditionsBusy = useCallback((value: boolean) => sourceBusy('conditions', value), [sourceBusy])
  const raffleBusy = useCallback((value: boolean) => sourceBusy('raffle', value), [sourceBusy])
  const reviewRequired = !!progress && !progress.completed
  const missingSetup = !!createdId && !!data && !progress
  const awaitingSetup = (!!createdId || requireSetup) && !data
  const invalidateReview = useCallback((id: SetupReviewSection) => {
    const current = progressRef.current
    if (!current || current.completed || !current.confirmedSections.includes(id)) return
    invalidations.current.add(id)
    setReviewVersion(value => value + 1)
  }, [])
  const markMechanicsDirty = useCallback((dirty: boolean) => {
    setMechanicsDirty(dirty)
    if (dirty) invalidateReview('configuration')
  }, [invalidateReview])
  const markConditionsDirty = useCallback((dirty: boolean) => {
    setConditionsDirty(dirty)
    if (dirty) invalidateReview('conditions')
  }, [invalidateReview])
  const formReady = useCallback((id: 'appearance' | 'registration' | 'questionnaire', value: boolean) => {
    const key = id === 'registration' ? 'form' : id
    setReady(current => current[key] === value ? current : { ...current, [key]: value })
  }, [])
  const formSectionDirty = useCallback((id: 'appearance' | 'registration' | 'questionnaire', dirty: boolean) => {
    if (dirty) invalidateReview(id === 'registration' ? 'form' : id)
  }, [invalidateReview])
  const conditionsReady = useCallback((value: boolean) => {
    setReady(current => current.conditions === value ? current : { ...current, conditions: value })
  }, [])
  const raffleReady = useCallback((value: boolean) => {
    setReady(current => current.prizes === value ? current : { ...current, prizes: value })
  }, [])
  useEffect(() => {
    if (!gameId || busy || setupError || !progress || progress.completed || !invalidations.current.size) return
    const pending = [...invalidations.current].filter(id => progress.confirmedSections.includes(id))
    if (!pending.length) { invalidations.current.clear(); return }
    sourceBusy('review', true)
    void (async () => {
      try {
        let current = progress
        for (const id of pending) {
          current = await updateSetupReview(gameId, id, false, current.revision)
          progressRef.current = current
          setProgress(current)
          invalidations.current.delete(id)
        }
      } catch {
        setSetupError(t('No se pudo actualizar la revisión. Recarga el progreso antes de continuar.', 'Could not update the review. Reload progress before continuing.'))
      } finally { sourceBusy('review', false) }
    })()
  }, [gameId, busy, setupError, progress, reviewVersion, sourceBusy, t])
  useEffect(() => {
    if (discard) discardDialog.current?.querySelector('button')?.focus()
  }, [discard])

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (busyRef.current || mechanicsDirty || conditionsDirty || formDirty || reviewRequired || missingSetup || awaitingSetup) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [mechanicsDirty, conditionsDirty, formDirty, reviewRequired, missingSetup, awaitingSetup])
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
    setReady({})
    setLoadError(false)
    if (!gameId) return
    void getOperatorGameConfiguration(gameId).then(result => {
      if (!cancelled) {
        setData(result)
        setProgress(result.game.setupReview)
        if (result.game.setupReview && !result.game.setupReview.completed) {
          const first = SETUP_REVIEW_SECTIONS.find(id => !result.game.setupReview!.confirmedSections.includes(id)) ?? 'prizes'
          setSection(first)
          if (first === 'appearance' || first === 'form' || first === 'questionnaire')
            setFormSection(first === 'form' ? 'registration' : first)
        }
      }
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [gameId, reload])
  const close = () => {
    if (busyRef.current) return
    if (reviewRequired || missingSetup || awaitingSetup) {
      setSetupNotice(t('Revisa y confirma todos los paneles para finalizar la creación.', 'Review and confirm every panel to finish creating the event.'))
      return
    }
    if (mechanicsDirty || conditionsDirty || formDirty) setDiscard(true)
    else onClose(!!createdId)
  }
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => inputManager.registerBackInterceptor(() => {
    closeRef.current()
    return true
  }), [])
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
    if (!gameId || !rules.current || busyRef.current || readOnly) return
    const invalid = rules.current.validate?.()
    if (invalid) { setMessage(invalid); setSaveError(true); return }
    savingMechanics.current = true
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
        !['processed', 'cardsCount', 'close'].includes(key)
        && JSON.stringify(confirmed.configuration[key]) !== JSON.stringify(value))) {
        throw new Error('Configuration update not confirmed')
      }
      setMechanicsDirty(false)
      setSaveError(false)
      setMessage(t('Configuración guardada.', 'Settings saved.'))
    } catch {
      setSaveUncertain(true)
      setSaveError(true)
      setMessage(t('No se pudo confirmar el guardado. Recarga la configuración antes de reintentar.',
        'Could not confirm saving. Reload settings before retrying.'))
    } finally { savingMechanics.current = false; changeBusy(false) }
  }
  const sectionReady = !!data && !loadError && (section === 'configuration'
    ? (!Component || (rulesReady && !mechanicsDirty && !saveUncertain && !rules.current?.validate?.()))
    : section === 'prizes' && !getFeaturesByPlan(plan).raffles ? true
    : ready[section] === true)
  const confirmSection = async () => {
    if (!gameId || !progress || busyRef.current || !sectionReady || readOnly || setupError || invalidations.current.size) return
    sourceBusy('review', true)
    setSetupNotice('')
    try {
      const next = await updateSetupReview(gameId, section, true, progress.revision)
      progressRef.current = next
      setProgress(next)
      const following = SETUP_REVIEW_SECTIONS.find(id => !next.confirmedSections.includes(id))
      if (following) {
        setSection(following)
        if (following === 'appearance' || following === 'form' || following === 'questionnaire')
          setFormSection(following === 'form' ? 'registration' : following)
      }
    } catch {
      setSetupError(t('No se pudo confirmar el panel. Recarga el progreso y reintenta.', 'Could not confirm the panel. Reload progress and retry.'))
    } finally { sourceBusy('review', false) }
  }
  const finish = async () => {
    if (!gameId || !data || loadError || !progress || busyRef.current || mechanicsDirty || formDirty || conditionsDirty
      || setupError || invalidations.current.size || progress.confirmedSections.length !== SETUP_REVIEW_SECTIONS.length) return
    sourceBusy('review', true)
    try {
      const next = await finishSetupReview(gameId, progress.revision)
      setProgress(next)
      onClose(!!createdId)
    } catch {
      setSetupError(t('No se pudo finalizar la revisión. Recarga el progreso y reintenta.', 'Could not finish the review. Reload progress and retry.'))
    } finally { sourceBusy('review', false) }
  }
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6"
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div ref={dialog} lang={language} role="dialog" aria-modal="true" aria-labelledby="event-config-title" tabIndex={-1}
      className={`admin-dialog flex max-h-[92dvh] w-full ${section === 'appearance' ? 'max-w-7xl' : 'max-w-4xl'} flex-col rounded-lg border shadow-xl`}
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
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-current/15 px-5 py-3">
        <h2 id="event-config-title" className="text-xl font-semibold">{!gameId
          ? `${t('Crear partida', 'Create event')}${gameType ? ` · ${getGameById(gameType)?.name ?? gameType}` : ''}`
          : data ? data.game.gameName : t('Cargando configuración…', 'Loading settings…')}</h2>
        <IconButton icon="remove" label={t('Cerrar configuración', 'Close settings')} type="button" disabled={busy || discard} onClick={close} />
      </header>
      <div className="min-h-0 space-y-3 overflow-y-auto p-4 sm:p-5">
        {!gameId && <GameGate showHeaderLogo={false} initialGame={gameType ? getGameById(gameType) : undefined}
          createOnly onBusyChange={changeBusy} onGameCreated={(_name, id) => {
            setCreatedId(id)
            onCreated?.(id)
            dialog.current?.focus()
          }} />}
        {gameId && !data && !loadError && <p role="status">{t('Cargando configuración…', 'Loading settings…')}</p>}
        {loadError && <div role="alert"><p>{t('No se pudo cargar esta partida. Comprueba tu sesión y el backend.', 'Could not load this event. Check your session and backend.')}</p>
          <div className="mt-3 flex justify-end"><IconButton icon="reload" label={t('Reintentar', 'Retry')} onClick={() => setReload(value => value + 1)} /></div>
        </div>}
        {gameId && data && <>
          {readOnly && <p role="status">{t('Solo lectura: esta partida está inactiva o en proceso de cierre.', 'Read only: this event is inactive or closing.')}</p>}
          <div className="sticky -top-4 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-current/15 px-4 py-2 sm:-top-5 sm:-mx-5 sm:px-5"
            style={{ background: 'var(--color-background)' }}>
          <nav role="tablist" aria-label={t('Secciones de configuración', 'Settings sections')}
            className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {([
              ['appearance', 'Home'],
              ['form', t('Registro', 'Registration')],
              ['configuration', t('Juego', 'Game')],
              ['questionnaire', t('Cuestionario', 'Questionnaire')],
              ['conditions', t('Premios', 'Prizes')],
              ['prizes', t('Sorteo', 'Raffle')],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`event-tab-${id}`}
                aria-selected={section === id} aria-controls={`event-panel-${id}`}
                tabIndex={section === id ? 0 : -1}
                disabled={busy || discard}
                onClick={() => {
                  if (busyRef.current) return
                  if (id === 'appearance' || id === 'form' || id === 'questionnaire') {
                    setFormSection(id === 'appearance' ? 'appearance' : id === 'form' ? 'registration' : 'questionnaire')
                  }
                  setSection(id)
                }}
                className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${
                  section === id ? 'border-primary text-textMain' : 'border-transparent text-textSub hover:text-textMain'
                }`}>
                {label}
                {reviewRequired && progress.confirmedSections.includes(id) && <span className="ml-1" aria-label={t('Confirmado', 'Confirmed')}>✓</span>}
              </button>
            ))}
          </nav>
          <div ref={setActionsTarget} role="group" aria-label={t('Acciones de configuración', 'Settings actions')}
            className="ml-auto flex shrink-0 items-center gap-2">
            {section === 'configuration' && Component && !readOnly && <SaveButton iconOnly
              disabled={busy || saveUncertain || !mechanicsDirty || discard} onClick={() => void save()}>
              {t('Guardar configuración', 'Save configuration')}
            </SaveButton>}
          </div>
          </div>
          <section role="tabpanel" id="event-panel-configuration" aria-labelledby="event-tab-configuration"
            hidden={section !== 'configuration'} tabIndex={0} className="space-y-3 py-2">
            <div className="grid items-stretch gap-6 lg:h-[calc(92dvh-14rem)] lg:min-h-80 lg:grid-cols-2">
            <div className="min-w-0 space-y-3 lg:overflow-y-auto">
            {Component ? <>
              <fieldset disabled={readOnly || busy || saveUncertain || discard} onChangeCapture={() => { markMechanicsDirty(true); setMessage('') }}
                onClickCapture={event => { if ((event.target as HTMLElement).closest('button')) { markMechanicsDirty(true); setMessage('') } }}>
                <Component gameId={gameId} gameName={data.game.gameName} settings={settings} settingsLoaded
                  readOnly={readOnly} onBusyChange={changeBusy} onDirtyChange={markMechanicsDirty} onChange={(patch: unknown) => {
                    if (typeof patch === 'object' && patch !== null) savedPatch.current = { ...patch }
                  }} registerSave={registerSave} onDraftChange={setMechanicsDraft} />
              </fieldset>
            </> : <p>{t('Este juego no tiene ajustes de mecánica editables.', 'This game has no editable mechanic settings.')}</p>}
            {message && <p role={saveError ? 'alert' : 'status'}>{message}</p>}
            </div>
            {section === 'configuration' && <aside aria-label={t('Prueba del juego', 'Game trial')}
              className="flex min-h-80 min-w-0 w-full flex-col overflow-hidden rounded-xl border border-current/20 p-5">
              <h3 className="mb-3 shrink-0 font-semibold">{t('Vista previa', 'Preview')}</h3>
              <div className="min-h-0 flex-auto overflow-y-auto">
                {!Component || mechanicsDraft
                  ? <GamePlayPreview gameType={data.game.gameType} settings={Component ? mechanicsDraft! : settings} gameId={gameId}
                    frame={{ ...phoneFrame, prizeCatalog: data.prizeCatalog }} />
                  : <p role="status">{t('Esperando una configuración del juego cargada correctamente.', 'Waiting for successfully loaded game settings.')}</p>}
              </div>
            </aside>}
            </div>
          </section>
          <section role="tabpanel"
            id={`event-panel-${formSection === 'registration' ? 'form' : formSection}`}
            aria-labelledby={`event-tab-${formSection === 'registration' ? 'form' : formSection}`}
            hidden={section !== 'appearance' && section !== 'form' && section !== 'questionnaire'}
            tabIndex={0} className="space-y-3 py-2">
            <ConfigurationActionsContext.Provider value={{ target: actionsTarget,
              active: section === 'appearance' || section === 'form' || section === 'questionnaire', disabled: busy || discard }}>
            <fieldset disabled={busy || discard} className="min-w-0 w-full max-w-full">
              <GameFormSettings gameId={gameId} gameName={data.game.gameName} readOnly={readOnly} section={formSection} prizeCatalog={data.prizeCatalog} onFrameChange={setPhoneFrame}
                onBusyChange={formBusy} onDirtyChange={setFormDirty} onReadyChange={formReady} onSectionDirtyChange={formSectionDirty} />
            </fieldset>
            </ConfigurationActionsContext.Provider>
          </section>
          <section role="tabpanel" id="event-panel-conditions" aria-labelledby="event-tab-conditions"
            hidden={section !== 'conditions'} tabIndex={0} className="space-y-3 py-2">
            <ConfigurationActionsContext.Provider value={{ target: actionsTarget, active: section === 'conditions', disabled: busy || discard }}>
            <fieldset disabled={busy || discard} className="space-y-3">
              <PrizeNotificationSettings gameId={gameId} readOnly={readOnly} />
              <RewardConditions data={data} readOnly={readOnly}
                headerAside={<div className="flex min-w-0 items-center gap-3 rounded-xl border border-current/15 p-3">
                  <QRCode data={getRedeemUrl(gameId)} size={80} margin={4}
                    alt={t('QR validador de premios', 'Prize validator QR code')} className="!bg-white !p-1" />
                  <a className="min-w-0 break-all text-sm underline" href={getRedeemUrl(gameId)} target="_blank" rel="noreferrer">
                    {t('Abrir validador de premios', 'Open prize validator')}
                  </a>
                </div>}
                onBusyChange={conditionsBusy} onDirtyChange={markConditionsDirty} onReadyChange={conditionsReady} />
            </fieldset>
            </ConfigurationActionsContext.Provider>
          </section>
          <section role="tabpanel" id="event-panel-prizes" aria-labelledby="event-tab-prizes"
            hidden={section !== 'prizes'} tabIndex={0} className="space-y-3 py-2"
            onChangeCapture={() => invalidateReview('prizes')}>
            <ConfigurationActionsContext.Provider value={{ target: actionsTarget, active: section === 'prizes', disabled: busy || discard }}>
            <fieldset disabled={busy || discard}>
            {readOnly
              ? <p>{t('Los sorteos solo están disponibles en partidas activas.', 'Raffles are only available for active events.')}</p>
              : getFeaturesByPlan(plan).raffles
                ? <Raffle embedded onBack={() => undefined} onClose={() => undefined}
                  onBusyChange={raffleBusy} onReadyChange={raffleReady} onVisibilitySaved={() => invalidateReview('prizes')} gameId={gameId} gameType={definition?.id} />
                : <p>{t('Disponible en el plan Event 24h.', 'Available on the Event 24h plan.')}</p>}
            </fieldset>
            </ConfigurationActionsContext.Provider>
          </section>
        </>}
        {(reviewRequired || missingSetup) && <div className="space-y-3 border-t border-current/20 pt-4">
          <p role="status">{t('Revisión inicial obligatoria', 'Required initial review')}: {progress?.confirmedSections.length ?? 0} / 6</p>
          {setupNotice && <p role="status">{setupNotice}</p>}
          {missingSetup && <p role="alert">{t('El backend no devolvió el progreso de configuración. Actualízalo y recarga.', 'The backend did not return setup progress. Update it and reload.')}</p>}
          {setupError && <p role="alert">{setupError}</p>}
          {!sectionReady && <p className="text-sm">{t('Espera a que cargue el panel, corrige los errores y guarda los cambios antes de confirmar.', 'Wait for the panel to load, fix errors and save changes before confirming.')}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50"
              disabled={busy || !sectionReady || readOnly || !!setupError || missingSetup}
              onClick={() => void confirmSection()}>{t('Confirmar panel y continuar', 'Confirm panel and continue')}</button>
            <button type="button" className="rounded-lg border border-current/20 px-4 py-2 disabled:opacity-50"
              disabled={busy || !data || loadError || !!setupError || !progress || progress.confirmedSections.length !== 6 || mechanicsDirty || formDirty || conditionsDirty}
              onClick={() => void finish()}>{t('Finalizar configuración', 'Finish setup')}</button>
          </div>
          {(setupError || missingSetup) && <div className="flex justify-end"><IconButton icon="reload" label={t('Recargar progreso', 'Reload progress')} disabled={busy}
            onClick={() => {
              if (!gameId) return
              sourceBusy('review', true)
              void getOperatorGameConfiguration(gameId).then(result => {
                setProgress(result.game.setupReview)
                setSetupError('')
                setReviewVersion(value => value + 1)
              }).catch(() => setSetupError(t('No se pudo recargar el progreso.', 'Could not reload progress.')))
                .finally(() => sourceBusy('review', false))
            }} /></div>}
        </div>}
        {saveUncertain && <div className="flex justify-end"><IconButton icon="reload" label={t('Recargar configuración', 'Reload settings')} disabled={busy} onClick={() => {
          if ((mechanicsDirty || formDirty || conditionsDirty)
            && !window.confirm(t('Se descartarán los cambios sin guardar al recargar la configuración.', 'Reloading settings will discard unsaved changes.'))) return
          setMechanicsDirty(false)
          setConditionsDirty(false)
          setFormDirty(false)
          setSaveUncertain(false)
          setReload(value => value + 1)
        }} /></div>}
        {busy && <p role="status">{t('Guardando…', 'Saving…')}</p>}
        {discard && <div ref={discardDialog} role="alertdialog" aria-label={t('Descartar cambios', 'Discard changes')} className="space-y-3 rounded-xl border border-current/20 p-4">
          <p>{t('Hay cambios sin guardar. ¿Quieres descartarlos y cerrar?', 'There are unsaved changes. Discard them and close?')}</p>
          <button type="button" disabled={busy} className="mr-4 underline" onClick={() => {
            if (!busyRef.current) onClose(!!createdId)
          }}>{t('Descartar y cerrar', 'Discard and close')}</button>
          <button type="button" className="underline" onClick={() => {
            setDiscard(false)
            dialog.current?.focus()
          }}>{t('Seguir editando', 'Keep editing')}</button>
        </div>}
      </div>
    </div>
  </div>, document.body)
}
