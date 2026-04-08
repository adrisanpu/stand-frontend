import { useState } from 'react'
import { api } from '../../api/api'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { usePolling } from '../../hooks/usePolling'

interface GameDataResponse {
  ok: boolean
  game?: { gameId: string; gameName: string; gameType: string; createdAt: string; maxPlayers: number }
  playerCount?: number
  validatedCount?: number
  raffleWinners?: unknown[]
  quiz?: { enabled: boolean; questionsCount: number }
  settings?: { empareja2?: { maxValidations?: number } }
}

interface PlayersProps {
  gameName: string
  gameId?: string
  gameType?: string
  refreshInterval?: number // in milliseconds, 0 to disable
  compact?: boolean // when true (e.g. landscape sidebar), reduce padding and avoid scroll
  countersOnly?: boolean // when true (e.g. empareja2 landscape), compact card without main "Jugadores" heading
  prizeLabel?: string // e.g. "🎁 Entrada gratis" — shown below title when set
  /** Límite premio validación (localStorage; empareja2 también API) */
  maxPrizeValidationLimit?: number
}

const EMPAREJA2_SETTINGS_KEY = 'empareja2_settings_'

function getEmpareja2MaxValidations(gameId: string | undefined): number | undefined {
  if (!gameId) return undefined
  try {
    const raw = localStorage.getItem(`${EMPAREJA2_SETTINGS_KEY}${gameId}`)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    const n = parsed?.maxPrizeValidation ?? parsed?.maxValidations
    if (typeof n !== 'number' || n < 0) return undefined
    return n
  } catch {
    return undefined
  }
}

function PrizeLine({
  label,
  current,
  max,
  compact,
}: {
  label: string
  current: number
  max: number | undefined
  compact: boolean
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2 min-w-0 ${compact ? 'text-xs' : 'text-xs sm:text-sm'} text-textSub mt-2`}
    >
      <span className="min-w-0 truncate">
        Premio: {label}
      </span>
      {max !== undefined && (
        <span className="flex-shrink-0 text-[10px] sm:text-xs text-textSub tabular-nums">
          {current}/{max}
        </span>
      )}
    </div>
  )
}

export default function Players({ gameName, gameId, gameType, refreshInterval = 10000, compact = false, countersOnly = false, prizeLabel, maxPrizeValidationLimit }: PlayersProps) {
  const { plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [playerCount, setPlayerCount] = useState<number | null>(null)
  const [validatedCount, setValidatedCount] = useState<number>(0)
  const [maxValidationsFromApi, setMaxValidationsFromApi] = useState<number | undefined>(undefined)

  const maxPlayers = features.maxPlayers === Infinity ? null : features.maxPlayers
  const isEmpareja2 = gameType?.toLowerCase() === 'empareja2'
  const effectiveMax = isEmpareja2
    ? (maxValidationsFromApi ?? maxPrizeValidationLimit ?? getEmpareja2MaxValidations(gameId))
    : maxPrizeValidationLimit

  const fetchCount = async () => {
    if (!gameName) return
    const data = await api.get<GameDataResponse>(`/v1/game?gameName=${encodeURIComponent(gameName)}`)
    if (!data.ok) throw new Error('API response not ok')
    setPlayerCount(data.playerCount ?? 0)
    setValidatedCount(data.validatedCount ?? 0)
    const fromApi = data.settings?.empareja2?.maxValidations
    setMaxValidationsFromApi(
      typeof fromApi === 'number' && fromApi >= 0 ? fromApi : undefined
    )
  }

  const { isStale } = usePolling(fetchCount, [gameName], { interval: refreshInterval })

  if (playerCount === null) {
    return (
      <div className={`card rounded-xl sm:rounded-2xl shadow-neon ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6'}`}>
        {!countersOnly && (
          <>
            <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${compact ? 'text-sm' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>Jugadores</h2>
            <p className="text-textSub text-xs sm:text-sm">Cargando...</p>
          </>
        )}
        {countersOnly && <p className="text-textSub text-xs sm:text-sm">Cargando...</p>}
      </div>
    )
  }

  if (countersOnly && isEmpareja2) {
    return (
      <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex-shrink-0 ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6'}`}>
        {isStale && <span className="text-[10px] font-normal text-yellow-500 mb-1 block">● sin señal</span>}
        <div className="space-y-2">
          <div>
            <div className={`text-textSub ${compact ? 'text-xs mb-0.5' : 'text-sm mb-1'}`}>Jugadores</div>
            <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${compact ? 'text-base' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`font-bold text-[var(--color-primary)] ${compact ? 'text-base' : 'text-xl sm:text-2xl'}`}>
                  {playerCount}
                </span>
                {maxPlayers !== null && (
                  <>
                    <span className="text-textSub">/</span>
                    <span className="font-semibold text-textMain">{maxPlayers}</span>
                  </>
                )}
              </div>
              {maxPlayers !== null && playerCount >= maxPlayers && (
                <span className="text-red-400 text-xs whitespace-nowrap">Límite alcanzado</span>
              )}
            </div>
          </div>
          {prizeLabel && (
            <PrizeLine label={prizeLabel} current={validatedCount} max={effectiveMax} compact={compact} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex-shrink-0 ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6'}`}>
      <h2 className={`font-bold text-textMain flex items-center gap-2 ${compact ? 'text-sm mb-1' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>
        Jugadores
        {isStale && <span className="text-[10px] font-normal text-yellow-500">● sin señal</span>}
      </h2>
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${compact ? 'text-base' : ''}`}>
        <div className="flex items-center gap-2">
          <div className={`font-bold text-[var(--color-primary)] ${compact ? 'text-base' : 'text-2xl sm:text-3xl'}`}>
            {playerCount}
          </div>
          {maxPlayers !== null ? (
            <>
              <div className={`text-textSub ${compact ? 'text-xs' : 'text-sm sm:text-base'}`}>/</div>
              <div className={`font-semibold text-textMain ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
                {maxPlayers}
              </div>
            </>
          ) : (
            <div className={`text-textSub ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>jugadores</div>
          )}
        </div>
        {maxPlayers !== null && playerCount >= maxPlayers && (
          <span className={`text-red-400 whitespace-nowrap ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
            Límite alcanzado
          </span>
        )}
      </div>
      {prizeLabel && (
        <PrizeLine label={prizeLabel} current={validatedCount} max={effectiveMax} compact={compact} />
      )}
    </div>
  )
}
