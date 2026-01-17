import { useEffect, useState } from 'react'
import { api } from '../api/api'

interface RaffleWinner {
  username: string
  timestamp?: string
  raffleId?: string
}

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
  players?: Array<{
    playerId: number
    instagramPSID: string
    instagramUsername: string
    quizCompleted: boolean
    quizCurrentQuestion: string | null
    quizAnswers: Record<string, string>
  }>
  raffleWinners?: Array<{
    playerId: number
    instagramPSID: string
    instagramUsername: string
    raffleWin: boolean
    raffleWinAt: string
    validationCode: number
  }>
}

interface AutoRaffleConfig {
  enabled: boolean
  intervalMinutes: number
  lastAutoRaffleTime?: number
  autoNumberOfWinners?: number
  autoApplicableOnlyValidated?: boolean
}

interface RaffleDataProps {
  gameId: string
  refreshInterval?: number // in milliseconds, 0 to disable
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

export default function RaffleData({ gameId, refreshInterval = 10000 }: RaffleDataProps) {
  const [winners, setWinners] = useState<RaffleWinner[]>([])
  const [nextRaffleTime, setNextRaffleTime] = useState<Date | null>(null)
  const [timeUntilNext, setTimeUntilNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRaffleConfig, setAutoRaffleConfig] = useState<AutoRaffleConfig | null>(null)

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

  const loadRaffleData = async () => {
    if (!gameId) return

    try {
      // Load auto raffle config from localStorage
      const config = loadAutoRaffleConfig(gameId)
      setAutoRaffleConfig(config)

      // Calculate next auto raffle time if enabled
      if (config && config.enabled) {
        const nextTime = calculateNextAutoRaffleTime(config)
        setNextRaffleTime(nextTime)
      } else {
        setNextRaffleTime(null)
        setTimeUntilNext(null)
      }

      // Fetch raffle winners from quiz endpoint
      try {
        const quizData = await api.get<QuizDataResponse>(`/quizz?gameId=${encodeURIComponent(gameId)}`)
        
        if (quizData.ok && Array.isArray(quizData.raffleWinners)) {
          // Map raffleWinners to RaffleWinner format
          const mappedWinners: RaffleWinner[] = quizData.raffleWinners
            .filter(winner => winner.raffleWin) // Only include actual winners
            .map(winner => ({
              username: winner.instagramUsername,
              timestamp: winner.raffleWinAt,
              raffleId: winner.playerId.toString()
            }))
            // Sort by timestamp (most recent first)
            .sort((a, b) => {
              if (!a.timestamp || !b.timestamp) return 0
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            })
          
          setWinners(mappedWinners)
        } else {
          setWinners([])
        }
      } catch (historyError) {
        console.warn('Error fetching raffle winners:', historyError)
        setWinners([])
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading raffle data:', error)
      setLoading(false)
    }
  }

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
      
      // If time has passed, recalculate next time (in case config changed)
      if (diff === 0 && autoRaffleConfig && autoRaffleConfig.enabled) {
        const intervalMs = autoRaffleConfig.intervalMinutes * 60 * 1000
        const newNextTime = new Date(now + intervalMs)
        setNextRaffleTime(newNextTime)
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [nextRaffleTime, autoRaffleConfig])

  useEffect(() => {
    if (gameId) {
      loadRaffleData()
      
      // Refresh raffle data at specified interval
      if (refreshInterval > 0) {
        const interval = setInterval(loadRaffleData, refreshInterval)
        return () => clearInterval(interval)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, refreshInterval])

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
      <div className="card rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-neon">
        <h2 className="text-lg sm:text-xl font-bold text-textMain mb-2 sm:mb-4">Sorteo</h2>
        <p className="text-textSub text-sm sm:text-base">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="card rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-neon h-full flex flex-col">
      <h2 className="text-lg sm:text-xl font-bold text-textMain mb-2 sm:mb-4">Sorteo</h2>
      <div className="flex-1 overflow-y-auto space-y-3 sm:space-y-4">
        {/* Next Raffle Countdown */}
        {timeUntilNext !== null && timeUntilNext > 0 && autoRaffleConfig?.enabled && (
          <div className="p-2 sm:p-3 rounded-lg bg-surface border border-white/10">
            <div className="text-xs sm:text-sm text-textSub mb-1">Próximo en:</div>
            <div className="text-base sm:text-lg font-semibold text-[var(--color-primary)]">
              {formatTime(timeUntilNext)}
            </div>
            <div className="text-[10px] sm:text-xs text-textSub mt-1">
              Cada {autoRaffleConfig.intervalMinutes} minuto{autoRaffleConfig.intervalMinutes !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Previous Winners */}
        {winners.length > 0 ? (
          <div>
            <div className="text-xs sm:text-sm text-textSub mb-2">Ganadores anteriores:</div>
            <div className="space-y-1 sm:space-y-2">
              {winners.slice(0, 5).map((winner, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 sm:p-2.5 rounded-lg bg-surface border border-white/10"
                >
                  <span className="text-[var(--color-primary)] font-bold text-xs sm:text-sm w-4 sm:w-5 flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-textMain font-medium text-xs sm:text-sm truncate flex-1">
                    {winner.username}
                  </span>
                </div>
              ))}
              {winners.length > 5 && (
                <p className="text-textSub text-[10px] sm:text-xs text-center mt-1">
                  +{winners.length - 5} más
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-textSub text-xs sm:text-sm">No hay ganadores aún</p>
        )}
      </div>
    </div>
  )
}
