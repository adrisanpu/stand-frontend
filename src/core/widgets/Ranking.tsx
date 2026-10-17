import { useState } from 'react'
import { api } from '../../api/api'
import { normalizeGameType } from '../gameTypeMap'
import { usePolling } from '../../hooks/usePolling'
import ProfileAvatar from './ProfileAvatar'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import type { GamePrize } from '../prizes'
import { PrizeImage } from './PrizePresentation'

export interface RankingEntry {
  rank?: number
  username?: string
  profilePicUrl?: string
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
const DEFAULT_DISPLAY_COUNT = 10

interface RankingProps {
  gameId: string
  refreshInterval?: number // in milliseconds, 0 to disable
  compact?: boolean // when true (e.g. landscape sidebar), reduce padding and show fewer items
  prizeLabel?: string // e.g. "🎁 Merchandising" — shown below title when set
  prize?: GamePrize
  topX?: number // e.g. 3 — "Premio top 3: {prizeLabel}"
  maxPrizeRanking?: number // límite mostrado como current/max junto al premio
  gameType?: string // when "T1MER", show only position + username (truncated), no timer/score
}

function truncateUsername(username: string | undefined, maxLen: number, anonymous: string): string {
  const raw = username || anonymous
  if (raw.length <= maxLen) return raw
  return raw.slice(0, maxLen) + '...'
}

function rankingFetchLimit(topX: number | undefined, maxPrizeRanking: number | undefined): number {
  return Math.max(DEFAULT_DISPLAY_COUNT, topX ?? 0, maxPrizeRanking ?? 0)
}

export default function Ranking({
  gameId,
  refreshInterval = 10000,
  compact = false,
  prizeLabel: legacyPrizeLabel,
  prize,
  topX: legacyTopX,
  maxPrizeRanking: legacyMax,
  gameType,
}: RankingProps) {
  const { t } = useOperatorLanguage()
  const prizeLabel = prize ? prize.name : legacyPrizeLabel
  const topX = prize ? prize.topX : legacyTopX
  const maxPrizeRanking = prize ? prize.limit ?? undefined : legacyMax
  const isT1mer = normalizeGameType(gameType) === 'T1MER'
  const isStack = normalizeGameType(gameType) === 'STACK'
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

  const displayList =
    ranking == null ? [] : ranking.slice(0, Math.min(DEFAULT_DISPLAY_COUNT, ranking.length))

  if (ranking === null) {
    return (
      <div
        className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col min-h-0 h-full ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden flex-1' : 'p-3 sm:p-4 lg:p-6 flex-1'}`}
      >
        <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${compact ? 'text-sm' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>{t('Ranking', 'Leaderboard')}</h2>
        <p className="text-textSub text-xs sm:text-sm">{t('Cargando...', 'Loading...')}</p>
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
        {t('Ranking', 'Leaderboard')}
        {isStale && <span className="text-[10px] font-normal text-yellow-500">● {t('sin señal', 'offline')}</span>}
      </h2>
      {(prizeLabel || prize?.imageUrl) && (
        <div
          className={`text-textSub flex-shrink-0 mb-1 flex items-center justify-between gap-2 min-w-0 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}
        >
          <PrizeImage prize={prize} compact />
          <span className="min-w-0 truncate">
            {topX != null ? `${t('Premio top', 'Top prize')} ${topX}: ${prizeLabel}` : `${t('Premio', 'Prize')}: ${prizeLabel}`}
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
          <p className={`text-textSub ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>{t('No hay puntuaciones aún', 'No scores yet')}</p>
        ) : (
          displayList.map((entry, index) => {
            const rank = entry.rank || index + 1
            const isPrizeRow = topX != null && rank <= topX
            return (
              <div
                key={entry.rank || index}
                className={`flex items-center justify-between rounded-lg min-w-0 ${
                  compact ? 'p-1.5 gap-1' : 'p-2 sm:p-3 gap-2 sm:gap-3'
                } ${
                  isPrizeRow
                    ? 'bg-primary/10 border border-primary/40'
                    : 'bg-surface border border-white/10'
                }`}
              >
                <div className="flex items-center min-w-0 flex-1 gap-2 sm:gap-3 overflow-hidden">
                  <span className={`text-[var(--color-primary)] font-bold flex-shrink-0 ${compact ? 'text-base w-5' : 'text-base sm:text-lg w-5 sm:w-6'}`}>
                    {rank}
                  </span>
                  <ProfileAvatar profilePicUrl={entry.profilePicUrl} username={entry.username} size={compact ? 'sm' : 'md'} />
                  <span className={`text-textMain font-medium min-w-0 flex items-baseline gap-1.5 overflow-hidden ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`} title={entry.username || undefined}>
                    <span className="truncate">{isT1mer ? truncateUsername(entry.username, T1MER_USERNAME_MAX_LEN, t('Anónimo', 'Anonymous')) : (entry.username || t('Anónimo', 'Anonymous'))}</span>
                    {isPrizeRow && (
                      <span className="flex-shrink-0 text-[10px] sm:text-xs text-primary" aria-label={t('Premio', 'Prize')}>
                        🎁
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-textMain font-semibold text-[14px]">
                    {isStack && typeof entry.score === 'number'
                      ? `${entry.score} ${t('bloques', 'blocks')}`
                      : entry.timer !== undefined && typeof entry.timer === 'number'
                      ? `${entry.timer.toFixed(3)}s`
                      : 'N/A'}
                  </div>
                  {!isT1mer && !isStack && entry.score !== undefined && typeof entry.score === 'number' && (
                    <div className={`text-textSub ${compact ? 'text-xs' : 'text-[10px] sm:text-xs'}`}>
                      {entry.score.toFixed(0)}ms
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        {ranking.length > displayList.length && (
          <p className={`text-textSub ${compact ? 'text-[10px]' : 'text-xs'} pt-0.5`}>
            +{ranking.length - displayList.length} {t('más', 'more')}
          </p>
        )}
      </div>
    </div>
  )
}
