import { useState, useEffect, useRef } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'
import { saveErrorMessage, useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import SaveButton from '../../core/ui/SaveButton'
import { localizeOperatorMessage } from '../operatorText'
import { useMechanicsDraft } from '../useMechanicsDraft'
import Catalog from './Catalog'
import ContributionEditor from './ContributionEditor'
import { newId, uploadDrafts, validateDrafts, type DraftPair } from './contributions'

export type Empareja2Settings = {
  numPairs?: number
  emailRequired?: boolean
}

interface GameDataResponse {
  ok: boolean
  game?: {
    gameId: string
    gameName: string
    gameType: string
    participantFields?: { email?: { required?: boolean } }
  }
  settings?: { empareja2?: { numPairs?: number } }
  empareja2CatalogPairCount?: number
}

export default function Empareja2GameConfig({ gameId, gameName: _gameName, settings, settingsLoaded, onChange, onDraftChange, registerSave }: GameConfigProps) {
  const { t } = useOperatorLanguage()
  const [numPairsInput, setNumPairsInput] = useState<string>(
    (settings as Empareja2Settings | null)?.numPairs != null
      ? String((settings as Empareja2Settings).numPairs)
      : ''
  )
  const [catalogPairCount, setCatalogPairCount] = useState<number | null>(settingsLoaded ? settings?.catalogPairCount ?? null : null)
  const [emailRequired, setEmailRequired] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')
  const [loaded, setLoaded] = useState(settingsLoaded || !gameId)
  const [loadError, setLoadError] = useState('')
  const [draftPairs, setDraftPairs] = useState<DraftPair[]>([])
  const [catalogRevision, setCatalogRevision] = useState(0)
  const operationId = useRef<string | null>(null)
  const [pendingPublication, setPendingPublication] = useState<{
    operationId: string
    numPairs: number
    pairs: Array<Array<{ name: string; imageKey: string }>>
  } | null>(null)
  const storedNumPairs = (settings as Empareja2Settings | null)?.numPairs
  useMechanicsDraft(loaded ? {
    numPairs: numPairsInput.trim() === '' ? catalogPairCount ?? 50 : Number(numPairsInput),
    catalogPairCount,
  } : null, onDraftChange)

  useEffect(() => {
    if (storedNumPairs != null) setNumPairsInput(String(storedNumPairs))
  }, [storedNumPairs])

  useEffect(() => {
    if (!gameId || settingsLoaded) return
    let cancelled = false
    setLoaded(false)
    setLoadError('')
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled) return
        if (!data.ok || !data.game) throw new Error('No se pudo cargar la configuración.')
        if (data.empareja2CatalogPairCount != null) setCatalogPairCount(data.empareja2CatalogPairCount)
        const backend = data.settings?.empareja2
        if (backend?.numPairs != null) setNumPairsInput(String(backend.numPairs))
        const pf = data.game?.participantFields
        if (pf?.email?.required != null) setEmailRequired(Boolean(pf.email.required))
        setLoaded(true)
      } catch (cause) {
        if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId, settingsLoaded])

  const validate = () => {
    if (!loaded) return loadError || t('La configuración del juego aún se está cargando.', 'The game configuration is still loading.')
    if (draftPairs.length && !gameId) return t('Guarda primero la partida para añadir parejas.', 'Save the game before adding pairs.')
    if (draftPairs.length && (!catalogPairCount || catalogPairCount < 1)) return t('El catálogo aún no está listo para añadir parejas.', 'The catalog is not ready to accept new pairs.')
    return validateDrafts(draftPairs)
  }

  const persist = async () => {
    const invalid = validate()
    if (invalid) throw new Error(invalid)
    const trimmedNum = numPairsInput.trim()
    const maxPairs = catalogPairCount ?? 50
    const numPairs = trimmedNum === '' ? maxPairs : Math.max(1, Math.floor(Number(trimmedNum)) || 1)
    const numPairsClamped = Math.min(numPairs, maxPairs)

    const newSettings: Empareja2Settings = {
      numPairs: numPairsClamped,
      ...(!registerSave ? { emailRequired } : {}),
    }
    if (gameId) {
      if (draftPairs.length) {
        if (!registerSave) {
          await api.put('/v1/game', { gameId, participantFields: { email: { required: emailRequired } } })
        }
        let publication = pendingPublication
        if (!publication) {
          operationId.current ??= newId()
          const pairs = await uploadDrafts(gameId, draftPairs)
          publication = { operationId: operationId.current, numPairs: numPairsClamped, pairs }
          setPendingPublication(publication)
        }
        let result: { ok: boolean }
        try {
          result = await api.put<{ ok: boolean }>('/v1/game/empareja2/catalog', { gameId, ...publication })
        } catch (error) {
          const status = (error as { status?: number }).status
          if (status != null && status >= 400 && status < 500) {
            setPendingPublication(null)
            operationId.current = null
          }
          throw error
        }
        if (!result?.ok) throw new Error(t('No se pudieron publicar las parejas.', 'Could not publish the pairs.'))
        setNumPairsInput(String(numPairsClamped))
        setCatalogPairCount((count) => count == null ? count : count + draftPairs.length)
        setDraftPairs([])
        setCatalogRevision((revision) => revision + 1)
        operationId.current = null
        setPendingPublication(null)
      } else {
        await api.put('/v1/game', {
          gameId,
          ...(!registerSave ? { participantFields: { email: { required: emailRequired } } } : {}),
          settings: { empareja2: { numPairs: numPairsClamped } },
        })
      }
    }
    onChange(newSettings)
  }

  const embedded = useGameConfigSaveRegistration(registerSave, { validate, save: persist })

  const handleSave = async () => {
    if (!loaded) return
    setSaveStatus('idle')
    setSaveMessage('')

    if (gameId) {
      setSaveStatus('saving')
      setSaveMessage(t('Guardando...', 'Saving...'))
      try {
        await persist()
        setSaveStatus('success')
        setSaveMessage(t('Configuración guardada correctamente.', 'Configuration saved successfully.'))
        setTimeout(() => {
          setSaveStatus('idle')
          setSaveMessage('')
        }, 3000)
      } catch (e: unknown) {
        setSaveStatus('error')
        setSaveMessage(saveErrorMessage(e, t('Error al guardar en el servidor', 'Error saving to the server')))
      }
    } else {
      await persist()
      setSaveStatus('success')
      setSaveMessage(t('Configuración guardada.', 'Configuration saved.'))
      setTimeout(() => {
        setSaveStatus('idle')
        setSaveMessage('')
      }, 3000)
    }
  }

  const maxPairs = catalogPairCount ?? 1
  const numPairsValue =
    numPairsInput.trim() === ''
      ? maxPairs
      : Math.min(maxPairs, Math.max(1, Math.floor(Number(numPairsInput)) || 1))
  const sliderDisabled = catalogPairCount == null

  return (
    <div className="space-y-6">
      {loadError && <p role="alert" className="text-sm text-red-300">{localizeOperatorMessage(loadError, t)}</p>}
      {!loaded && !loadError && <p role="status">{t('Cargando configuración...', 'Loading configuration...')}</p>}
      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <label className="block text-sm font-medium text-gray-300" htmlFor="empareja2-difficulty-range">
              {t('Dificultad para encontrar a tu pareja', 'Difficulty finding your match')}
            </label>
          </div>
          {sliderDisabled ? (
            <p className="text-sm text-gray-500 py-2">{t('Cargando número de parejas del catálogo...', 'Loading the number of pairs in the catalog...')}</p>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
              <div className="min-w-0">
                <div className="mb-1 flex justify-between text-xs text-gray-400">
                  <span>{t('+fácil', '+easy')}</span>
                  <span>{t('+difícil', '+hard')}</span>
                </div>
                <input
                  id="empareja2-difficulty-range"
                  type="range"
                  min={1}
                  max={maxPairs}
                  value={numPairsValue}
                  onChange={(e) => setNumPairsInput(e.target.value)}
                  disabled={sliderDisabled || pendingPublication != null}
                  className="empareja2-difficulty-slider h-3 w-full rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={t('Número de parejas (dificultad)', 'Number of pairs (difficulty)')}
                />
              </div>
              <p className="shrink-0 text-sm text-gray-300 text-right">
                <strong>{numPairsValue}</strong> {numPairsValue === 1 ? t('pareja seleccionada', 'pair selected') : t('parejas seleccionadas', 'pairs selected')}
              </p>
            </div>
          )}
        </div>

        <Catalog gameId={gameId} selected={sliderDisabled ? null : numPairsValue} revision={catalogRevision} onPublishedCount={setCatalogPairCount} />
        {pendingPublication && <p role="status" className="text-sm text-amber-300">
          {t('Publicación pendiente de confirmación. Vuelve a guardar para comprobarla sin duplicar parejas.', 'Publication is awaiting confirmation. Save again to check it without duplicating pairs.')}
        </p>}
        {gameId && <fieldset disabled={pendingPublication != null}>
          <ContributionEditor pairs={draftPairs} onChange={(pairs) => {
            operationId.current = null
            setDraftPairs(pairs)
          }} />
        </fieldset>}

        {!embedded && <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-sm font-medium text-gray-300">{t('Datos del participante', 'Participant information')}</p>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={emailRequired} onChange={(e) => setEmailRequired(e.target.checked)} />
            {t('Email obligatorio (CRM / contacto)', 'Email required (CRM / contact)')}
          </label>
        </div>}
      </div>

      {saveStatus !== 'idle' && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${
            saveStatus === 'error'
              ? 'bg-red-500/20 text-red-300 border-red-500/30'
              : saveStatus === 'success'
                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : 'bg-[rgba(176,38,255,0.15)] text-neonMagenta border-[rgba(176,38,255,0.3)]'
          }`}
        >
          {saveStatus === 'saving' && (
            <span className="inline-block w-3 h-3 rounded-full bg-current animate-pulse mr-2 align-middle" />
          )}
          {localizeOperatorMessage(saveMessage, t)}
        </div>
      )}

      {!embedded && (
        <SaveButton
          type="button"
          onClick={handleSave}
          disabled={!loaded || saveStatus === 'saving'}
          className="w-full"
        >
          {saveStatus === 'saving' ? t('Guardando...', 'Saving...') : t('Guardar configuración', 'Save configuration')}
        </SaveButton>
      )}
    </div>
  )
}
