import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import type { GameConfigProps } from '../../core/types'
import { saveErrorMessage, useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'
import { DEFAULT_STACK_CONFIG, isStackConfig, STACK_SKINS, type StackConfig, type StackSkin } from './stackLogic'
import BlockPreview from './BlockPreview'

const FIELDS = [
  { key: 'initialSpeed', label: 'Velocidad inicial', min: 0.1, step: 0.1 },
  { key: 'speedIncrement', label: 'Incremento por bloque', min: 0, step: 0.01 },
  { key: 'maxSpeed', label: 'Velocidad máxima', min: 0.1, step: 0.1 },
  { key: 'perfectTolerance', label: 'Tolerancia Perfect', min: 0, step: 0.01 },
] as const

const SKIN_LABELS: Record<StackSkin, string> = {
  blocks: 'Bloques de colores',
  pizza: 'Pizza',
  baklava: 'Baklava de pistacho',
}

export default function StackGameConfig({ gameId, onChange, registerSave }: GameConfigProps) {
  const { t } = useOperatorLanguage()
  const [config, setConfig] = useState<StackConfig>(DEFAULT_STACK_CONFIG)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!gameId) {
      setStatus('ready')
      return
    }
    setStatus('loading')
    void api.get<{ game?: { type?: { STACK?: unknown } } }>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
      .then((data) => {
        if (cancelled) return
        if (!isStackConfig(data.game?.type?.STACK)) throw new Error('El servidor no devolvió una configuración válida de STACK.')
        setConfig(data.game.type.STACK)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setStatus('error')
        setMessage(cause instanceof Error ? cause.message : 'No se pudo cargar la configuración.')
      })
    return () => { cancelled = true }
  }, [gameId])

  const validate = () => {
    if (status === 'loading') return t('La configuración de STACK aún se está cargando.', 'The STACK configuration is still loading.')
    if (status === 'error') return message || t('No se pudo cargar la configuración.', 'Could not load the configuration.')
    if (!gameId || !isStackConfig(config)) return t('Revisa las velocidades y la tolerancia antes de guardar.', 'Check the speeds and tolerance before saving.')
    return null
  }

  const persist = async () => {
    const invalid = validate()
    if (invalid || !gameId) throw new Error(invalid ?? t('Revisa las velocidades y la tolerancia antes de guardar.', 'Check the speeds and tolerance before saving.'))
    const settings = {
      initialSpeed: config.initialSpeed,
      speedIncrement: config.speedIncrement,
      maxSpeed: config.maxSpeed,
      perfectTolerance: config.perfectTolerance,
      skin: config.skin ?? 'blocks',
    }
    await api.put('/v1/game', { gameId, settings: { stack: settings } })
    onChange(settings)
  }

  const embedded = useGameConfigSaveRegistration(registerSave, { validate, save: persist })

  const save = async () => {
    if (!gameId || !isStackConfig(config)) {
      setMessage(t('Revisa las velocidades y la tolerancia antes de guardar.', 'Check the speeds and tolerance before saving.'))
      return
    }
    setStatus('saving')
    setMessage('')
    try {
      await persist()
      setStatus('saved')
      setMessage(t('Configuración guardada. Se aplicará a los nuevos intentos.', 'Configuration saved. It will apply to new attempts.'))
    } catch (cause) {
      setStatus('ready')
      setMessage(saveErrorMessage(cause, t('No se pudo guardar la configuración.', 'Could not save the configuration.')))
    }
  }

  return (
    <div className="space-y-4">
      {status === 'loading' && <p role="status">{t('Cargando configuración...', 'Loading configuration...')}</p>}
      <label className="flex flex-col gap-1">
        <span className="text-sm">{t('Aspecto de las piezas', 'Piece appearance')}</span>
        <select
          value={config.skin ?? 'blocks'}
          disabled={status === 'loading' || status === 'error' || status === 'saving'}
          onChange={(event) => {
            setConfig({ ...config, skin: event.target.value as StackSkin })
            setMessage('')
          }}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3"
        >
          {STACK_SKINS.map((skin) => <option key={skin} value={skin}>{t(SKIN_LABELS[skin], skin === 'blocks' ? 'Color blocks' : skin === 'pizza' ? 'Pizza' : 'Pistachio baklava')}</option>)}
        </select>
      </label>
      <BlockPreview skin={config.skin ?? 'blocks'} />
      <details className="rounded-xl border border-white/10 p-3">
      <summary className="cursor-pointer text-sm font-medium">{t('Ajustes avanzados', 'Advanced settings')}</summary>
      <div className="grid grid-cols-2 gap-4 pt-3">
        {FIELDS.map(({ key, label, min, step }) => (
          <label key={key} className="min-w-0 flex flex-col gap-1">
            <span className="text-sm">{t(label, key === 'initialSpeed' ? 'Initial speed' : key === 'speedIncrement' ? 'Increment per block' : key === 'maxSpeed' ? 'Maximum speed' : 'Perfect tolerance')}</span>
            <input
              type="number"
              min={min}
              step={step}
              value={Number.isFinite(config[key]) ? config[key] : ''}
              disabled={status === 'loading' || status === 'error' || status === 'saving'}
              onChange={(event) => {
                setConfig({ ...config, [key]: event.target.valueAsNumber })
                setMessage('')
              }}
              className="mt-auto w-full min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-3"
            />
          </label>
        ))}
      </div>
      </details>
      {message && <p role={status === 'saved' ? 'status' : 'alert'} className="text-sm">{localizeOperatorMessage(message, t)}</p>}
      {!embedded && (
        <button
          type="button"
          onClick={() => void save()}
          disabled={!gameId || status === 'loading' || status === 'error' || status === 'saving' || !isStackConfig(config)}
          className="w-full rounded-xl py-3 font-semibold bg-primary/20 border border-primary/30 disabled:opacity-50"
        >
          {status === 'saving' ? t('Guardando...', 'Saving...') : t('Guardar configuración', 'Save configuration')}
        </button>
      )}
    </div>
  )
}
