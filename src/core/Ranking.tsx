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

const T1MER_USERNAME_MAX_LEN = 20

interface RankingProps {
  gameId: string
  refreshInterval?: number // in milliseconds, 0 to disable
  compact?: boolean // when true (e.g. landscape sidebar), reduce padding and show fewer items
  prizeLabel?: string // e.g. "🎁 Merchandising" — shown below title when set
  topX?: number // e.g. 3 — "Premio top 3: {prizeLabel}"
  gameType?: string // when "T1MER", show only position + username (truncated), no timer/score
}

function truncateUsername(username: string | undefined, maxLen: number): string {
  const raw = username || 'Anónimo'
  if (raw.length <= maxLen) return raw
  return raw.slice(0, maxLen) + '...'
}

export default function Ranking({ gameId, refreshInterval = 10000, compact = false, prizeLabel, topX, gameType }: RankingProps) {
  const isT1mer = (gameType || '').toUpperCase() === 'T1MER'
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null)

  const fetchRanking = async () => {
    if (!gameId) return
    const limit = topX != null ? topX : 10
    const data = await api.get<RankingResponse>(`/v1/game/score?gameId=${encodeURIComponent(gameId)}&limit=${limit}`)
    if (!data.ok) throw new Error('API response not ok')
    setRanking(Array.isArray(data.results) ? data.results : [])
  }

  const { isStale } = usePolling(fetchRanking, [gameId, topX], { interval: refreshInterval })

  if (ranking === null) {
    return (
      <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col min-h-0 ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6'}`}>
        <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${compact ? 'text-sm' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>Ranking</h2>
        <p className="text-textSub text-xs sm:text-sm">Cargando...</p>
      </div>
    )
  }

  const displayList = topX != null ? ranking : compact ? ranking.slice(0, 4) : ranking

  return (
    <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6 min-h-0 flex-1 overflow-hidden'}`}>
      <h2 className={`font-bold text-textMain flex items-center gap-2 flex-shrink-0 ${compact ? 'text-sm mb-1' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>
        Ranking
        {isStale && <span className="text-[10px] font-normal text-yellow-500">● sin señal</span>}
      </h2>
      {prizeLabel && (
        <p className={`text-textSub flex-shrink-0 mb-1 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>
          {topX != null ? `Premio top ${topX}: ${prizeLabel}` : `Premio: ${prizeLabel}`}
        </p>
      )}
      <div className={`min-h-0 overflow-y-auto ${compact ? 'space-y-0.5 min-w-0 max-h-40' : 'flex-1 max-h-64 space-y-1 sm:space-y-2'}`}>
        {ranking.length === 0 ? (
          <p className={`text-textSub ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>No hay puntuaciones aún</p>
        ) : (
          displayList.map((entry, index) => (
            <div
              key={entry.rank || index}
              className={`flex items-center justify-between rounded-lg bg-surface border border-white/10 min-w-0 ${compact ? 'p-1.5 gap-1' : 'p-2 sm:p-3 gap-2 sm:gap-3'}`}
            >
              <div className="flex items-center min-w-0 flex-1 gap-2 sm:gap-3 overflow-hidden">
                <span className={`text-[var(--color-primary)] font-bold flex-shrink-0 ${compact ? 'text-base w-5' : 'text-base sm:text-lg w-5 sm:w-6'}`}>
                  {entry.rank || index + 1}
                </span>
                <span className={`text-textMain font-medium min-w-0 flex items-baseline gap-1.5 overflow-hidden ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`} title={entry.username || undefined}>
                  <span className="truncate">{isT1mer ? truncateUsername(entry.username, T1MER_USERNAME_MAX_LEN) : (entry.username || 'Anónimo')}</span>
                </span>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <div className="text-textMain font-semibold text-[14px]">
                  {entry.timer !== undefined && typeof entry.timer === 'number'
                    ? `${entry.timer.toFixed(3)}s`
                    : 'N/A'}
                </div>
                {!isT1mer && entry.score !== undefined && typeof entry.score === 'number' && (
                  <div className={`text-textSub ${compact ? 'text-xs' : 'text-[10px] sm:text-xs'}`}>
                    {entry.score.toFixed(0)}ms
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {compact && ranking.length > 4 && topX == null && (
          <p className="text-textSub text-xs pt-0.5">+{ranking.length - 4} más</p>
        )}
      </div>
    </div>
  )
}
