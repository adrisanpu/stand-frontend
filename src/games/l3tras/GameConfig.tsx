import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'

interface GameDataResponse {
  ok: boolean
  settings?: { l3tras?: { objectiveWord?: string } }
}

export type L3trasSettings = {
  objectiveWord: string
}

const DEFAULT_SETTINGS: L3trasSettings = {
  objectiveWord: 'STAND',
}

export default function L3trasGameConfig({ gameId, gameName, settings, onChange }: GameConfigProps) {
  const [objectiveWord, setObjectiveWord] = useState<string>(
    (settings as L3trasSettings | null)?.objectiveWord || DEFAULT_SETTINGS.objectiveWord
  )
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')

  useEffect(() => {
    if (settings) {
      const s = settings as L3trasSettings
      setObjectiveWord((s.objectiveWord || DEFAULT_SETTINGS.objectiveWord).toUpperCase())
    }
  }, [settings])

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        const backend = data.settings?.l3tras
        if (backend?.objectiveWord) {
          setObjectiveWord(backend.objectiveWord.toUpperCase())
        }
      } catch {
        // ignore
      }
    })()
    return () => { cancelled = true }
  }, [gameId])

  const handleObjectiveWordChange = (value: string) => {
    const cleaned = value.replace(/[^A-Za-z]/g, '').toUpperCase()
    setObjectiveWord(cleaned)
  }

  const handleSave = async () => {
    if (!objectiveWord || objectiveWord.length === 0) {
      alert('La palabra objetivo no puede estar vacía')
      return
    }

    const newSettings: L3trasSettings = {
      objectiveWord: objectiveWord.toUpperCase(),
    }
    onChange(newSettings)
    setSaveStatus('idle')
    setSaveMessage('')

    if (gameId) {
      setSaveStatus('saving')
      setSaveMessage('Guardando...')
      try {
        await api.put('/v1/game', {
          gameId,
          settings: {
            l3tras: {
              objectiveWord: newSettings.objectiveWord,
            },
          },
        })
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
    } else {
      setSaveStatus('success')
      setSaveMessage('Configuración guardada.')
      setTimeout(() => {
        setSaveStatus('idle')
        setSaveMessage('')
      }, 3000)
    }
  }

  const letterCount = objectiveWord.length

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configurar {gameName}</h3>
        <p className="text-sm text-gray-400">
          Define la palabra objetivo que los jugadores deben formar con sus letras (siempre en mayúsculas)
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Palabra objetivo
          </label>
          <input
            type="text"
            value={objectiveWord}
            onChange={(e) => handleObjectiveWordChange(e.target.value)}
            placeholder="STAND"
            className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none uppercase"
          />
          <p className="text-xs text-gray-400 mt-1">
            Solo letras A–Z; se guardan en mayúsculas.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.2)]">
          <p className="text-sm text-gray-300 mb-2">Vista previa:</p>
          <p className="text-lg font-semibold text-[#10B981] mb-1">
            Palabra objetivo: {objectiveWord.split('').join(' ')} ({letterCount} letras)
          </p>
          <p className="text-xs text-gray-400">
            Se requerirán {letterCount} código{letterCount !== 1 ? 's' : ''} de validación
          </p>
        </div>
      </div>

      {saveMessage && (
        <p
          className={`text-sm ${saveStatus === 'error' ? 'text-red-400' : saveStatus === 'saving' ? 'text-gray-400' : 'text-[#10B981]'}`}
        >
          {saveMessage}
        </p>
      )}

      <button
        onClick={() => void handleSave()}
        disabled={saveStatus === 'saving'}
        className="w-full p-3 rounded-xl bg-[rgba(16,185,129,0.2)] border border-[rgba(16,185,129,0.3)] hover:bg-[rgba(16,185,129,0.3)] transition-colors font-medium disabled:opacity-50"
      >
        Guardar configuración
      </button>
    </div>
  )
}
