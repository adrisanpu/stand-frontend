import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'
import { saveErrorMessage, useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'

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

export default function Empareja2GameConfig({ gameId, gameName: _gameName, settings, onChange, registerSave }: GameConfigProps) {
  const { t } = useOperatorLanguage()
  const [numPairsInput, setNumPairsInput] = useState<string>(
    (settings as Empareja2Settings | null)?.numPairs != null
      ? String((settings as Empareja2Settings).numPairs)
      : ''
  )
  const [catalogPairCount, setCatalogPairCount] = useState<number | null>(null)
  const [emailRequired, setEmailRequired] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')
  const [loaded, setLoaded] = useState(!gameId)
  const [loadError, setLoadError] = useState('')
  const storedNumPairs = (settings as Empareja2Settings | null)?.numPairs

  useEffect(() => {
    if (storedNumPairs != null) setNumPairsInput(String(storedNumPairs))
  }, [storedNumPairs])

  useEffect(() => {
    if (!gameId) return
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
  }, [gameId])

  const validate = () => (loaded ? null : loadError || t('La configuración del juego aún se está cargando.', 'The game configuration is still loading.'))

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
      await api.put('/v1/game', {
        gameId,
        ...(!registerSave ? { participantFields: {
          email: { required: emailRequired },
        } } : {}),
        settings: {
          empareja2: {
            numPairs: numPairsClamped,
          },
        },
      })
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
            <span className="group relative inline-flex">
              <button
                type="button"
                aria-label={t('Información sobre la dificultad', 'Information about the difficulty')}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] font-semibold text-gray-300/90"
              >
                i
              </button>
              <span className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-72 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-white/15 bg-[rgba(17,24,39,0.98)] p-2 text-xs text-gray-200 shadow-lg group-hover:block">
                {t('Cada partida usa un subconjunto del catálogo. Más parejas en juego hace más difícil encontrar a la tuya; menos parejas lo hace más fácil. El deslizador elige cuántas parejas distintas entran en cada partida.', 'Each game uses a subset of the catalog. More pairs in play make it harder to find yours; fewer pairs make it easier. The slider chooses how many different pairs are included in each game.')}
              </span>
            </span>
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
                  disabled={sliderDisabled}
                  className="empareja2-difficulty-slider h-3 w-full rounded-full appearance-none bg-[rgba(255,255,255,0.1)] border border-white/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={t('Número de parejas (dificultad)', 'Number of pairs (difficulty)')}
                />
              </div>
              <p className="shrink-0 text-sm text-gray-300 text-right">
                <strong>{numPairsValue}</strong> {numPairsValue === 1 ? t('pareja seleccionada', 'pair selected') : t('parejas seleccionadas', 'pairs selected')}
              </p>
            </div>
          )}
        </div>

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
        <button
          type="button"
          onClick={handleSave}
          disabled={!loaded || saveStatus === 'saving'}
          className="w-full p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveStatus === 'saving' ? t('Guardando...', 'Saving...') : t('Guardar configuración', 'Save configuration')}
        </button>
      )}
    </div>
  )
}
