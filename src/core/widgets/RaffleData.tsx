import { useEffect, useLayoutEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api/api'
import { usePolling } from '../../hooks/usePolling'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import type { GamePrize } from '../prizes'
import PrizeSticker from './PrizeSticker'
import { HOME_TITLE_TEXT, HOME_BODY_TEXT } from '../ui/homeTypography'

interface RaffleWinner {
  username: string
  timestamp?: string
  raffleId?: string
  prizeDelivered?: boolean
}

interface GameDataRaffleWinner {
  wonAt: string
  validationCode: number
  instagramUsername: string
  playerId: number
  instagramPSID: string
  prizeDelivered?: boolean
}

interface GameDataResponse {
  ok: boolean
  game?: { gameId: string; gameName: string; gameType: string; createdAt: string; maxPlayers: number }
  playerCount?: number
  validatedCount?: number
  raffleWinners?: GameDataRaffleWinner[]
  raffleRequiredFollows?: string[]
  quiz?: { enabled: boolean; questionsCount: number }
}

interface AutoRaffleConfig {
  enabled: boolean
  intervalMinutes: number
  lastAutoRaffleTime?: number
}

interface RaffleDataProps {
  gameId: string
  gameName: string
  refreshInterval?: number // in milliseconds, 0 to disable
  compact?: boolean // when true (e.g. landscape sidebar), reduce padding and show fewer items
  prizeLabel?: string // Legacy prize name, shown in the prize sticker
  prize?: GamePrize
  maxPrizeRaffle?: number
}

const getStorageKey = (gameId: string) => `raffle_auto_${gameId}`

const loadAutoRaffleConfig = (gameId: string): AutoRaffleConfig | null => {
  try {
    const saved = localStorage.getItem(getStorageKey(gameId))
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Error loading auto raffle config:', error)
  }
  return null
}

export default function RaffleData({ gameId, gameName, refreshInterval = 10000, compact = false, prizeLabel: legacyPrizeLabel, prize, maxPrizeRaffle: legacyMax }: RaffleDataProps) {
  const { t } = useOperatorLanguage()
  const prizeLabel = prize ? prize.name : legacyPrizeLabel
  const maxPrizeRaffle = prize ? prize.limit ?? undefined : legacyMax
  const [winners, setWinners] = useState<RaffleWinner[]>([])
  const [updatingDelivered, setUpdatingDelivered] = useState(false)
  const [nextRaffleTime, setNextRaffleTime] = useState<Date | null>(null)
  const [timeUntilNext, setTimeUntilNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [gameType, setGameType] = useState<string | null>(null)
  const [autoRaffleConfig, setAutoRaffleConfig] = useState<AutoRaffleConfig | null>(null)
  const autoRaffleInProgressRef = useRef(false)
  const [winnersDropdownOpen, setWinnersDropdownOpen] = useState(false)
  const winnersDropdownRef = useRef<HTMLDivElement>(null)
  const winnersButtonRef = useRef<HTMLButtonElement>(null)
  const dropdownPortalRef = useRef<HTMLDivElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number; minWidth: number } | null>(null)

  const updateDropdownPosition = useCallback(() => {
    const btn = winnersButtonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setDropdownPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: rect.width,
    })
  }, [])

  // Set dropdown position before paint so the portal appears in the right place immediately
  useLayoutEffect(() => {
    if (!winnersDropdownOpen) {
      setDropdownPosition(null)
      return
    }
    updateDropdownPosition()
  }, [winnersDropdownOpen, updateDropdownPosition])

  useEffect(() => {
    if (!winnersDropdownOpen) return
    const onScrollOrResize = () => updateDropdownPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [winnersDropdownOpen, updateDropdownPosition])

  useEffect(() => {
    if (!winnersDropdownOpen) return
    const onOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        !winnersDropdownRef.current?.contains(target) &&
        !dropdownPortalRef.current?.contains(target)
      ) {
        setWinnersDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [winnersDropdownOpen])

  const calculateNextAutoRaffleTime = (config: AutoRaffleConfig): Date | null => {
    if (!config.enabled) return null

    const now = Date.now()
    const intervalMs = config.intervalMinutes * 60 * 1000
    
    // If we have a last raffle time, calculate from there
    if (config.lastAutoRaffleTime) {
      const nextTime = config.lastAutoRaffleTime + intervalMs
      // If the next time has already passed, calculate from now
      if (nextTime <= now) {
        return new Date(now + intervalMs)
      }
      return new Date(nextTime)
    }
    
    // If no last raffle time, start from now
    return new Date(now + intervalMs)
  }

  const fetchData = useCallback(async () => {
    if (!gameId || !gameName) return

    // Re-read config on each poll so same-tab changes from Raffle.tsx are picked up
    const config = loadAutoRaffleConfig(gameId)
    setAutoRaffleConfig(config)
    if (config && config.enabled) {
      setNextRaffleTime(calculateNextAutoRaffleTime(config))
    } else {
      setNextRaffleTime(null)
      setTimeUntilNext(null)
    }

    // Fetch winners — throws on error so usePolling can apply backoff
    const data = await api.get<GameDataResponse>(`/v1/game?gameName=${encodeURIComponent(gameName)}`)
    if (!data.ok) throw new Error('API response not ok')

    if (data.game?.gameType) {
      setGameType(data.game.gameType)
    }

    const mappedWinners: RaffleWinner[] = (data.raffleWinners ?? [])
      .map(w => ({
        username: w.instagramUsername,
        timestamp: w.wonAt,
        raffleId: w.playerId.toString(),
        prizeDelivered: w.prizeDelivered ?? false,
      }))
      .sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })
    setWinners(mappedWinners)
    setLoading(false)
  }, [gameId, gameName])

  const { isStale } = usePolling(fetchData, [gameId, gameName], { interval: refreshInterval })

  const triggerAutoRaffle = useCallback(async () => {
    if (autoRaffleInProgressRef.current || !gameId) return
    autoRaffleInProgressRef.current = true

    try {
      // Reuse last manual raffle params; fall back to safe defaults
      let numberOfWinners = 1
      let applicableOnlyValidated = false
      try {
        const saved = localStorage.getItem(`raffle_last_manual_${gameId}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          numberOfWinners = parsed.numberOfWinners ?? 1
          applicableOnlyValidated = parsed.applicableOnlyValidated ?? false
        }
      } catch (_) {}

      await api.post('/v1/game/raffle', { gameId, numberOfWinners, applicableOnlyValidated })

      // Update lastAutoRaffleTime so the next interval is counted from now
      try {
        const configRaw = localStorage.getItem(getStorageKey(gameId))
        if (configRaw) {
          const config: AutoRaffleConfig = JSON.parse(configRaw)
          config.lastAutoRaffleTime = Date.now()
          localStorage.setItem(getStorageKey(gameId), JSON.stringify(config))
          setAutoRaffleConfig({ ...config })
        }
      } catch (_) {}

      // Refresh winners list
      await fetchData()
    } catch (err) {
      console.error('Auto raffle trigger failed:', err)
    } finally {
      autoRaffleInProgressRef.current = false
    }
  }, [gameId])

  // Update time until next raffle every second
  useEffect(() => {
    if (!nextRaffleTime) {
      setTimeUntilNext(null)
      return
    }

    const updateTime = () => {
      const now = Date.now()
      const next = nextRaffleTime.getTime()
      const diff = Math.max(0, Math.floor((next - now) / 1000))
      setTimeUntilNext(diff)
      
      // If time has passed, fire the auto raffle and advance the timer
      if (diff === 0 && autoRaffleConfig && autoRaffleConfig.enabled) {
        triggerAutoRaffle()
        const intervalMs = autoRaffleConfig.intervalMinutes * 60 * 1000
        const newNextTime = new Date(now + intervalMs)
        setNextRaffleTime(newNextTime)
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [nextRaffleTime, autoRaffleConfig, triggerAutoRaffle])

  // Also listen for storage changes to update when config changes in another tab/window
  useEffect(() => {
    if (!gameId) return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === getStorageKey(gameId)) {
        const config: AutoRaffleConfig | null = e.newValue ? JSON.parse(e.newValue) : null
        setAutoRaffleConfig(config)
        if (config && config.enabled) {
          const nextTime = calculateNextAutoRaffleTime(config)
          setNextRaffleTime(nextTime)
        } else {
          setNextRaffleTime(null)
          setTimeUntilNext(null)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [gameId])

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  const handleToggleDelivered = async (raffleId: string, currentDelivered: boolean) => {
    if (!gameId || !gameType) return
    setUpdatingDelivered(true)
    const next = !currentDelivered
    try {
      setWinners(prev => prev.map(w => w.raffleId === raffleId ? { ...w, prizeDelivered: next } : w))
      await api.put('/v1/game', {
        gameId,
        settings: {
          prizeDelivered: {
            gameType: gameType.toUpperCase(),
            playerId: parseInt(raffleId, 10),
            delivered: next,
          },
        },
      })
    } catch (e) {
      console.error('Error updating prizeDelivered', e)
      setWinners(prev => prev.map(w => w.raffleId === raffleId ? { ...w, prizeDelivered: currentDelivered } : w))
    } finally {
      setUpdatingDelivered(false)
    }
  }

  const winnersSortedByName = winners
    .slice()
    .sort((a, b) => a.username.localeCompare(b.username, 'es', { sensitivity: 'base' }))

  if (loading) {
    return (
      <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col min-h-0 ${compact ? 'p-2 sm:p-3 min-w-0 overflow-hidden h-full' : 'p-3 sm:p-4 lg:p-6'}`}>
        <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${HOME_TITLE_TEXT}`}>{t('Sorteo', 'Raffle')}</h2>
        <p className={`text-textSub ${HOME_BODY_TEXT}`}>{t('Cargando...', 'Loading...')}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 min-w-0 flex-1">
      <PrizeSticker prize={prize} label={prizeLabel} current={winners.length} max={maxPrizeRaffle} compact={compact} />
      <div
        className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col relative flex-1 min-h-0 ${compact ? 'p-2 sm:p-3 min-w-0' : 'p-3 sm:p-4 lg:p-6'} ${winnersDropdownOpen ? 'overflow-visible' : 'overflow-hidden'}`}
        ref={winnersDropdownRef}
      >
        <h2 className={`font-bold text-textMain mb-1 sm:mb-2 flex flex-wrap items-center gap-2 flex-shrink-0 ${HOME_TITLE_TEXT}`}>
          {t('Sorteo', 'Raffle')}
          {isStale && <span className={`${HOME_BODY_TEXT} font-normal text-yellow-500`}>● {t('sin señal', 'offline')}</span>}
        </h2>
        <div className={`flex-1 min-h-0 flex flex-col ${compact ? 'gap-1' : 'gap-3 sm:gap-4'}`}>
          {/* Next Raffle Countdown */}
          {timeUntilNext !== null && timeUntilNext > 0 && autoRaffleConfig?.enabled && (
            <div className={`rounded-lg bg-surface border border-white/10 flex-shrink-0 ${compact ? 'p-2' : 'p-2 sm:p-3'}`}>
              <div className={`flex flex-row flex-wrap items-baseline justify-start gap-x-2 gap-y-0 ${HOME_BODY_TEXT}`}>
                <span className="text-textSub shrink-0">{t('Próximo en:', 'Next in:')}</span>
                <span className={`font-semibold text-[var(--color-primary)] ${HOME_BODY_TEXT}`}>
                  {formatTime(timeUntilNext)}
                </span>
              </div>
            </div>
          )}

          {/* Winners dropdown: panel from Ganadores button, above the Sorteo container */}
          {winners.length > 0 ? (
            <div className="relative flex-shrink-0">
              <button
                ref={winnersButtonRef}
                type="button"
                onClick={() => setWinnersDropdownOpen(open => !open)}
                className={`w-full rounded-lg bg-surface border border-white/10 px-3 py-2 text-left text-textMain flex items-center justify-between ${HOME_BODY_TEXT}`}
                aria-expanded={winnersDropdownOpen}
                aria-haspopup="listbox"
                aria-label={`${t('Ganadores', 'Winners')} (${winners.length}). ${winnersDropdownOpen ? t('Cerrar lista', 'Close list') : t('Ver lista', 'View list')}`}
              >
                <span>{t('Ganadores', 'Winners')} ({winners.length})</span>
                <span className="text-textSub ml-2">{winnersDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {winnersDropdownOpen &&
                dropdownPosition &&
                createPortal(
                  <div
                    ref={dropdownPortalRef}
                    className="fixed z-[9999] rounded-xl border border-white/15 bg-[rgba(30,30,40,0.98)] shadow-lg shadow-purple-500/10 overflow-hidden flex flex-col w-max min-w-0"
                    style={{
                      top: dropdownPosition.top,
                      right: dropdownPosition.right,
                      minWidth: dropdownPosition.minWidth,
                      maxWidth: 'calc(100vw - 2rem)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(147,51,234,0.25)',
                    }}
                    role="listbox"
                    aria-label={t('Lista de ganadores', 'Winners list')}
                  >
                    <div
                      className="overflow-y-auto overflow-x-auto overscroll-contain p-1.5 min-w-0 max-h-40"
                      onClick={e => e.stopPropagation()}
                    >
                      {winnersSortedByName.map((w, index) => (
                        <label
                          key={w.raffleId ?? index}
                          role="option"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg min-w-0 cursor-pointer border-b border-white/5 last:border-b-0 hover:bg-white/10 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!w.prizeDelivered}
                            onChange={() => handleToggleDelivered(w.raffleId!, w.prizeDelivered ?? false)}
                            disabled={updatingDelivered || !gameType}
                            className="w-4 h-4 flex-shrink-0 rounded border-white/20 text-purple-500 focus:ring-purple-500"
                            onClick={e => e.stopPropagation()}
                            aria-label={`${t('Premio entregado para', 'Prize delivered for')} ${w.username}`}
                          />
                          <span className={`text-textMain font-medium whitespace-nowrap shrink-0 ${HOME_BODY_TEXT}`} title={w.username}>
                            {w.username}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          ) : (
            <p className={`text-textSub ${HOME_BODY_TEXT}`}>{t('No hay ganadores aún', 'No winners yet')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
