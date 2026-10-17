import { useState } from 'react'
import { api } from '../../api/api'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { normalizeGameType } from '../gameTypeMap'
import { usePolling } from '../../hooks/usePolling'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import type { GamePrize } from '../prizes'
import PrizeSticker from './PrizeSticker'
import { HOME_TITLE_TEXT, HOME_BODY_TEXT } from '../ui/homeTypography'

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
  prizeLabel?: string // Legacy prize name, shown in the prize sticker
  prize?: GamePrize
  /** Límite premio validación (localStorage; empareja2 también API) */
  maxPrizeValidationLimit?: number
}

const EMPAREJA2_SETTINGS_KEY = 'EMPAREJA2_settings_'

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

export default function Players({ gameName, gameId, gameType, refreshInterval = 10000, compact = false, countersOnly = false, prizeLabel: legacyPrizeLabel, prize, maxPrizeValidationLimit }: PlayersProps) {
  const { t } = useOperatorLanguage()
  const { plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)
  const [playerCount, setPlayerCount] = useState<number | null>(null)
  const [validatedCount, setValidatedCount] = useState<number>(0)
  const [maxValidationsFromApi, setMaxValidationsFromApi] = useState<number | undefined>(undefined)

  const maxPlayers = features.maxPlayers === Infinity ? null : features.maxPlayers
  const isEmpareja2 = normalizeGameType(gameType) === 'EMPAREJA2'
  const prizeLabel = prize ? prize.name : legacyPrizeLabel
  const effectiveMax = prize ? prize.limit ?? undefined : isEmpareja2
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
            <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${HOME_TITLE_TEXT}`}>{t('Jugadores', 'Players')}</h2>
            <p className={`text-textSub ${HOME_BODY_TEXT}`}>{t('Cargando...', 'Loading...')}</p>
          </>
        )}
        {countersOnly && <p className={`text-textSub ${HOME_BODY_TEXT}`}>{t('Cargando...', 'Loading...')}</p>}
      </div>
    )
  }

  if (countersOnly && isEmpareja2) {
    return (
      <div className="flex flex-col shrink-0 min-w-0">
        <PrizeSticker label={prizeLabel} prize={prize} current={validatedCount} max={effectiveMax} compact={compact} />
        <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex-shrink-0 ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6'}`}>
          {isStale && <span className={`${HOME_BODY_TEXT} font-normal text-yellow-500 mb-1 block`}>● {t('sin señal', 'offline')}</span>}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col items-start gap-1 text-left">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className={`font-bold tabular-nums text-[var(--color-primary)] ${HOME_TITLE_TEXT}`}>
                    {playerCount}
                  </span>
                  {maxPlayers !== null && (
                    <>
                      <span className={`text-textSub ${HOME_TITLE_TEXT}`}>/</span>
                      <span className={`font-semibold ${HOME_TITLE_TEXT} tabular-nums text-textMain`}>{maxPlayers}</span>
                    </>
                  )}
                </div>
                {maxPlayers !== null && playerCount >= maxPlayers && (
                  <span className={`text-red-400 ${HOME_BODY_TEXT} whitespace-nowrap`}>{t('Límite alcanzado', 'Limit reached')}</span>
                )}
              </div>
              <div className={`font-bold text-textMain ${HOME_TITLE_TEXT}`}>{t('Jugadores', 'Players')}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col shrink-0 min-w-0">
      <PrizeSticker label={prizeLabel} prize={prize} current={validatedCount} max={effectiveMax} compact={compact} />
      <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex-shrink-0 ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden' : 'p-3 sm:p-4 lg:p-6'}`}>
        {isStale && <span className={`${HOME_BODY_TEXT} font-normal text-yellow-500 mb-1 block`}>● {t('sin señal', 'offline')}</span>}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-start gap-1 text-left">
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <div className={`font-bold tabular-nums text-[var(--color-primary)] ${HOME_TITLE_TEXT}`}>
                {playerCount}
              </div>
              {maxPlayers !== null && (
                <>
                  <div className={`text-textSub ${HOME_TITLE_TEXT}`}>/</div>
                  <div className={`font-semibold text-textMain ${HOME_TITLE_TEXT}`}>
                    {maxPlayers}
                  </div>
                </>
              )}
            </div>
            {maxPlayers !== null && playerCount >= maxPlayers && (
              <span className={`text-red-400 whitespace-nowrap ${HOME_BODY_TEXT}`}>
                {t('Límite alcanzado', 'Limit reached')}
              </span>
            )}
          </div>
          <h2 className={`font-bold text-textMain ${HOME_TITLE_TEXT}`}>
            {t('Jugadores', 'Players')}
          </h2>
        </div>
      </div>
    </div>
  )
}
