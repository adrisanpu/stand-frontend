import { useEffect, useRef, useCallback, useState } from 'react'
import { api } from '../api/api'
import { usePolling } from '../hooks/usePolling'

interface RaffleWinner {
  username: string
  timestamp?: string
  raffleId?: string
}

interface GameDataRaffleWinner {
  wonAt: string
  validationCode: number
  instagramUsername: string
  playerId: number
  instagramPSID: string
}

interface GameDataResponse {
  ok: boolean
  game?: { gameId: string; gameName: string; gameType: string; createdAt: string; maxPlayers: number }
  playerCount?: number
  validatedCount?: number
  raffleWinners?: GameDataRaffleWinner[]
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

export default function RaffleData({ gameId, gameName, refreshInterval = 10000, compact = false }: RaffleDataProps) {
  const [winners, setWinners] = useState<RaffleWinner[]>([])
  const [nextRaffleTime, setNextRaffleTime] = useState<Date | null>(null)
  const [timeUntilNext, setTimeUntilNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRaffleConfig, setAutoRaffleConfig] = useState<AutoRaffleConfig | null>(null)
  const autoRaffleInProgressRef = useRef(false)

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

    const mappedWinners: RaffleWinner[] = (data.raffleWinners ?? [])
      .map(w => ({
        username: w.instagramUsername,
        timestamp: w.wonAt,
        raffleId: w.playerId.toString(),
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

  if (loading) {
    return (
      <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col min-h-0 ${compact ? 'p-2 sm:p-3' : 'p-3 sm:p-4 lg:p-6'}`}>
        <h2 className={`font-bold text-textMain mb-1 sm:mb-2 ${compact ? 'text-sm' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>Sorteo</h2>
        <p className="text-textSub text-xs sm:text-sm">Cargando...</p>
      </div>
    )
  }

  return (
    <div className={`card rounded-xl sm:rounded-2xl shadow-neon flex flex-col ${compact ? 'p-2 sm:p-3' : 'p-3 sm:p-4 lg:p-6 min-h-0 flex-1 overflow-hidden'}`}>
      <h2 className={`font-bold text-textMain mb-1 sm:mb-2 flex items-center gap-2 flex-shrink-0 ${compact ? 'text-sm' : 'text-lg sm:text-xl mb-2 sm:mb-4'}`}>
        Sorteo
        {isStale && <span className="text-[10px] font-normal text-yellow-500">● sin señal</span>}
      </h2>
      <div className={`${compact ? 'space-y-1' : 'flex-1 min-h-0 overflow-y-auto space-y-3 sm:space-y-4'}`}>
        {/* Next Raffle Countdown */}
        {timeUntilNext !== null && timeUntilNext > 0 && autoRaffleConfig?.enabled && (
          <div className={`rounded-lg bg-surface border border-white/10 ${compact ? 'p-2' : 'p-2 sm:p-3'}`}>
            <div className={`text-textSub mb-1 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>Próximo en:</div>
            <div className={`font-semibold text-[var(--color-primary)] ${compact ? 'text-base' : 'text-base sm:text-lg'}`}>
              {formatTime(timeUntilNext)}
            </div>
            <div className={`text-textSub mt-1 ${compact ? 'text-xs' : 'text-[10px] sm:text-xs'}`}>
              Cada {autoRaffleConfig.intervalMinutes} minuto{autoRaffleConfig.intervalMinutes !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Last winner only */}
        {winners.length > 0 ? (
          <div>
            <div className={`text-textSub mb-2 ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>Último ganador:</div>
            <div className={compact ? 'space-y-1' : 'space-y-1 sm:space-y-2'}>
              <div
                className={`flex items-center gap-2 rounded-lg bg-surface border border-white/10 ${compact ? 'p-1.5' : 'p-2 sm:p-2.5'}`}
              >
                <span className={`text-textMain font-medium truncate flex-1 ${compact ? 'text-base' : 'text-xs sm:text-sm'}`}>
                  {winners[0].username}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className={`text-textSub ${compact ? 'text-xs' : 'text-xs sm:text-sm'}`}>No hay ganadores aún</p>
        )}
      </div>
    </div>
  )
}
