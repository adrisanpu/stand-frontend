import { useState, useEffect, useRef } from 'react'
import type { GameConfigProps } from '../../core/types'
import { useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { api } from '../../api/api'
import { DEFAULT_RULET4_CONFIG, isRulet4Config, type Rulet4Settings, type Rulet4PanelConfig } from './rulet4Logic'

export type { Rulet4PanelConfig, Rulet4Settings } from './rulet4Logic'

export default function Rulet4GameConfig({ gameId, onChange, registerSave }: GameConfigProps) {
  const { t } = useOperatorLanguage()
  const translateRef = useRef(t)
  translateRef.current = t
  const [panels, setPanels] = useState<Rulet4PanelConfig[]>(
    DEFAULT_RULET4_CONFIG.panels
  )
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setMessage('')
    void api.get<{ game?: { type?: { RULET4?: unknown }; rulet4ConfigStored?: boolean } }>(`/v1/game?gameId=${encodeURIComponent(gameId ?? '')}`)
      .then((data) => {
        if (cancelled) return
        let config = data.game?.type?.RULET4
        if (!isRulet4Config(config)) throw new Error(translateRef.current('Configuración RULET4 no válida.', 'Invalid RULET4 configuration.'))
        const legacy = data.game?.rulet4ConfigStored === false && localStorage.getItem(`RULET4_settings_${gameId}`)
        if (legacy) {
          config = JSON.parse(legacy)
          if (!isRulet4Config(config)) throw new Error(translateRef.current('Configuración local RULET4 no válida.', 'Invalid local RULET4 configuration.'))
          setMessage(translateRef.current('Guarda para migrar esta configuración local al servidor.', 'Save to migrate these local settings to the server.'))
        }
        setPanels(config.panels)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setStatus('error')
        setMessage(cause instanceof Error ? cause.message : translateRef.current('No se pudo cargar la configuración.', 'Could not load settings.'))
      })
    return () => { cancelled = true }
  }, [gameId, reload])

  const handleAddPanel = () => {
    const newId = String(Date.now())
    const newPanel: Rulet4PanelConfig = {
      id: newId,
      label: `Premio ${panels.length + 1}`,
      color: '#DC2626',
      count: 1,
    }
    setPanels([...panels, newPanel])
  }

  const handleDeletePanel = (id: string) => {
    if (panels.length > 1) {
      setPanels(panels.filter(p => p.id !== id))
    }
  }

  const handlePanelChange = (id: string, field: keyof Rulet4PanelConfig, value: string | number) => {
    setPanels(panels.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ))
  }

  const validate = () => status !== 'ready'
    ? t('La configuración RULET4 no está lista.', 'RULET4 settings are not ready.')
    : !isRulet4Config({ panels })
      ? t('Revisa los paneles: máximo 32 y peso total 360, con etiquetas y colores válidos.', 'Check panels: at most 32 and total weight 360, with valid labels and colors.')
      : null

  const handleSave = async () => {
    const invalid = validate()
    if (invalid) throw new Error(invalid)
    const newSettings: Rulet4Settings = { panels }
    const response = await api.put<{ ok?: boolean }>('/v1/game', { gameId, settings: { rulet4: newSettings } })
    if (response.ok !== true) throw new Error(t('No se pudo guardar RULET4.', 'Could not save RULET4.'))
    onChange(newSettings)
  }

  const embedded = useGameConfigSaveRegistration(registerSave, { validate, save: handleSave })
  const save = async () => {
    setSaving(true)
    setMessage('')
    setSaveFailed(false)
    try {
      await handleSave()
      setMessage(t('Configuración guardada.', 'Settings saved.'))
    } catch (cause) {
      setSaveFailed(true)
      setMessage(cause instanceof Error ? cause.message : t('No se pudo guardar RULET4.', 'Could not save RULET4.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {status === 'loading' && <p role="status">{t('Cargando configuración...', 'Loading settings...')}</p>}
      {message && <p role={status === 'error' || saveFailed ? 'alert' : 'status'}>{message}</p>}
      {status === 'error' && <button type="button" onClick={() => setReload((value) => value + 1)}>{t('Reintentar carga', 'Retry loading')}</button>}
      <fieldset disabled={status !== 'ready' || saving} className="space-y-6">
      <div className="space-y-4">
        {panels.map((panel, index) => (
          <div
            key={panel.id}
            className="p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-300">{t(`Panel ${index + 1}`, `Panel ${index + 1}`)}</span>
              {panels.length > 1 && (
                <button
                  onClick={() => handleDeletePanel(panel.id)}
                  className="p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                  aria-label={t('Eliminar panel', 'Delete panel')}
                >
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('Etiqueta', 'Label')}</label>
                <input
                  type="text"
                  value={panel.label}
                  onChange={(e) => handlePanelChange(panel.id, 'label', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm focus:border-white/20 focus:outline-none"
                  placeholder={t('Nombre del premio', 'Prize name')}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('Cantidad', 'Quantity')}</label>
                <input
                  type="number"
                  min="1"
                  value={panel.count}
                  onChange={(e) => handlePanelChange(panel.id, 'count', parseInt(e.target.value) || 1)}
                  className="w-full h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm focus:border-white/20 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('Color (opcional)', 'Color (optional)')}</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={panel.color || '#DC2626'}
                  onChange={(e) => handlePanelChange(panel.id, 'color', e.target.value)}
                  className="w-12 h-9 rounded-lg border border-white/10 cursor-pointer"
                />
                <input
                  type="text"
                  value={panel.color || '#DC2626'}
                  onChange={(e) => handlePanelChange(panel.id, 'color', e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm font-mono focus:border-white/20 focus:outline-none"
                  placeholder="#DC2626"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleAddPanel}
        disabled={panels.length >= 32}
        className="w-full p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {t('Añadir tipo de panel', 'Add panel type')}
      </button>

      {!embedded && (
        <button
          onClick={() => void save()}
          className="w-full p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors font-medium"
        >
          {t('Guardar configuración', 'Save configuration')}
        </button>
      )}
      </fieldset>
    </div>
  )
}
