import IconButton from '../ui/IconButton'
import ConfigurationActions from '../ui/ConfigurationActions'
import { useState, useEffect, useRef } from 'react'
import { api } from '../../api/api'
import { useOperatorLanguage } from '../shell/operatorLanguage'

type RaffleProps = {
  onBack: () => void
  onClose: () => void
  gameId?: string
  gameType?: string
  onVisibilitySaved?: () => void
  embedded?: boolean
  onBusyChange?: (busy: boolean) => void
  onReadyChange?: (ready: boolean) => void
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

type EligibilityMode = 'all' | 'quiz' | 'validated'

function translateRaffleError(message: string, t: (spanish: string, english?: string) => string): string {
  const knownErrors: Record<string, string> = {
    'No hay gameId disponible': t('No hay gameId disponible', 'No gameId is available'),
    'El número de ganadores debe ser al menos 1': t('El número de ganadores debe ser al menos 1', 'The number of winners must be at least 1'),
    'Formato de respuesta inválido': t('Formato de respuesta inválido', 'Invalid response format'),
    'Error al ejecutar el sorteo': t('Error al ejecutar el sorteo', 'Error running the raffle'),
  }
  return Object.prototype.hasOwnProperty.call(knownErrors, message) ? knownErrors[message] : message
}

export default function Raffle({ onBack, onClose, gameId, gameType, onVisibilitySaved, embedded = false, onBusyChange, onReadyChange }: RaffleProps) {
  const { t } = useOperatorLanguage()
  const [homeVisibility, setHomeVisibility] = useState<{ gameId: string; enabled: boolean } | null>(null)
  const [visibilityError, setVisibilityError] = useState<string | null>(null)
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [visibilityLoadVersion, setVisibilityLoadVersion] = useState(0)
  const visibilityBusy = useRef(false)
  const running = useRef(false)
  const visibilityGeneration = useRef(0)

  useEffect(() => {
    const generation = ++visibilityGeneration.current
    setHomeVisibility(null)
    setVisibilityError(null)
    if (!gameId) return
    void api.get<{ ok: boolean; game?: { showRaffleOnHome?: boolean } }>(
      `/v1/game?gameId=${encodeURIComponent(gameId)}`,
    ).then((response) => {
      if (visibilityGeneration.current !== generation) return
      if (!response.ok || !response.game) throw new Error('Invalid game response')
      setHomeVisibility({ gameId, enabled: response.game.showRaffleOnHome !== false })
    }).catch(() => {
      if (visibilityGeneration.current === generation) {
        setVisibilityError(t('No se pudo cargar la configuración del sorteo.', 'Could not load raffle settings.'))
      }
    })
    return () => { visibilityGeneration.current += 1 }
  }, [gameId, visibilityLoadVersion, t])

  const saveHomeVisibility = async (enabled: boolean) => {
    if (!gameId || homeVisibility?.gameId !== gameId || visibilityBusy.current || running.current) return
    const generation = visibilityGeneration.current
    visibilityBusy.current = true
    onBusyChange?.(true)
    setVisibilitySaving(true)
    setVisibilityError(null)
    try {
      const response = await api.put<{ ok?: boolean }>('/v1/game', { gameId, showRaffleOnHome: enabled })
      if (response.ok === false) throw new Error('Raffle visibility save failed')
      if (visibilityGeneration.current !== generation) return
      setHomeVisibility({ gameId, enabled })
      onVisibilitySaved?.()
    } catch {
      if (visibilityGeneration.current === generation) {
        setVisibilityError(t('No se pudo guardar la configuración del sorteo.', 'Could not save raffle settings.'))
      }
    } finally {
      visibilityBusy.current = false
      onBusyChange?.(false)
      setVisibilitySaving(false)
    }
  }
  const [numberOfWinners, setNumberOfWinners] = useState<number>(1)
  const [eligibilityMode, setEligibilityMode] = useState<EligibilityMode>('all')
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [winners, setWinners] = useState<string[] | null>(null)
  const readyCallback = useRef(onReadyChange)
  readyCallback.current = onReadyChange
  useEffect(() => {
    readyCallback.current?.(homeVisibility?.gameId === gameId && !visibilitySaving && !isRunning && !visibilityError && !error)
  }, [homeVisibility, gameId, visibilitySaving, isRunning, visibilityError, error])

  // Auto raffle: solo activar/desactivar e intervalo. El resto (número de ganadores, aplicable a) se toma de los inputs del sorteo manual.
  const [autoRaffleEnabled, setAutoRaffleEnabled] = useState<boolean>(false)
  const [autoRaffleInterval, setAutoRaffleInterval] = useState<number>(30) // minutes

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
            numberOfWinners?: number
          }
          if (Number.isInteger(parsed.numberOfWinners) && parsed.numberOfWinners! > 0) setNumberOfWinners(parsed.numberOfWinners!)
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

  useEffect(() => {
    if (!gameId) return
    try {
      localStorage.setItem(`raffle_last_manual_${gameId}`,
        JSON.stringify({ numberOfWinners, applicableOnlyValidated, eligibilityMode }))
    } catch (_) {}
  }, [gameId, numberOfWinners, applicableOnlyValidated, eligibilityMode])
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
    if (running.current || visibilityBusy.current) return
    if (!gameId) {
      setError('No hay gameId disponible')
      return
    }

    if (numberOfWinners < 1) {
      setError('El número de ganadores debe ser al menos 1')
      return
    }

    running.current = true
    onBusyChange?.(true)
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
      running.current = false
      onBusyChange?.(false)
      setIsRunning(false)
    }
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

  const field = 'h-10 rounded-md border border-current/20 bg-surface px-3 text-sm text-textMain disabled:cursor-not-allowed disabled:opacity-50'
  const section = 'space-y-3 rounded-lg border border-current/10 p-4'
  const heading = 'text-sm font-semibold'
  const toggle = (checked: boolean) => `relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-gray-600'}`
  const knob = (checked: boolean) => `absolute left-[2px] top-[2px] h-5 w-5 rounded-full border border-gray-300 bg-white transition-transform ${checked ? 'translate-x-full' : ''}`
  const body = <div className="space-y-4">
    <section aria-labelledby="raffle-conditions-title" className={section}>
      <h3 id="raffle-conditions-title" className={heading}>{t('Condiciones para participar', 'Entry conditions')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="raffle-eligibility" className="space-y-1 text-sm text-textSub">
          <span className="block">{t('Aplicable a', 'Eligible participants')}</span>
          <select id="raffle-eligibility" value={eligibilityMode} className={`${field} w-full`}
            onChange={(e) => setEligibilityMode(e.target.value as EligibilityMode)}>
            <option value="all">{t('Todos', 'Everyone')}</option>
            <option value="quiz">{t('Cuestionario completado', 'Questionnaire completed')}</option>
            <option value="validated">{gameType === 'STACK' ? t('Partida completada', 'Game completed') : t('Validados', 'Validated')}</option>
          </select>
        </label>
        <label htmlFor="number-of-winners" className="space-y-1 text-sm text-textSub">
          <span className="block">{t('Número de ganadores', 'Number of winners')}</span>
          <input id="number-of-winners" type="number" min="1" value={numberOfWinners}
            onChange={(e) => handleNumberChange(e.target.value)} className={`${field} w-full tabular-nums`} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <span id="raffle-home-label" className="text-sm">{t('Mostrar sorteo en el home', 'Show raffle on the home screen')}</span>
        <button type="button" role="switch" aria-labelledby="raffle-home-label"
          aria-checked={homeVisibility?.enabled !== false}
          disabled={homeVisibility?.gameId !== gameId || !gameId || visibilitySaving || isRunning}
          onClick={() => void saveHomeVisibility(homeVisibility?.enabled === false)}
          className={toggle(homeVisibility?.enabled !== false)}>
          <span aria-hidden="true" className={knob(homeVisibility?.enabled !== false)} />
        </button>
      </div>
      {visibilitySaving && <p role="status" className="text-sm text-textSub">{t('Guardando...', 'Saving...')}</p>}
      {visibilityError && <p role="alert" className="text-sm text-red-400">{visibilityError}</p>}
      {visibilityError && !homeVisibility && <div className="flex justify-end"><ConfigurationActions><IconButton icon="reload" label={t('Reintentar carga', 'Retry loading')}
        onClick={() => setVisibilityLoadVersion((version) => version + 1)} /></ConfigurationActions></div>}
    </section>

    <section aria-labelledby="raffle-manual-title" className={section}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="raffle-manual-title" className={heading}>{t('Lanzamiento manual', 'Manual launch')}</h3>
        <button type="button" onClick={runRaffle} disabled={isRunning || visibilitySaving || numberOfWinners < 1}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/20 px-4 py-2 font-medium transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50">
          <svg aria-hidden="true" className={`h-5 w-5 ${isRunning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isRunning
              ? 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
              : 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'} />
          </svg>
          {isRunning ? t('Ejecutando sorteo...', 'Running raffle...') : t('Ejecutar sorteo', 'Run raffle')}
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/20 p-3 text-sm text-red-400">
        {translateRaffleError(error, t)}
      </p>}
      {winners && <>
        <Confetti active={winners.length > 0} />
        <div className="space-y-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
          <p className="font-medium text-green-500">{t('¡Ganadores del Sorteo!', 'Raffle winners!')}</p>
          {winners.length
            ? <ol className="space-y-1">{winners.map((winner, index) => <li key={index} className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-green-500/30 bg-green-500/20 text-xs font-semibold text-green-500">{index + 1}</span>
              <span className="font-medium">{winner}</span>
            </li>)}</ol>
            : <p className="text-sm text-textSub">{t('No hay participantes elegibles.', 'There are no eligible participants.')}</p>}
        </div>
      </>}
    </section>

    <section aria-labelledby="raffle-auto-title" className={section}>
      <h3 id="raffle-auto-title" className={heading}>{t('Sorteo automático', 'Automatic raffle')}</h3>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" role="switch" aria-checked={autoRaffleEnabled}
          aria-label={t('Activar sorteo automático', 'Enable automatic raffle')} className={toggle(autoRaffleEnabled)}
          onClick={() => {
            const enabled = !autoRaffleEnabled
            setAutoRaffleEnabled(enabled)
            if (enabled && gameId) {
              const config = loadAutoRaffleConfig(gameId)
              if (config) {
                config.lastAutoRaffleTime = Date.now()
                saveAutoRaffleConfig(gameId, config)
              }
            }
          }}>
          <span aria-hidden="true" className={knob(autoRaffleEnabled)} />
        </button>
        <span className="text-sm text-textSub">{t('Cada', 'Every')}</span>
        <input id="auto-interval" type="number" min={1} value={autoRaffleInterval}
          onChange={(e) => handleAutoIntervalChange(e.target.value)} disabled={!autoRaffleEnabled}
          aria-label={t('Intervalo en minutos', 'Interval in minutes')} className={`${field} w-20 text-center tabular-nums`} />
        <span className="text-sm text-textSub">{t('minutos', 'minutes')}</span>
      </div>
      <p className="text-xs text-textSub">{t(
        'Usa las condiciones y el número de ganadores de arriba. Se lanza mientras la pantalla del sorteo está abierta.',
        'Uses the conditions and number of winners above. It runs while the raffle screen is open.',
      )}</p>
    </section>
  </div>

  if (embedded) return body

  return (
    <div role="dialog" aria-modal aria-labelledby="raffle-title" className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative card flex max-h-[90vh] w-full max-w-lg flex-col p-6">
        <div className="mb-6 flex flex-shrink-0 items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="rounded-full p-2 transition-colors hover:bg-white/10" aria-label={t('Volver', 'Go back')}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 id="raffle-title" className="text-xl font-semibold">{t('Sorteo', 'Raffle')}</h2>
          </div>
          <IconButton icon="remove" label={t('Cerrar', 'Close')} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{body}</div>
      </div>
    </div>
  )
}