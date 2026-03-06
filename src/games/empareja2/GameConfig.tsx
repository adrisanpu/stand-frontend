import { useState, useEffect } from 'react'
import type { GameConfigProps } from '../../core/types'
import { api } from '../../api/api'

export type Empareja2Settings = {
  maxValidations?: number
  numPairs?: number
  estimatedPlayers?: number
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
  const [estimatedPlayersInput, setEstimatedPlayersInput] = useState<string>(
    (settings as Empareja2Settings | null)?.estimatedPlayers != null
      ? String((settings as Empareja2Settings).estimatedPlayers)
      : ''
  )
  const [catalogPairCount, setCatalogPairCount] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      const s = settings as Empareja2Settings
      setMaxValidationsInput(s.maxValidations != null ? String(s.maxValidations) : '')
      setNumPairsInput(s.numPairs != null ? String(s.numPairs) : '')
      setEstimatedPlayersInput(s.estimatedPlayers != null ? String(s.estimatedPlayers) : '')
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
    const trimmedEst = estimatedPlayersInput.trim()
    const maxValidations = trimmedMax === '' ? undefined : Math.max(0, Math.floor(Number(trimmedMax)) || 0)
    const numPairs = trimmedNum === '' ? undefined : Math.max(1, Math.floor(Number(trimmedNum)) || 1)
    const estimatedPlayers = trimmedEst === '' ? undefined : Math.max(0, Math.floor(Number(trimmedEst)) || 0)
    const maxPairs = catalogPairCount ?? 99
    const numPairsClamped = numPairs == null ? undefined : Math.min(numPairs, maxPairs)

    const newSettings: Empareja2Settings = {
      maxValidations,
      numPairs: numPairsClamped,
      estimatedPlayers: estimatedPlayers || undefined,
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

  const estimatedNum = estimatedPlayersInput.trim() === '' ? null : Math.floor(Number(estimatedPlayersInput)) || 0
  const approxPremios = estimatedNum != null && estimatedNum >= 0 ? Math.floor(estimatedNum / 2) : null
  const maxPairs = catalogPairCount ?? 99

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configurar {gameName}</h3>
        <p className="text-sm text-gray-400">
          Máximo de validaciones (premios), dificultad para encontrar pareja y estimación de premios.
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
          <input
            type="number"
            min={1}
            max={maxPairs}
            step={1}
            value={numPairsInput}
            onChange={(e) => setNumPairsInput(e.target.value)}
            placeholder="Todas"
            className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Número de parejas de personajes a usar (de {catalogPairCount ?? '—'} en sistema). Menos parejas = más
            fácil (la misma pareja se asigna a más jugadores). Más parejas = más difícil.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Estimación de jugadores
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={estimatedPlayersInput}
            onChange={(e) => setEstimatedPlayersInput(e.target.value)}
            placeholder="Opcional"
            className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-base focus:border-white/20 focus:outline-none"
          />
          {approxPremios != null && (
            <p className="text-sm text-gray-300 mt-2">
              Aproximadamente necesitarás <strong>{approxPremios}</strong> premios (parejas que validarán).
              {' '}
              <button
                type="button"
                onClick={() => setMaxValidationsInput(String(approxPremios))}
                className="underline hover:no-underline text-neonMagenta focus:outline-none"
              >
                Usar como máximo de validaciones
              </button>
            </p>
          )}
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
