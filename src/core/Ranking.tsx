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
  maxPrizeRanking?: number // límite mostrado como current/max junto al premio
  gameType?: string // when "T1MER", show only position + username (truncated), no timer/score
}

function truncateUsername(username: string | undefined, maxLen: number): string {
  const raw = username || 'Anónimo'
  if (raw.length <= maxLen) return raw
  return raw.slice(0, maxLen) + '...'
}

function rankingFetchLimit(topX: number | undefined, maxPrizeRanking: number | undefined): number {
  const topXN = topX != null ? topX : 10
  if (maxPrizeRanking != null) {
    return Math.max(topXN, maxPrizeRanking, 10)
  }
  return topX != null ? topX : 10
}

export default function Ranking({
  gameId,
  refreshInterval = 10000,
  compact = false,
  prizeLabel,
  topX,
  maxPrizeRanking,
  gameType,
}: RankingProps) {
  const isT1mer = (gameType || '').toUpperCase() === 'T1MER'
  const [ranking, setRanking] = useState<RankingEntry[] | null>(null)

  const limit = rankingFetchLimit(topX, maxPrizeRanking)

  const fetchRanking = async () => {
    if (!gameId) return
    const data = await api.get<RankingResponse>(
      `/v1/game/score?gameId=${encodeURIComponent(gameId)}&limit=${limit}`
    )
    if (!data.ok) throw new Error('API response not ok')
    setRanking(Array.isArray(data.results) ? data.results : [])
  }

  const { isStale } = usePolling(fetchRanking, [gameId, topX, maxPrizeRanking], { interval: refreshInterval })

  const displayCap = topX != null ? topX : ranking?.length ?? 0
  const displayList =
    ranking == null ? [] : ranking.slice(0, Math.min(displayCap, ranking.length))

  if (ranking === null) {
    return (
      <div
        className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col min-h-0 h-full ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden flex-1' : 'p-3 sm:p-4 lg:p-6 flex-1'}`}
      >
        <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${compact ? 'text-sm' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>Ranking</h2>
        <p className="text-textSub text-xs sm:text-sm">Cargando...</p>
      </div>
    )
  }

  const fullCount = ranking.length
  const showPrizeFraction = maxPrizeRanking !== undefined && prizeLabel

  return (
    <div
      className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col min-h-0 h-full ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden flex-1' : 'p-3 sm:p-4 lg:p-6 flex-1 overflow-hidden'}`}
    >
      <h2 className={`font-bold text-textMain flex items-center gap-2 flex-shrink-0 ${compact ? 'text-sm mb-1' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>
        Ranking
        {isStale && <span className="text-[10px] font-normal text-yellow-500">● sin señal</span>}
      </h2>
      {prizeLabel && (
        <div
          className={`text-textSub flex-shrink-0 mb-1 flex items-baseline justify-between gap-2 min-w-0 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}
        >
          <span className="min-w-0 truncate">
            {topX != null ? `Premio top ${topX}: ${prizeLabel}` : `Premio: ${prizeLabel}`}
          </span>
          {showPrizeFraction && (
            <span className="flex-shrink-0 text-[10px] sm:text-xs tabular-nums">
              {fullCount}/{maxPrizeRanking}
            </span>
          )}
        </div>
      )}
      <div
        className={`min-h-0 overflow-y-auto flex-1 ${compact ? 'space-y-0.5 min-w-0' : 'space-y-1 sm:space-y-2'}`}
      >
        {displayList.length === 0 ? (
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
        {!compact && topX == null && ranking.length > displayList.length && (
          <p className="text-textSub text-xs pt-0.5">+{ranking.length - displayList.length} más</p>
        )}
      </div>
    </div>
  )
}
