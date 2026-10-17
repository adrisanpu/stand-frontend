import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'
import { saveErrorMessage, useGameConfigSaveRegistration } from '../../core/settings/gameConfigSave'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'

interface GameDataResponse {
  ok: boolean
  game?: {
    gameId: string
    gameName: string
    gameType: string
    participantFields?: { email?: { required?: boolean }; instagram?: { required?: boolean } }
  }
}

export default function T1merGameConfig({ gameId, gameName: _gameName, onChange, registerSave }: GameConfigProps) {
  const { t } = useOperatorLanguage()
  const [emailRequired, setEmailRequired] = useState(true)
  const [instagramRequired, setInstagramRequired] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')
  const [loaded, setLoaded] = useState(!gameId)
  const [loadError, setLoadError] = useState('')

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
        const pf = data.game?.participantFields
        if (pf?.email?.required != null) setEmailRequired(Boolean(pf.email.required))
        if (pf?.instagram?.required != null) setInstagramRequired(Boolean(pf.instagram.required))
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
    if (registerSave) return
    const settings = { emailRequired, instagramRequired }
    if (gameId) {
      await api.put('/v1/game', {
        gameId,
        participantFields: {
          email: { required: emailRequired },
          instagram: { required: instagramRequired },
        },
      })
    }
    onChange(settings)
  }

  const embedded = useGameConfigSaveRegistration(registerSave, { validate, save: persist })

  const handleSave = async () => {
    if (!loaded) return
    setSaveStatus('idle')
    setSaveMessage('')

    if (!gameId) {
      await persist()
      setSaveStatus('success')
      setSaveMessage(t('Configuración guardada.', 'Configuration saved.'))
      setTimeout(() => {
        setSaveStatus('idle')
        setSaveMessage('')
      }, 3000)
      return
    }

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
  }

  return (
    <div className="space-y-6">
      {loadError && <p role="alert" className="text-sm text-red-300">{localizeOperatorMessage(loadError, t)}</p>}
      {!loaded && !loadError && <p role="status">{t('Cargando configuración...', 'Loading configuration...')}</p>}
      {!embedded && <div className="space-y-4">
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-sm font-medium text-gray-300">{t('Datos del participante', 'Participant information')}</p>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={emailRequired} onChange={(e) => setEmailRequired(e.target.checked)} />
            {t('Email obligatorio (CRM / contacto)', 'Email required (CRM / contact)')}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={instagramRequired}
              onChange={(e) => setInstagramRequired(e.target.checked)}
            />
            {t('Instagram obligatorio', 'Instagram required')}
          </label>
        </div>
      </div>}

      {saveStatus !== 'idle' && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${
            saveStatus === 'error'
              ? 'bg-red-500/20 text-red-300 border-red-500/30'
              : saveStatus === 'success'
                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                : 'bg-[rgba(239,68,68,0.15)] text-red-200 border-[rgba(239,68,68,0.3)]'
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
          onClick={() => void handleSave()}
          disabled={!loaded || saveStatus === 'saving'}
          className="w-full p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveStatus === 'saving' ? t('Guardando...', 'Saving...') : t('Guardar configuración', 'Save configuration')}
        </button>
      )}
    </div>
  )
}
