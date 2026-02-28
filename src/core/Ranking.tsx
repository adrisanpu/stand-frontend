import { useState } from 'react'
import { api } from '../api/api'
import { usePolling } from '../hooks/usePolling'

export interface RankingEntry {
  rank?: number
  username?: string
  timer?: number
  score?: number
}

interface RankingResponse {
  ok: boolean
  gameId: string
  limit: number
  results: RankingEntry[]
}

interface RankingProps {
  gameId: string
  refreshInterval?: number // in milliseconds, 0 to disable
}

export default function Ranking({ gameId, refreshInterval = 10000 }: RankingProps) {
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null)

  const fetchRanking = async () => {
    if (!gameId) return
    const data = await api.get<RankingResponse>(`/v1/game/score?gameId=${encodeURIComponent(gameId)}&limit=10`)
    if (!data.ok) throw new Error('API response not ok')
    setRanking(Array.isArray(data.results) ? data.results : [])
  }

  const { isStale } = usePolling(fetchRanking, [gameId], { interval: refreshInterval })

  if (ranking === null) {
    return (
      <div className="card rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-neon">
        <h2 className="text-lg sm:text-xl font-bold text-textMain mb-2 sm:mb-4">Ranking</h2>
        <p className="text-textSub text-sm sm:text-base">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="card rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-neon h-full flex flex-col">
      <h2 className="text-lg sm:text-xl font-bold text-textMain mb-2 sm:mb-4 flex items-center gap-2">
        Ranking
        {isStale && <span className="text-[10px] font-normal text-yellow-500">● sin señal</span>}
      </h2>
      <div className="flex-1 overflow-y-auto space-y-1 sm:space-y-2">
        {ranking.length === 0 ? (
          <p className="text-textSub text-xs sm:text-sm">No hay puntuaciones aún</p>
        ) : (
          ranking.map((entry, index) => (
            <div
              key={entry.rank || index}
              className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-surface border border-white/10"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <span className="text-[var(--color-primary)] font-bold text-base sm:text-lg w-5 sm:w-6 flex-shrink-0">
                  {entry.rank || index + 1}
                </span>
                <span className="text-textMain font-medium text-xs sm:text-sm truncate">
                  {entry.username || 'Anónimo'}
                </span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-textMain font-semibold text-xs sm:text-sm">
                  {entry.timer !== undefined && typeof entry.timer === 'number'
                    ? `${entry.timer.toFixed(3)}s`
                    : 'N/A'}
                </div>
                {entry.score !== undefined && typeof entry.score === 'number' && (
                  <div className="text-textSub text-[10px] sm:text-xs">
                    {entry.score.toFixed(0)}ms
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
