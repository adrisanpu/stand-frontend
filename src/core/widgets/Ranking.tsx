import { useState } from 'react'
import { api } from '../../api/api'
import { normalizeGameType } from '../gameTypeMap'
import { usePolling } from '../../hooks/usePolling'
import ProfileAvatar from './ProfileAvatar'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import type { GamePrize } from '../prizes'
import { HOME_TITLE_TEXT, HOME_BODY_TEXT } from '../ui/homeTypography'

export interface RankingEntry {
  rank?: number
  username?: string
  profilePicUrl?: string | null
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
  prize?: GamePrize
  topX?: number // highlights the top X rows as prize positions
  maxPrizeRanking?: number // ensures enough rows are fetched for the prize limit
  gameType?: string // when "T1MER", show only position + username (truncated), no timer/score
  showAvatars?: boolean // profile photos are shown only when the game asks participants for one
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
  prize,
  topX: legacyTopX,
  maxPrizeRanking: legacyMax,
  gameType,
  showAvatars = false,
}: RankingProps) {
  const { t } = useOperatorLanguage()
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
        <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${HOME_TITLE_TEXT}`}>{t('Ranking', 'Leaderboard')}</h2>
        <p className={`text-textSub ${HOME_BODY_TEXT}`}>{t('Cargando...', 'Loading...')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 flex-1">
    <div
      className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col min-h-0 flex-1 overflow-hidden ${compact ? 'p-2 sm:p-3 min-w-0' : 'p-3 sm:p-4 lg:p-6'}`}
    >
      <h2 className={`font-bold text-textMain flex flex-wrap items-center gap-2 flex-shrink-0 ${HOME_TITLE_TEXT} ${compact ? 'mb-1' : 'mb-2 sm:mb-4'}`}>
        {t('Ranking', 'Leaderboard')}
        {isStale && <span className={`${HOME_BODY_TEXT} font-normal text-yellow-500`}>● {t('sin señal', 'offline')}</span>}
      </h2>
      <div
        className={`min-h-0 overflow-y-auto flex-1 ${compact ? 'space-y-0.5 min-w-0' : 'space-y-1 sm:space-y-2'}`}
      >
        {displayList.length === 0 ? (
          <p className={`text-textSub ${HOME_BODY_TEXT}`}>{t('No hay puntuaciones aún', 'No scores yet')}</p>
        ) : (
          displayList.map((entry, index) => {
            const rank = entry.rank || index + 1
            const isPrizeRow = topX != null && rank <= topX
            const name = isT1mer
              ? truncateUsername(entry.username, T1MER_USERNAME_MAX_LEN, t('Anónimo', 'Anonymous'))
              : (entry.username || t('Anónimo', 'Anonymous'))
            return (
                <div
                  key={entry.rank || index}
                  className={`home-ranking-row flex items-center rounded-lg min-w-0 ${
                  compact ? 'px-2 py-1.5 gap-2' : 'px-2.5 py-2 sm:px-3 sm:py-2.5 gap-2 sm:gap-3'
                    } ${
                  isPrizeRow
                      ? 'bg-primary/10 border border-primary/40'
                      : 'bg-surface border border-white/10'
                    }`}
                >
                  <span className={`home-ranking-rank text-[var(--color-primary)] font-bold flex-shrink-0 text-center tabular-nums ${HOME_BODY_TEXT} ${compact ? 'w-5' : 'w-6'}`}>
                    {rank}
                  </span>
                  {showAvatars && <ProfileAvatar profilePicUrl={entry.profilePicUrl} username={entry.username} size={compact ? 'sm' : 'md'} className="home-ranking-avatar" />}
                  <span className="min-w-0 flex-1" title={entry.username || undefined}>
                    <span className={`home-ranking-name block truncate text-textMain font-medium leading-tight ${HOME_BODY_TEXT}`}>{name}</span>
                  </span>
                  <span className="home-ranking-score flex items-center flex-shrink-0 whitespace-nowrap" data-testid="ranking-score">
                    <span className="home-ranking-value text-textMain font-bold tabular-nums text-base leading-none">
                      {isStack
                        ? (typeof entry.score === 'number' ? entry.score : '–')
                        : (typeof entry.timer === 'number' ? entry.timer.toFixed(3) : '–')}
                    </span>
                  </span>
                </div>
              )
            })
          )}
          {ranking.length > displayList.length && (
            <p className={`text-textSub ${HOME_BODY_TEXT} pt-0.5`}>
              +{ranking.length - displayList.length} {t('más', 'more')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
