import { useState } from 'react'
import { api } from '../api/api'
import { useCurrentUser } from '../auth/useCurrentUser'
import { getFeaturesByPlan } from '../auth/featureFlags'
import { usePolling } from '../hooks/usePolling'

interface GameDataResponse {
  ok: boolean
  game?: { gameId: string; gameName: string; gameType: string; createdAt: string; maxPlayers: number }
  playerCount?: number
  validatedCount?: number
  raffleWinners?: unknown[]
  quiz?: { enabled: boolean; questionsCount: number }
}

interface PlayersProps {
  gameName: string
  refreshInterval?: number // in milliseconds, 0 to disable
  compact?: boolean // when true (e.g. landscape sidebar), reduce padding and avoid scroll
}

export default function Players({ gameName, refreshInterval = 10000, compact = false }: PlayersProps) {
  const { plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [playerCount, setPlayerCount] = useState<number | null>(null)

  const maxPlayers = features.maxPlayers === Infinity ? null : features.maxPlayers

  const fetchCount = async () => {
    if (!gameName) return
    const data = await api.get<GameDataResponse>(`/v1/game?gameName=${encodeURIComponent(gameName)}`)
    if (!data.ok) throw new Error('API response not ok')
    setPlayerCount(data.playerCount ?? 0)
  }

  const { isStale } = usePolling(fetchCount, [gameName], { interval: refreshInterval })

  if (playerCount === null) {
    return (
      <div className={`card rounded-xl sm:rounded-2xl shadow-neon ${compact ? 'p-2 sm:p-3' : 'p-3 sm:p-4 lg:p-6'}`}>
        <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${compact ? 'text-sm' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>Jugadores</h2>
        <p className="text-textSub text-xs sm:text-sm">Cargando...</p>
      </div>
    )
  }

  return (
    <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex-shrink-0 ${compact ? 'p-2 sm:p-3' : 'p-3 sm:p-4 lg:p-6'}`}>
      <h2 className={`font-bold text-textMain flex items-center gap-2 ${compact ? 'text-sm mb-1' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>
        Jugadores
        {isStale && <span className="text-[10px] font-normal text-yellow-500">● sin señal</span>}
      </h2>
      <div className={`flex items-center gap-2 ${compact ? 'text-base' : ''}`}>
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
        <p className={`text-red-400 mt-2 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
          Límite alcanzado
        </p>
      )}
    </div>
  )
}
