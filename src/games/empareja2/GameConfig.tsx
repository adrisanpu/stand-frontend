import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'

export type Empareja2Settings = {
  numPairs?: number
}

interface GameDataResponse {
  ok: boolean
  game?: { gameId: string; gameName: string; gameType: string }
  settings?: { empareja2?: { numPairs?: number } }
  empareja2CatalogPairCount?: number
}

export default function Empareja2GameConfig({ gameId, gameName: _gameName, settings, onChange }: GameConfigProps) {
  const [numPairsInput, setNumPairsInput] = useState<string>(
    (settings as Empareja2Settings | null)?.numPairs != null
      ? String((settings as Empareja2Settings).numPairs)
      : ''
  )
  const [catalogPairCount, setCatalogPairCount] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [saveMessage, setSaveMessage] = useState<string>('')

  useEffect(() => {
    if (settings) {
      const s = settings as Empareja2Settings
      setNumPairsInput(s.numPairs != null ? String(s.numPairs) : '')
    }
  }, [settings])

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        if (data.empareja2CatalogPairCount != null) setCatalogPairCount(data.empareja2CatalogPairCount)
        const backend = data.settings?.empareja2
        if (backend?.numPairs != null) setNumPairsInput(String(backend.numPairs))
      } catch {
        // ignore; keep UI working with localStorage only
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId])

  const handleSave = async () => {
    const trimmedNum = numPairsInput.trim()
    const maxPairs = catalogPairCount ?? 50
    const numPairs = trimmedNum === '' ? maxPairs : Math.max(1, Math.floor(Number(trimmedNum)) || 1)
    const numPairsClamped = Math.min(numPairs, maxPairs)

    const newSettings: Empareja2Settings = {
      numPairs: numPairsClamped,
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
            empareja2: {
              numPairs: numPairsClamped,
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

  const maxPairs = catalogPairCount ?? 1
  const numPairsValue =
    numPairsInput.trim() === ''
      ? maxPairs
      : Math.min(maxPairs, Math.max(1, Math.floor(Number(numPairsInput)) || 1))
  const sliderDisabled = catalogPairCount == null

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Los premios y el máximo de validaciones están en Ajustes → Premios.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Dificultad para encontrar a tu pareja
          </label>
          {sliderDisabled ? (
            <p className="text-sm text-gray-500 py-2">Cargando número de parejas del catálogo...</p>
          ) : (
            <>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>+fácil</span>
                <span>+difícil</span>
              </div>
              <input
                type="range"
                min={1}
                max={maxPairs}
                value={numPairsValue}
                onChange={(e) => setNumPairsInput(e.target.value)}
                disabled={sliderDisabled}
                className="empareja2-difficulty-slider w-full h-3 rounded-full appearance-none bg-[rgba(255,255,255,0.1)] border border-white/10 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Número de parejas (dificultad)"
              />
              <p className="text-sm text-gray-300 mt-2">
                <strong>{numPairsValue}</strong> pareja{numPairsValue !== 1 ? 's' : ''} seleccionada{numPairsValue !== 1 ? 's' : ''}.
              </p>
            </>
          )}
        </div>
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
          {saveMessage}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saveStatus === 'saving'}
        className="w-full p-3 rounded-xl bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.3)] hover:bg-[rgba(176,38,255,0.3)] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saveStatus === 'saving' ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
