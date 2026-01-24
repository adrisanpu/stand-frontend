import { useState, useEffect } from 'react'
import { api } from '../api/api'

type RaffleProps = {
  onBack: () => void
  onClose: () => void
  gameId?: string
}

type RaffleResponse = {
  gameId: string
  winners: string[]
}

interface AutoRaffleConfig {
  enabled: boolean
  intervalMinutes: number
  lastAutoRaffleTime?: number
}

const getStorageKey = (gameId: string) => `raffle_auto_${gameId}`

const loadAutoRaffleConfig = (gameId: string | undefined): AutoRaffleConfig | null => {
  if (!gameId) return null
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

const saveAutoRaffleConfig = (gameId: string | undefined, config: AutoRaffleConfig) => {
  if (!gameId) return
  try {
    localStorage.setItem(getStorageKey(gameId), JSON.stringify(config))
  } catch (error) {
    console.error('Error saving auto raffle config:', error)
  }
}

export default function Raffle({ onBack, onClose, gameId }: RaffleProps) {
  const [numberOfWinners, setNumberOfWinners] = useState<number>(1)
  const [applicableOnlyValidated, setApplicableOnlyValidated] = useState<boolean>(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [winners, setWinners] = useState<string[] | null>(null)
  
  // Auto raffle: solo activar/desactivar e intervalo. El resto (número de ganadores, aplicable a) se toma de los inputs del sorteo manual.
  const [autoRaffleEnabled, setAutoRaffleEnabled] = useState<boolean>(false)
  const [autoRaffleInterval, setAutoRaffleInterval] = useState<number>(30) // minutes

  // Load auto raffle config on mount
  useEffect(() => {
    const config = loadAutoRaffleConfig(gameId)
    if (config) {
      setAutoRaffleEnabled(config.enabled)
      setAutoRaffleInterval(config.intervalMinutes || 30)
    }
  }, [gameId])

  // Save auto raffle config when it changes
  useEffect(() => {
    if (gameId) {
      const config: AutoRaffleConfig = {
        enabled: autoRaffleEnabled,
        intervalMinutes: autoRaffleInterval,
        lastAutoRaffleTime: loadAutoRaffleConfig(gameId)?.lastAutoRaffleTime
      }
      saveAutoRaffleConfig(gameId, config)
    }
  }, [gameId, autoRaffleEnabled, autoRaffleInterval])

  const handleNumberChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num > 0) {
      setNumberOfWinners(num)
    } else if (value === '') {
      setNumberOfWinners(1)
    }
  }

  const handleAutoIntervalChange = (value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num > 0) {
      setAutoRaffleInterval(num)
    } else if (value === '') {
      setAutoRaffleInterval(1)
    }
  }

  const runRaffle = async () => {
    if (!gameId) {
      setError('No hay gameId disponible')
      return
    }

    if (numberOfWinners < 1) {
      setError('El número de ganadores debe ser al menos 1')
      return
    }

    setIsRunning(true)
    setError(null)
    setWinners(null)

    try {
      const result = await api.post<RaffleResponse>('/raffle', {
        gameId,
        numberOfWinners,
        applicableOnlyValidated
      })
      if (result.winners && Array.isArray(result.winners)) {
        setWinners(result.winners)

        // Guardar parámetros usados para que los sorteos automáticos los reutilicen
        if (gameId) {
          try {
            localStorage.setItem(`raffle_last_manual_${gameId}`, JSON.stringify({ numberOfWinners, applicableOnlyValidated }))
          } catch (_) {}
        }

        // Update last raffle time if auto raffle is enabled
        if (gameId && autoRaffleEnabled) {
          const config = loadAutoRaffleConfig(gameId)
          if (config) {
            config.lastAutoRaffleTime = Date.now()
            saveAutoRaffleConfig(gameId, config)
          }
        }
      } else {
        throw new Error('Formato de respuesta inválido')
      }
    } catch (err: any) {
      setError(err.message || 'Error al ejecutar el sorteo')
    } finally {
      setIsRunning(false)
    }
  }

  const resetRaffle = () => {
    setNumberOfWinners(1)
    setApplicableOnlyValidated(false)
    setWinners(null)
    setError(null)
  }

  // Confetti Component
  const Confetti = ({ active }: { active: boolean }) => {
    useEffect(() => {
      if (!active) return

      const style = document.createElement('style')
      style.textContent = `
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(1080deg);
            opacity: 0;
          }
        }
      `
      document.head.appendChild(style)

      return () => {
        document.head.removeChild(style)
      }
    }, [active])

    if (!active) return null

    const confettiPieces = Array.from({ length: 50 }, (_, i) => i)
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE']

    return (
      <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
        {confettiPieces.map((i) => {
          const color = colors[i % colors.length]
          const left = `${(i * 2) % 100}%`
          const delay = `${(i * 0.1) % 3}s`
          const duration = `${2 + (i % 3)}s`
          const rotation = `${(i * 45) % 360}deg`

          return (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                left,
                top: '-10px',
                backgroundColor: color,
                animation: `confetti-fall ${duration} ${delay} ease-in forwards`,
                transform: `rotate(${rotation})`,
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="raffle-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative card w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Volver"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 id="raffle-title" className="text-xl font-semibold">Sorteo</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {!winners ? (
          <>
            {/* Number of Winners Input */}
            <div className="mb-4">
              <label htmlFor="number-of-winners" className="block text-sm font-medium text-gray-300 mb-2">
                Número de ganadores
              </label>
              <input
                id="number-of-winners"
                type="number"
                min="1"
                value={numberOfWinners}
                onChange={(e) => handleNumberChange(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-base font-mono focus:border-white/20 focus:outline-none"
              />
            </div>

            {/* Applicable To Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Aplicable a
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 cursor-pointer hover:bg-[rgba(255,255,255,0.1)] transition-colors">
                  <input
                    type="radio"
                    name="applicableOnlyValidated"
                    checked={!applicableOnlyValidated}
                    onChange={() => setApplicableOnlyValidated(false)}
                    className="w-4 h-4 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">Todos los jugadores</div>
                    <div className="text-xs text-gray-400">Incluye todos los participantes del juego</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 cursor-pointer hover:bg-[rgba(255,255,255,0.1)] transition-colors">
                  <input
                    type="radio"
                    name="applicableOnlyValidated"
                    checked={applicableOnlyValidated}
                    onChange={() => setApplicableOnlyValidated(true)}
                    className="w-4 h-4 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">Parejas validadas</div>
                    <div className="text-xs text-gray-400">Solo jugadores que han validado su pareja</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Run Raffle Button */}
            <div className="mb-6">
              <button
                onClick={runRaffle}
                disabled={isRunning || numberOfWinners < 1}
                className="w-full p-3 rounded-xl bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center gap-2">
                  {isRunning ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  )}
                  {isRunning ? 'Ejecutando sorteo...' : 'Ejecutar Sorteo'}
                </div>
              </button>
            </div>

            {/* Automatic Raffles Configuration */}
            <div className="mb-4 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-300 mb-1">Sorteos Automáticos</h3>
                  <p className="text-xs text-gray-400">Ejecutar sorteos automáticamente cada cierto tiempo</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRaffleEnabled}
                    onChange={(e) => {
                      setAutoRaffleEnabled(e.target.checked)
                      if (e.target.checked && gameId) {
                        // Set initial last raffle time when enabling
                        const config = loadAutoRaffleConfig(gameId)
                        if (config) {
                          config.lastAutoRaffleTime = Date.now()
                          saveAutoRaffleConfig(gameId, config)
                        }
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>

              {autoRaffleEnabled && (
                <div className="mt-4">
                  <label htmlFor="auto-interval" className="block text-xs font-medium text-gray-300 mb-2">
                    Intervalo (minutos)
                  </label>
                  <input
                    id="auto-interval"
                    type="number"
                    min="1"
                    value={autoRaffleInterval}
                    onChange={(e) => handleAutoIntervalChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-center text-sm font-mono focus:border-white/20 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Número de ganadores y «aplicable a» = los del sorteo manual arriba.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Confetti Animation */}
            <Confetti active={winners.length > 0} />
            
            {/* Winners Display */}
            <div className="mb-4">
              <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="font-medium text-green-300 text-lg">
                    ¡Ganadores del Sorteo!
                  </span>
                </div>
                <div className="space-y-2">
                  {winners.map((winner, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center font-semibold text-green-400 text-xs">
                          {index + 1}
                        </span>
                        <span className="text-gray-200 font-medium">{winner}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reset Button */}
            <button
              onClick={resetRaffle}
              className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              Realizar otro sorteo
            </button>
          </>
        )}
      </div>
    </div>
  )
}

