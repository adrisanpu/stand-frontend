import { useEffect, useState } from 'react'
import { api } from '../../api/api'
import type { GameConfigProps } from '../../core/types'
import { saveErrorMessage, useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'

export type Rulet4PanelConfig = {
  id: string
  label: string
  color?: string
  count: number
}

export type Rulet4Settings = {
  panels: Rulet4PanelConfig[]
}

const DEFAULT_PANELS: Rulet4PanelConfig[] = [
  { id: '1', label: 'Rojo', color: '#DC2626', count: 4 },
  { id: '2', label: 'Negro', color: '#000000', count: 4 },
  { id: '3', label: 'Verde', color: '#22C55E', count: 1 },
]

const MAX_PANELS = 32
const MAX_TOTAL_WEIGHT = 360

function validatePanels(panels: Rulet4PanelConfig[], t: (spanish: string, english?: string) => string) {
  if (!Array.isArray(panels) || panels.length < 1 || panels.length > MAX_PANELS) {
    return t('La ruleta debe tener entre 1 y 32 paneles.', 'The wheel must have between 1 and 32 panels.')
  }
  const ids = new Set<string>()
  let total = 0
  for (const panel of panels) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(panel.id) || ids.has(panel.id)) {
      return t('Cada panel debe tener un identificador único válido.', 'Each panel must have a unique valid identifier.')
    }
    if (panel.label.trim().length < 1 || panel.label.trim().length > 80) {
      return t('Las etiquetas deben tener entre 1 y 80 caracteres.', 'Labels must contain between 1 and 80 characters.')
    }
    if (panel.color != null && !/^#[0-9A-Fa-f]{6}$/.test(panel.color)) {
      return t('El color debe tener el formato #RRGGBB.', 'Color must use the #RRGGBB format.')
    }
    if (!Number.isInteger(panel.count) || panel.count < 1 || panel.count > MAX_TOTAL_WEIGHT) {
      return t('La cantidad debe ser un peso entero entre 1 y 360.', 'Quantity must be an integer weight between 1 and 360.')
    }
    total += panel.count
    ids.add(panel.id)
  }
  if (total > MAX_TOTAL_WEIGHT) {
    return t('La suma de las cantidades no puede superar 360.', 'The total quantity cannot exceed 360.')
  }
  return null
}

function isSettings(value: unknown): value is Rulet4Settings {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Rulet4Settings).panels)) return false
  return (value as Rulet4Settings).panels.every((panel) =>
    !!panel && typeof panel.id === 'string' && typeof panel.label === 'string'
      && typeof panel.count === 'number'
      && (panel.color === undefined || typeof panel.color === 'string'))
}

export default function Rulet4GameConfig({ gameId, onChange, registerSave }: GameConfigProps) {
  const { t } = useOperatorLanguage()
  const [panels, setPanels] = useState<Rulet4PanelConfig[]>(DEFAULT_PANELS)
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!gameId) {
      setPanels(DEFAULT_PANELS)
      setStatus('ready')
      setMessage('')
      return
    }
    setStatus('loading')
    setMessage('')
    void api.get<{ game?: { type?: { RULET4?: unknown } } }>(
      `/v1/game?gameId=${encodeURIComponent(gameId)}`
    ).then((data) => {
      if (cancelled) return
      if (!isSettings(data.game?.type?.RULET4)) {
        throw new Error(t('El servidor no devolvió una configuración válida de RULET4.', 'The server did not return a valid RULET4 configuration.'))
      }
      setPanels(data.game.type.RULET4.panels)
      setStatus('ready')
    }).catch((cause: unknown) => {
      if (cancelled) return
      setStatus('error')
      setMessage(saveErrorMessage(cause, t('No se pudo cargar la configuración.', 'Could not load the configuration.')))
    })
    return () => { cancelled = true }
  }, [gameId, t])

  const validate = () => {
    if (status === 'loading') return t('La configuración de RULET4 aún se está cargando.', 'The RULET4 configuration is still loading.')
    if (status === 'error') return message || t('No se pudo cargar la configuración.', 'Could not load the configuration.')
    if (!gameId) return t('No hay una partida seleccionada.', 'No game is selected.')
    return validatePanels(panels, t)
  }

  const persist = async () => {
    const invalid = validate()
    if (invalid || !gameId) throw new Error(invalid ?? t('No hay una partida seleccionada.', 'No game is selected.'))
    const settings = { panels: panels.map((panel) => ({ ...panel, label: panel.label.trim(), color: (panel.color || '#DC2626').toUpperCase() })) }
    await api.put('/v1/game', { gameId, settings: { rulet4: settings } })
    onChange(settings)
    setPanels(settings.panels)
  }

  const embedded = useGameConfigSaveRegistration(registerSave, { validate, save: persist })

  const save = async () => {
    const invalid = validate()
    if (invalid) {
      setMessage(invalid)
      return
    }
    setStatus('saving')
    setMessage('')
    try {
      await persist()
      setStatus('saved')
      setMessage(t('Configuración guardada.', 'Configuration saved.'))
    } catch (cause) {
      setStatus('ready')
      setMessage(saveErrorMessage(cause, t('No se pudo guardar la configuración.', 'Could not save the configuration.')))
    }
  }

  const disabled = status === 'loading' || status === 'error' || status === 'saving'
  const handleAddPanel = () => {
    if (panels.length >= MAX_PANELS) return
    setPanels([...panels, {
      id: String(Date.now()),
      label: `Premio ${panels.length + 1}`,
      color: '#DC2626',
      count: 1,
    }])
  }

  const handlePanelChange = (id: string, field: keyof Rulet4PanelConfig, value: string | number) => {
    setPanels(panels.map((panel) => panel.id === id ? { ...panel, [field]: value } : panel))
    setMessage('')
  }

  return (
    <div className="space-y-6">
      {status === 'loading' && <p role="status">{t('Cargando configuración...', 'Loading configuration...')}</p>}
      {status === 'error' && <p role="alert" className="text-sm text-red-300">{localizeOperatorMessage(message, t)}</p>}
      <fieldset disabled={disabled} className="space-y-4">
        {panels.map((panel, index) => (
          <div key={panel.id} className="p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">{t(`Panel ${index + 1}`, `Panel ${index + 1}`)}</span>
              {panels.length > 1 && (
                <button type="button" onClick={() => setPanels(panels.filter((item) => item.id !== panel.id))}
                  className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                  aria-label={t('Eliminar panel', 'Delete panel')}>
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-gray-400">
                {t('Etiqueta', 'Label')}
                <input type="text" value={panel.label} maxLength={80}
                  onChange={(event) => handlePanelChange(panel.id, 'label', event.target.value)}
                  className="mt-1 w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm"
                  placeholder={t('Nombre del premio', 'Prize name')} />
              </label>
              <label className="block text-xs text-gray-400">
                {t('Cantidad', 'Quantity')}
                <input type="number" min="1" max={MAX_TOTAL_WEIGHT} step="1" value={panel.count}
                  onChange={(event) => handlePanelChange(panel.id, 'count', event.target.valueAsNumber)}
                  className="mt-1 w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm" />
              </label>
            </div>
            <label className="block text-xs text-gray-400">
              {t('Color', 'Color')}
              <div className="flex gap-2 items-center mt-1">
                <input type="color" value={panel.color || '#DC2626'}
                  onChange={(event) => handlePanelChange(panel.id, 'color', event.target.value)}
                  className="w-12 h-9 rounded-lg border border-white/10 cursor-pointer" />
                <input type="text" value={panel.color || '#DC2626'}
                  onChange={(event) => handlePanelChange(panel.id, 'color', event.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm font-mono"
                  placeholder="#DC2626" />
              </div>
            </label>
          </div>
        ))}
      </fieldset>
      <button type="button" onClick={handleAddPanel} disabled={disabled || panels.length >= MAX_PANELS}
        className="w-full p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('Añadir tipo de panel', 'Add panel type')}
      </button>
      {message && status !== 'error' && <p role={status === 'saved' ? 'status' : 'alert'} className="text-sm">{localizeOperatorMessage(message, t)}</p>}
      {!embedded && (
        <button type="button" onClick={() => void save()} disabled={disabled || !gameId}
          className="w-full p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors font-medium disabled:opacity-50">
          {status === 'saving' ? t('Guardando...', 'Saving...') : t('Guardar configuración', 'Save configuration')}
        </button>
      )}
    </div>
  )
}
