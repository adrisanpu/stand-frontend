import { useEffect, useState } from 'react'
import { api } from '../api/api'
import { useCurrentUser } from '../auth/useCurrentUser'
import { getFeaturesByPlan } from '../auth/featureFlags'

interface QuizDataResponse {
  ok: boolean
  gameId: string
  questions?: Array<{
    id: string
    text: string
    options: Array<{
      title: string
      payload: string
      answerId: string
    }>
  }>
  players: Array<{
    playerId: number
    instagramPSID: string
    instagramUsername: string
    quizCompleted: boolean
    quizCurrentQuestion: string | null
    quizAnswers: Record<string, string>
  }>
}

async function getPlayerCount(gameId: string): Promise<number> {
  try {
    // Get player count from quiz endpoint
    const data = await api.get<QuizDataResponse>(`/quizz?gameId=${encodeURIComponent(gameId)}`)
    
    if (data.ok && Array.isArray(data.players)) {
      // Count unique players by instagramPSID (in case there are duplicates)
      const uniquePlayers = new Set(data.players.map(p => p.instagramPSID).filter(Boolean))
      return uniquePlayers.size
    }
    
    return 0
  } catch (error) {
    console.error('Error fetching player count:', error)
    return 0
  }
}

interface PlayersProps {
  gameId: string
  refreshInterval?: number // in milliseconds, 0 to disable
}

export default function Players({ gameId, refreshInterval = 10000 }: PlayersProps) {
  const { plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [playerCount, setPlayerCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const maxPlayers = features.maxPlayers === Infinity ? null : features.maxPlayers

  const loadPlayerCount = async () => {
    if (!gameId) return

    try {
      const count = await getPlayerCount(gameId)
      setPlayerCount(count)
      setLoading(false)
    } catch (error) {
      console.error('Error loading player count:', error)
      setPlayerCount(0)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (gameId) {
      loadPlayerCount()
      
      // Refresh player count at specified interval
      if (refreshInterval > 0) {
        const interval = setInterval(loadPlayerCount, refreshInterval)
        return () => clearInterval(interval)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, refreshInterval])

  if (loading) {
    return (
      <div className="card rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-neon">
        <h2 className="text-lg sm:text-xl font-bold text-textMain mb-2 sm:mb-4">Jugadores</h2>
        <p className="text-textSub text-sm sm:text-base">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="card rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-neon">
      <h2 className="text-lg sm:text-xl font-bold text-textMain mb-2 sm:mb-4">Jugadores</h2>
      <div className="flex items-center gap-2">
        <div className="text-2xl sm:text-3xl font-bold text-[var(--color-primary)]">
          {playerCount}
        </div>
        {maxPlayers !== null ? (
          <>
            <div className="text-textSub text-sm sm:text-base">/</div>
            <div className="text-lg sm:text-xl font-semibold text-textMain">
              {maxPlayers}
            </div>
          </>
        ) : (
          <div className="text-textSub text-xs sm:text-sm">jugadores</div>
        )}
      </div>
      {maxPlayers !== null && playerCount >= maxPlayers && (
        <p className="text-xs sm:text-sm text-red-400 mt-2">
          Límite alcanzado
        </p>
      )}
    </div>
  )
}
