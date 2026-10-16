import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'
import { getWebPlayUrl } from '../../core/lib/joinUrl'

interface GameDataResponse {
  ok: boolean
  game?: {
    gameId: string
    gameName: string
    gameType: string
    joinChannel?: string
    participantFields?: { email?: { required?: boolean }; instagram?: { required?: boolean } }
  }
}

export default function T1merGameConfig({ gameId, gameName: _gameName, onChange }: GameConfigProps) {
  const [emailRequired, setEmailRequired] = useState(true)
  const [instagramRequired, setInstagramRequired] = useState(false)
  const [joinChannel, setJoinChannel] = useState('web')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        const pf = data.game?.participantFields
        if (pf?.email?.required != null) setEmailRequired(Boolean(pf.email.required))
        if (pf?.instagram?.required != null) setInstagramRequired(Boolean(pf.instagram.required))
        if (data.game?.joinChannel) setJoinChannel(data.game.joinChannel)
      } catch {
        // keep local defaults
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId])

  const handleSave = async () => {
    const settings = { emailRequired, instagramRequired, joinChannel }
    setSaveStatus('idle')
    setSaveMessage('')

    if (!gameId) {
      onChange(settings)
      setSaveStatus('success')
      setSaveMessage('Configuración guardada.')
      setTimeout(() => {
        setSaveStatus('idle')
        setSaveMessage('')
      }, 3000)
      return
    }

    setSaveStatus('saving')
    setSaveMessage('Guardando...')
    try {
      await api.put('/v1/game', {
        gameId,
        joinChannel,
        participantFields: {
          email: { required: emailRequired },
          instagram: { required: instagramRequired },
        },
      })
      // After PUT so AppShell GET sees the new joinChannel (not a stale race).
      onChange(settings)
      setSaveStatus('success')
      setSaveMessage('Configuración guardada correctamente.')
      setTimeout(() => {
        setSaveStatus('idle')
        setSaveMessage('')
      }, 3000)
    } catch (e: unknown) {
      setSaveStatus('error')
      setSaveMessage(e instanceof Error ? e.message : 'Error al guardar en el servidor')
    }
  }

  const isPhoneMode = joinChannel === 'web'

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-3 border-b border-white/10 pb-4">
          <p className="text-sm font-medium text-gray-300">Modo de juego</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setJoinChannel('instagram')}
              className={`rounded-xl px-3 py-3 text-sm font-medium border transition-colors ${
                !isPhoneMode
                  ? 'bg-[rgba(239,68,68,0.25)] border-[rgba(239,68,68,0.5)] text-white'
                  : 'bg-white/5 border-white/10 text-gray-300'
              }`}
            >
              Pantalla del evento
            </button>
            <button
              type="button"
              onClick={() => setJoinChannel('web')}
              className={`rounded-xl px-3 py-3 text-sm font-medium border transition-colors ${
                isPhoneMode
                  ? 'bg-[rgba(239,68,68,0.25)] border-[rgba(239,68,68,0.5)] text-white'
                  : 'bg-white/5 border-white/10 text-gray-300'
              }`}
            >
              Teléfonos
            </button>
          </div>
          <p className="text-xs text-gray-400">
            {isPhoneMode
              ? 'Los asistentes juegan el timer desde su móvil (/play).'
              : 'Los asistentes juegan por Instagram; el timer corre en la pantalla del operador.'}
          </p>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="text-sm font-medium text-gray-300">Datos del participante</p>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={emailRequired} onChange={(e) => setEmailRequired(e.target.checked)} />
            Email obligatorio (CRM / contacto)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={instagramRequired}
              onChange={(e) => setInstagramRequired(e.target.checked)}
            />
            Instagram obligatorio
          </label>
        </div>

        {gameId && isPhoneMode && (
          <div className="space-y-3 border-t border-white/10 pt-4 text-sm">
            <p className="font-medium text-gray-300">Enlaces del evento</p>
            <a
              href={getWebPlayUrl(gameId)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-neonCyan underline truncate"
            >
              Participante (móvil)
            </a>
          </div>
        )}
      </div>

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
          {saveMessage}
        </div>
      )}

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saveStatus === 'saving'}
        className="w-full p-3 rounded-xl bg-[rgba(239,68,68,0.2)] border border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.3)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saveStatus === 'saving' ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
