import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'

export type Empareja2Settings = {
  maxValidations?: number
  numPairs?: number
}

interface GameDataResponse {
  ok: boolean
  game?: { gameId: string; gameName: string; gameType: string }
  settings?: { empareja2?: { numPairs?: number; maxValidations?: number } }
  empareja2CatalogPairCount?: number
}

export default function Empareja2GameConfig({ gameId, gameName, settings, onChange }: GameConfigProps) {
  const [maxValidationsInput, setMaxValidationsInput] = useState<string>(
    (settings as Empareja2Settings | null)?.maxValidations != null
      ? String((settings as Empareja2Settings).maxValidations)
      : ''
  )
  const [numPairsInput, setNumPairsInput] = useState<string>(
    (settings as Empareja2Settings | null)?.numPairs != null
      ? String((settings as Empareja2Settings).numPairs)
      : ''
  )
  const [catalogPairCount, setCatalogPairCount] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      const s = settings as Empareja2Settings
      setMaxValidationsInput(s.maxValidations != null ? String(s.maxValidations) : '')
      setNumPairsInput(s.numPairs != null ? String(s.numPairs) : '')
    }
  }, [settings])

  // Load catalog pair count and backend settings when gameId is available
  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await api.get<GameDataResponse>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled || !data.ok) return
        if (data.empareja2CatalogPairCount != null) setCatalogPairCount(data.empareja2CatalogPairCount)
        const backend = data.settings?.empareja2
        if (backend) {
          if (backend.maxValidations != null) setMaxValidationsInput(String(backend.maxValidations))
          if (backend.numPairs != null) setNumPairsInput(String(backend.numPairs))
        }
      } catch {
        // ignore; keep UI working with localStorage only
      }
    })()
    return () => { cancelled = true }
  }, [gameId])

  const handleSave = async () => {
    const trimmedMax = maxValidationsInput.trim()
    const trimmedNum = numPairsInput.trim()
    const maxPairs = catalogPairCount ?? 50
    const maxValidations = trimmedMax === '' ? undefined : Math.max(0, Math.floor(Number(trimmedMax)) || 0)
    const numPairs = trimmedNum === '' ? maxPairs : Math.max(1, Math.floor(Number(trimmedNum)) || 1)
    const numPairsClamped = Math.min(numPairs, maxPairs)

    const newSettings: Empareja2Settings = {
      maxValidations,
      numPairs: numPairsClamped,
    }
    onChange(newSettings)
    setSaveError(null)

    if (gameId && (maxValidations !== undefined || numPairsClamped !== undefined)) {
      try {
        await api.put('/v1/game', {
          gameId,
          settings: {
            empareja2: {
              ...(maxValidations !== undefined && { maxValidations }),
              ...(numPairsClamped !== undefined && { numPairs: numPairsClamped }),
            },
          },
        })
      } catch (e: any) {
        setSaveError(e?.message || 'Error al guardar en el servidor')
      }
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
      <div>
        <h3 className="text-lg font-semibold mb-2">Configurar {gameName}</h3>
        <p className="text-sm text-gray-400">
          Máximo de validaciones (premios) y dificultad para encontrar pareja.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Máximo de validaciones (premios)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={maxValidationsInput}
            onChange={(e) => setMaxValidationsInput(e.target.value)}
            placeholder="Sin límite"
            className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Dejar vacío para no mostrar límite. En el minicontenedor se mostrará «Validadas X / máximo».
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Dificultad para encontrar a tu pareja
          </label>
          {sliderDisabled ? (
            <p className="text-sm text-gray-500 py-2">Cargando número de parejas del catálogo...</p>
          ) : (
            <>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>1 pareja (+fácil)</span>
                <span>{maxPairs} parejas (+difícil)</span>
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
          <p className="text-xs text-gray-400 mt-1">
            Menos parejas = más fácil (la misma pareja se asigna a más jugadores). Más parejas = más difícil.
          </p>
        </div>
      </div>

      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
          {saveError}
        </div>
      )}

      <button
        onClick={handleSave}
        className="w-full p-3 rounded-xl bg-[rgba(176,38,255,0.2)] border border-[rgba(176,38,255,0.3)] hover:bg-[rgba(176,38,255,0.3)] transition-colors font-medium"
      >
        Guardar configuración
      </button>
    </div>
  )
}
