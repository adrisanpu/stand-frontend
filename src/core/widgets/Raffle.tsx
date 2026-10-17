import { useState, useEffect } from 'react'
import { api } from '../../api/api'
import { useOperatorLanguage } from '../shell/operatorLanguage'

type RaffleProps = {
  onBack: () => void
  onClose: () => void
  gameId?: string
}

type RaffleResponse = {
  gameId: string
  winners: string[]
  raffleRequiredFollows?: string[]
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

type EligibilityMode = 'all' | 'quiz' | 'validated'

function translateRaffleError(message: string, t: (spanish: string, english?: string) => string): string {
  const knownErrors: Record<string, string> = {
    'No hay gameId disponible': t('No hay gameId disponible', 'No gameId is available'),
    'El número de ganadores debe ser al menos 1': t('El número de ganadores debe ser al menos 1', 'The number of winners must be at least 1'),
    'Formato de respuesta inválido': t('Formato de respuesta inválido', 'Invalid response format'),
    'Error al ejecutar el sorteo': t('Error al ejecutar el sorteo', 'Error running the raffle'),
    'Error al guardar las cuentas': t('Error al guardar las cuentas', 'Error saving accounts'),
  }
  return Object.prototype.hasOwnProperty.call(knownErrors, message) ? knownErrors[message] : message
}

export default function Raffle({ onBack, onClose, gameId }: RaffleProps) {
  const { t } = useOperatorLanguage()
  const [numberOfWinners, setNumberOfWinners] = useState<number>(1)
  const [eligibilityMode, setEligibilityMode] = useState<EligibilityMode>('all')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [winners, setWinners] = useState<string[] | null>(null)
  const [requiredFollows, setRequiredFollows] = useState<string[]>([])
  const [newHandle, setNewHandle] = useState('')
  const [savingFollows, setSavingFollows] = useState(false)

  // Auto raffle: solo activar/desactivar e intervalo. El resto (número de ganadores, aplicable a) se toma de los inputs del sorteo manual.
  const [autoRaffleEnabled, setAutoRaffleEnabled] = useState<boolean>(false)
  const [autoRaffleInterval, setAutoRaffleInterval] = useState<number>(30) // minutes

  // Load game raffleRequiredFollows on mount (by gameId for owner)
  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    const load = async () => {
      try {
        const data = await api.get<{
          ok: boolean
          raffleRequiredFollows?: string[]
        }>(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
        if (cancelled) return
        if (data?.raffleRequiredFollows && Array.isArray(data.raffleRequiredFollows)) {
          setRequiredFollows(
            data.raffleRequiredFollows
              .map((h) => String(h).trim().toLowerCase().replace(/^@/, ''))
              .filter((h) => h),
          )
        }
      } catch (_) {
        // may 401 if not owner; ignore
      }
    }
    load()
    return () => { cancelled = true }
  }, [gameId])

  const applicableOnlyValidated = eligibilityMode !== 'all'

  // Load auto raffle config + last manual eligibility on mount
  useEffect(() => {
    const config = loadAutoRaffleConfig(gameId)
    if (config) {
      setAutoRaffleEnabled(config.enabled)
      setAutoRaffleInterval(config.intervalMinutes || 30)
    }
    if (gameId) {
      try {
        const raw = localStorage.getItem(`raffle_last_manual_${gameId}`)
        if (raw) {
          const parsed = JSON.parse(raw) as {
            eligibilityMode?: EligibilityMode
            applicableOnlyValidated?: boolean
          }
          if (parsed.eligibilityMode === 'all' || parsed.eligibilityMode === 'quiz' || parsed.eligibilityMode === 'validated') {
            setEligibilityMode(parsed.eligibilityMode)
          } else if (typeof parsed.applicableOnlyValidated === 'boolean' && parsed.applicableOnlyValidated) {
            setEligibilityMode('validated')
          }
        }
      } catch (_) {}
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

  const saveRequiredFollowsList = async (list: string[]) => {
    if (!gameId) return
    setSavingFollows(true)
    try {
      await api.put('/v1/game', {
        gameId,
        settings: { raffle: { requiredFollows: list } },
      })
    } catch (err: any) {
      setError(err.message || 'Error al guardar las cuentas')
    } finally {
      setSavingFollows(false)
    }
  }

  const addRequiredFollow = async () => {
    const h = newHandle.trim().toLowerCase().replace(/^@/, '')
    if (!h) return
    if (requiredFollows.includes(h)) {
      setNewHandle('')
      return
    }
    const next = [...requiredFollows, h]
    setRequiredFollows(next)
    setNewHandle('')
    await saveRequiredFollowsList(next)
  }

  const removeRequiredFollow = async (handle: string) => {
    const next = requiredFollows.filter((x) => x !== handle)
    setRequiredFollows(next)
    await saveRequiredFollowsList(next)
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
      const result = await api.post<RaffleResponse>('/v1/game/raffle', {
        gameId,
        numberOfWinners,
        applicableOnlyValidated
      })
      if (result.winners && Array.isArray(result.winners)) {
        setWinners(result.winners)

        // Guardar parámetros usados para que los sorteos automáticos los reutilicen
        if (gameId) {
          try {
            localStorage.setItem(
              `raffle_last_manual_${gameId}`,
              JSON.stringify({ numberOfWinners, applicableOnlyValidated, eligibilityMode })
            )
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
    setEligibilityMode('all')
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
      <div className="relative card w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label={t('Volver', 'Go back')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 id="raffle-title" className="text-xl font-semibold">{t('Sorteo', 'Raffle')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label={t('Cerrar', 'Close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {translateRaffleError(error, t)}
            </div>
          )}

          {!winners ? (
            <>
              {/* Sorteo automático */}
              <div className="mb-5">
                <h3 className="mb-3 text-sm font-medium text-gray-300">{t('Sorteo automático', 'Automatic raffle')}</h3>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={autoRaffleEnabled}
                      onChange={(e) => {
                        setAutoRaffleEnabled(e.target.checked)
                        if (e.target.checked && gameId) {
                          const config = loadAutoRaffleConfig(gameId)
                          if (config) {
                            config.lastAutoRaffleTime = Date.now()
                            saveAutoRaffleConfig(gameId, config)
                          }
                        }
                      }}
                      className="peer sr-only"
                      aria-label={t('Activar sorteo automático', 'Enable automatic raffle')}
                    />
                    <div className="relative h-6 w-11 shrink-0 rounded-full bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500" />
                  </label>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-300 whitespace-nowrap">{t('Cada:', 'Every:')}</span>
                    <input
                      id="auto-interval"
                      type="number"
                      min={1}
                      value={autoRaffleInterval}
                      onChange={(e) => handleAutoIntervalChange(e.target.value)}
                      disabled={!autoRaffleEnabled}
                      aria-label={t('Intervalo en minutos', 'Interval in minutes')}
                      className="h-10 w-16 shrink-0 rounded-lg border border-white/10 bg-[rgba(255,255,255,0.05)] px-2 text-center text-sm font-mono focus:border-white/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                    />
                    <span className="text-sm text-gray-400">{t('minutos', 'minutes')}</span>
                  </div>
                </div>
              </div>

              {/* Ganadores + elegibilidad (misma fila) */}
              <div className="mb-5 grid grid-cols-1 min-[400px]:grid-cols-[1fr_minmax(8.5rem,10rem)] gap-3 items-end">
                <div className="min-w-0">
                  <label htmlFor="number-of-winners" className="block text-sm font-medium text-gray-300 mb-1.5">
                    {t('Número de ganadores', 'Number of winners')}
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
                <div className="min-w-0 w-full">
                  <label htmlFor="raffle-eligibility" className="block text-sm font-medium text-gray-300 mb-1.5">
                    {t('Aplicable a', 'Eligible participants')}
                  </label>
                  <select
                    id="raffle-eligibility"
                    value={eligibilityMode}
                    onChange={(e) => setEligibilityMode(e.target.value as EligibilityMode)}
                    className="w-full h-11 px-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm text-textMain focus:border-white/20 focus:outline-none"
                  >
                    <option value="all">{t('Todos', 'Everyone')}</option>
                    <option value="quiz">{t('Quiz completado', 'Quiz completed')}</option>
                    <option value="validated">{t('Validados', 'Validated')}</option>
                  </select>
                </div>
              </div>

              {/* Requisitos para ganar */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  {t('Requisitos para ganar', 'Requirements to win')}
                </label>
                <p className="text-sm font-medium text-gray-300 mb-2">{t('Seguir a:', 'Follow:')}</p>
                <div className="flex flex-wrap gap-2 mb-2 min-h-[2rem]">
                  {requiredFollows.length === 0 && (
                    <span className="text-xs text-gray-500">{t('Ninguna cuenta configurada', 'No accounts configured')}</span>
                  )}
                  {requiredFollows.map((handle) => (
                    <span
                      key={handle}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.08)] border border-white/10 text-xs"
                    >
                      @{handle}
                      <button
                        type="button"
                        onClick={() => void removeRequiredFollow(handle)}
                        disabled={savingFollows}
                        className="ml-0.5 p-0.5 rounded hover:bg-white/20 text-gray-400 hover:text-white disabled:opacity-40 disabled:pointer-events-none"
                        aria-label={`${t('Quitar', 'Remove')} @${handle}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('usuario (sin @)', 'username (without @)')}
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void addRequiredFollow()
                      }
                    }}
                    className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-sm placeholder-gray-500 focus:border-white/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void addRequiredFollow()}
                    disabled={savingFollows || !gameId}
                    className="px-3 h-10 rounded-lg bg-[rgba(255,255,255,0.1)] border border-white/10 hover:bg-white/15 text-sm font-medium flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingFollows ? t('Guardando…', 'Saving…') : t('Añadir', 'Add')}
                  </button>
                </div>
              </div>

              <div className="mb-1">
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
                    {isRunning ? t('Ejecutando sorteo...', 'Running raffle...') : t('Ejecutar sorteo', 'Run raffle')}
                  </div>
                </button>
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
                      {t('¡Ganadores del Sorteo!', 'Raffle winners!')}
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
            </>
          )}
        </div>

        {winners && (
          <div className="flex-shrink-0 mt-4">
            <button
              onClick={resetRaffle}
              className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              {t('Realizar otro sorteo', 'Run another raffle')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
