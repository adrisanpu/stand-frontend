import { useState, useEffect } from 'react'
import Raffle from './Raffle'
import Quiz from './Quiz'
import AppearanceSettings from './AppearanceSettings'
import type { GameDefinition } from './types'
import { api } from '../api/api'
import { useCurrentUser } from '../auth/useCurrentUser'
import { getFeaturesByPlan } from '../auth/featureFlags'

type SettingsMenuProps = {
  onClose: () => void
  gameId?: string
  gameType?: string
  gameDefinition?: GameDefinition
  onLeaveGame?: () => void
  onExitApp?: () => void
}

export default function SettingsMenu({ onClose, gameId, gameType, gameDefinition, onLeaveGame, onExitApp }: SettingsMenuProps) {
  const [showRaffle, setShowRaffle] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showRemovePlayer, setShowRemovePlayer] = useState(false)
  const [usernameToDelete, setUsernameToDelete] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [removeSuccess, setRemoveSuccess] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [isTerminating, setIsTerminating] = useState(false)
  const [terminateError, setTerminateError] = useState<string | null>(null)
  const [showExportQuiz, setShowExportQuiz] = useState(false)
  const [isExportingQuiz, setIsExportingQuiz] = useState(false)
  const [exportQuizData, setExportQuizData] = useState<any>(null)
  const [showExportShareOptions, setShowExportShareOptions] = useState(false)
  const [exportQuizError, setExportQuizError] = useState<string | null>(null)
  const [showGameConfig, setShowGameConfig] = useState(false)
  const [gameSettings, setGameSettings] = useState<any>(null)
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false)
  const [showUserInfo, setShowUserInfo] = useState(false)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const { user, loading: userLoading, plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)

  // Load game settings from localStorage when gameId changes
  useEffect(() => {
    if (gameId && gameDefinition?.id) {
      const storageKey = `${gameDefinition.id}_settings_${gameId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          setGameSettings(JSON.parse(saved))
        } catch {
          setGameSettings(null)
        }
      } else {
        setGameSettings(null)
      }
    }
  }, [gameId, gameDefinition?.id])

  const handleGameConfigChange = (newSettings: any) => {
    if (gameId && gameDefinition?.id) {
      const storageKey = `${gameDefinition.id}_settings_${gameId}`
      localStorage.setItem(storageKey, JSON.stringify(newSettings))
      setGameSettings(newSettings)
    }
  }

  const handleStartCheckout = async () => {
    setIsStartingCheckout(true)
    try {
      const data = await api.post<{ url: string }>('/billing/checkout', {})
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No se recibió URL de pago')
      }
    } catch (error: any) {
      console.error('Error starting checkout:', error)
      alert(error.message || 'Error al iniciar el pago. Por favor, intenta de nuevo.')
      setIsStartingCheckout(false)
    }
  }

  const handleRemovePlayer = async () => {
    const username = usernameToDelete.trim()
    
    if (!username) {
      setRemoveError('Por favor ingresa un nombre de usuario')
      return
    }

    setIsRemoving(true)
    setRemoveError(null)
    setRemoveSuccess(false)

    try {
      const cleanUsername = username.startsWith('@') ? username.substring(1) : username
      
      await api.delete<{ ok?: boolean }>('', { username: cleanUsername, gameId })

      setRemoveSuccess(true)
      setTimeout(() => {
        setShowRemovePlayer(false)
        setUsernameToDelete('')
        onClose()
      }, 2000)
    } catch (error: any) {
      setRemoveError(error.message || 'Error al eliminar el jugador')
    } finally {
      setIsRemoving(false)
    }
  }

  const handleExportQuizBeforeTerminate = async () => {
    if (!gameId) {
      setExportQuizError('No hay gameId disponible')
      return
    }

    setIsExportingQuiz(true)
    setExportQuizError(null)
    setExportQuizData(null)
    setShowExportShareOptions(false)

    try {
      const data = await api.get(`/quizz?gameId=${encodeURIComponent(gameId)}`)
      setExportQuizData(data)
      setShowExportShareOptions(true)
    } catch (err: any) {
      setExportQuizError(err.message || 'Error al exportar los datos del quiz')
    } finally {
      setIsExportingQuiz(false)
    }
  }

  const handleShareQuizData = async () => {
    if (!exportQuizData) return

    const jsonString = JSON.stringify(exportQuizData, null, 2)

    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Datos del Quiz - ${exportQuizData.gameId}`,
          text: jsonString
        })
        return
      } catch (err) {
        // User cancelled or error, fall through to clipboard
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(jsonString)
      setExportQuizError(null)
      setTimeout(() => {
        // Continue with termination after sharing
        proceedWithTermination()
      }, 1000)
    } catch (err) {
      setExportQuizError('No se pudo copiar al portapapeles. Por favor, copia manualmente.')
    }
  }

  const handleDownloadQuizData = () => {
    if (!exportQuizData) return

    const jsonString = JSON.stringify(exportQuizData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quiz-data-${exportQuizData.gameId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    // Continue with termination after download
    proceedWithTermination()
  }

  const proceedWithTermination = async () => {
    if (!gameId) {
      setTerminateError('No hay gameId disponible')
      return
    }

    setIsTerminating(true)
    setTerminateError(null)

    try {
      await api.put('/game', { gameId, isActive: false })

      // Close the popup and settings menu, then leave the game
      setShowExportQuiz(false)
      setShowExitConfirm(false)
      onClose()
      if (onLeaveGame) {
        onLeaveGame()
      }
    } catch (error: any) {
      setTerminateError(error.message || 'Error al terminar la partida')
    } finally {
      setIsTerminating(false)
    }
  }

  const handleTerminateGame = async () => {
    // Show export quiz popup first
    setShowExportQuiz(true)
  }

  if (showRaffle) {
    return <Raffle onBack={() => setShowRaffle(false)} onClose={onClose} gameId={gameId} />
  }

  if (showQuiz) {
    return <Quiz onBack={() => setShowQuiz(false)} onClose={onClose} gameId={gameId} />
  }

  if (showAppearanceSettings) {
    return <AppearanceSettings onClose={() => setShowAppearanceSettings(false)} gameDefinition={gameDefinition} />
  }

  if (showUserInfo) {
    const formatDate = (dateString: string | undefined) => {
      if (!dateString) return 'N/A'
      try {
        const date = new Date(dateString)
        return date.toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      } catch {
        return dateString
      }
    }

    const planLabels: Record<string, string> = {
      free: 'Gratis',
      event: 'Evento 24h',
      enterprise: 'Enterprise'
    }

    // Countdown component for activeUntil
    const Countdown = ({ targetDate }: { targetDate: string }) => {
      const [timeLeft, setTimeLeft] = useState<string>('')

      useEffect(() => {
        const updateCountdown = () => {
          try {
            const target = new Date(targetDate).getTime()
            const now = Date.now()
            const difference = target - now

            if (difference <= 0) {
              setTimeLeft('Expirado')
              return
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24))
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((difference % (1000 * 60)) / 1000)

            if (days > 0) {
              setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
            } else if (hours > 0) {
              setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
            } else if (minutes > 0) {
              setTimeLeft(`${minutes}m ${seconds}s`)
            } else {
              setTimeLeft(`${seconds}s`)
            }
          } catch {
            setTimeLeft('Error')
          }
        }

        updateCountdown()
        const interval = setInterval(updateCountdown, 1000)

        return () => clearInterval(interval)
      }, [targetDate])

      return <span>{timeLeft}</span>
    }

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-info-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => setShowUserInfo(false)} aria-hidden="true" />
        <div className="relative card w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="user-info-title" className="text-xl font-semibold">Información del Usuario</h2>
            <button
              onClick={() => setShowUserInfo(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {userLoading ? (
            <div className="text-center py-8">
              <p className="text-textSub">Cargando información...</p>
            </div>
          ) : user ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Email</div>
                    <div className="text-textMain font-medium">{user.email || 'No disponible'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Plan</div>
                    <div className="text-textMain font-medium">
                      {planLabels[user.plan] || user.plan.toUpperCase()}
                    </div>
                  </div>
                  {user.activeUntil && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Activo hasta</div>
                      <div className="text-textMain">
                        <Countdown targetDate={user.activeUntil} />
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Cuenta creada</div>
                    <div className="text-textMain text-sm">{formatDate(user.createdAt)}</div>
                  </div>
                  {user.updatedAt && user.updatedAt !== user.createdAt && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Última actualización</div>
                      <div className="text-textMain text-sm">{formatDate(user.updatedAt)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-red-300">No se pudo cargar la información del usuario</p>
            </div>
          )}

          {/* Upgrade to Event Plan Button */}
          {plan === 'free' && (
            <div className="mt-6 p-4 rounded-xl bg-blue-500/20 border border-blue-500/30">
              <p className="text-sm text-blue-300 mb-3">
                Actualiza a Event 24h para desbloquear todas las funciones
              </p>
              <button
                onClick={handleStartCheckout}
                disabled={isStartingCheckout}
                className="w-full p-3 rounded-xl bg-blue-500/30 border border-blue-500/40 hover:bg-blue-500/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {isStartingCheckout ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Procesando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Activar 24h
                  </>
                )}
              </button>
            </div>
          )}

          <button
            onClick={() => setShowUserInfo(false)}
            className="w-full mt-6 p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  if (showGameConfig && gameDefinition?.GameConfigComponent) {
    const GameConfigComponent = gameDefinition.GameConfigComponent
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-config-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => setShowGameConfig(false)} aria-hidden="true" />
        <div className="relative card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 id="game-config-title" className="text-xl font-semibold">Configurar juego</h2>
            <button
              onClick={() => setShowGameConfig(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <GameConfigComponent
            gameId={gameId ?? null}
            gameName={gameDefinition.name}
            settings={gameSettings}
            onChange={handleGameConfigChange}
          />
        </div>
      </div>
    )
  }

  if (showExportQuiz) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-quiz-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => setShowExportQuiz(false)} aria-hidden="true" />
        <div className="relative card w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="export-quiz-title" className="text-xl font-semibold">Exportar Datos del Quiz</h2>
            <button
              onClick={() => {
                setShowExportQuiz(false)
                setExportQuizError(null)
                setExportQuizData(null)
                setShowExportShareOptions(false)
              }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 space-y-4">
            {!showExportShareOptions ? (
              <>
                <p className="text-sm text-gray-300">
                  Antes de terminar el juego, puedes exportar los datos del quiz para conservarlos.
                </p>
                {!features.exportResults && (
                  <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                    <p className="text-yellow-300 text-sm">
                      Disponible en el plan Event
                    </p>
                  </div>
                )}
                <button
                  onClick={handleExportQuizBeforeTerminate}
                  disabled={isExportingQuiz || !gameId || !features.exportResults}
                  className="w-full p-3 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!features.exportResults ? 'Disponible en el plan Event' : undefined}
                >
                  <div className="flex items-center justify-center gap-2">
                    {isExportingQuiz ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Exportando...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Exportar Datos del Quiz
                      </>
                    )}
                  </div>
                </button>
                {exportQuizError && (
                  <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                    {exportQuizError}
                  </div>
                )}
                <button
                  onClick={proceedWithTermination}
                  disabled={isTerminating}
                  className="w-full p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-center gap-2">
                    {isTerminating ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Terminando...
                      </>
                    ) : (
                      <>
                        Omitir y terminar juego
                      </>
                    )}
                  </div>
                </button>
              </>
            ) : (
              <>
                <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30">
                  <p className="text-green-300 text-sm">
                    ✓ Datos del quiz exportados exitosamente
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleShareQuizData}
                    className="w-full p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Compartir
                    </div>
                  </button>
                  <button
                    onClick={handleDownloadQuizData}
                    className="w-full p-3 rounded-xl bg-green-500/20 border border-green-500/30 hover:bg-green-500/30 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Descargar
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => {
              setShowExportQuiz(false)
              setExportQuizError(null)
              setExportQuizData(null)
              setShowExportShareOptions(false)
            }}
            className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (showExitConfirm) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-confirm-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => setShowExitConfirm(false)} aria-hidden="true" />
        <div className="relative card w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 id="exit-confirm-title" className="text-xl font-semibold">
              {gameType?.toLowerCase() === 'empareja2' ? 'Salir de la partida' : 'Terminar el juego'}
            </h2>
            <button
              onClick={() => setShowExitConfirm(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6 space-y-4">
            <button
              onClick={() => {
                setShowExitConfirm(false)
                if (onLeaveGame) {
                  onLeaveGame()
                }
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
                </svg>
              </div>
              <div className="text-left flex-1">
                <div className="font-medium">Salir del juego</div>
                <div className="text-sm text-gray-400">Volver a la selección de partida</div>
              </div>
            </button>

            <div className="relative">
              <button
                onClick={handleTerminateGame}
                disabled={isTerminating}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                <div className="p-2 rounded-lg bg-red-500/20">
                  {isTerminating ? (
                    <svg className="w-5 h-5 text-red-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div className="text-left flex-1">
                  <div className="font-medium">{isTerminating ? 'Terminando...' : 'Terminar el juego'}</div>
                  <div className="text-sm text-gray-400">Desactivar la partida permanentemente</div>
                </div>
              </button>
              <div className="mt-2 p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                <p className="text-yellow-300 text-sm">
                  ⚠️ Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            {terminateError && (
              <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                {terminateError}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setShowExitConfirm(false)
              setTerminateError(null)
            }}
            className="w-full p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (showRemovePlayer) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-player-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => setShowRemovePlayer(false)} aria-hidden="true" />
        <div className="relative card w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRemovePlayer(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Volver"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 id="remove-player-title" className="text-xl font-semibold">Eliminar Jugador</h2>
            </div>
            <button
              onClick={() => setShowRemovePlayer(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {removeSuccess ? (
            <div className="text-center">
              <div className="p-4 rounded-xl bg-green-500/20 border border-green-500/30 mb-4">
                <div className="flex items-center justify-center gap-2 text-green-300 mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Jugador Eliminado</span>
                </div>
                <p className="text-sm text-green-400">
                  El jugador @{usernameToDelete.replace(/^@/, '')} ha sido eliminado del juego.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-4">
                <div>
                  <label htmlFor="delete-username" className="block text-sm text-gray-300 mb-2">
                    Nombre de usuario a eliminar
                  </label>
                  <input
                    id="delete-username"
                    type="text"
                    value={usernameToDelete}
                    onChange={(e) => setUsernameToDelete(e.target.value)}
                    placeholder="ej. usuario123"
                    className="w-full h-11 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 outline-none focus:border-white/20"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Ingresa el nombre de usuario (con o sin @)
                  </p>
                </div>
                
                <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              {removeError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                  {removeError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRemovePlayer(false)
                    setUsernameToDelete('')
                    setRemoveError(null)
                  }}
                  className="flex-1 p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRemovePlayer}
                  disabled={isRemoving || !usernameToDelete.trim()}
                  className="flex-1 p-3 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRemoving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div className="relative card w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 id="settings-title" className="text-xl font-semibold">Configuración</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Cerrar configuración"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* User Info - Only available when no game is active */}
          {!gameType && (
            <button
              onClick={() => setShowUserInfo(true)}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
            >
              <div className="p-2 rounded-lg bg-blue-500/20">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="text-left">
                <div className="font-medium">Información del Usuario</div>
                <div className="text-sm text-gray-400">Ver detalles de tu cuenta</div>
              </div>
              <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* No game selected - appearance settings and exit app option */}
          {!gameType && (
            <>
              <button
                onClick={() => setShowAppearanceSettings(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Configurar aspecto</div>
                  <div className="text-sm text-gray-400">Personalizar colores y logo</div>
                </div>
                <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => {
                  onClose()
                  if (onExitApp) {
                    onExitApp()
                  }
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-red-500/20">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Salir de la aplicación</div>
                  <div className="text-sm text-gray-400">Cerrar la aplicación</div>
                </div>
              </button>
            </>
          )}

          {/* Game-specific options */}
          {gameType && (
            <>
              {/* Quiz - For all games, disabled for FREE plan */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (plan === 'free') return
                    setShowQuiz(true)
                  }}
                  disabled={plan === 'free'}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 transition-colors relative ${
                    plan !== 'free'
                      ? 'hover:bg-[rgba(255,255,255,0.1)]' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  title={plan === 'free' ? 'Disponible en el plan Event 24h' : undefined}
                >
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Quiz</div>
                    <div className="text-sm text-gray-400">
                      {plan !== 'free'
                        ? 'Crear y configurar un quiz'
                        : 'Disponible en el plan Event 24h'}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Game Config - Only show if game has GameConfigComponent */}
              {gameDefinition?.GameConfigComponent && (
                <button
                  onClick={() => setShowGameConfig(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                >
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Configurar juego</div>
                    <div className="text-sm text-gray-400">
                      Configurar opciones del juego
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Raffle - Always shown, disabled for FREE plan */}
              <div className="relative">
                <button
                  onClick={() => {
                    if (!features.raffles) return
                    setShowRaffle(true)
                  }}
                  disabled={!features.raffles}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 transition-colors relative ${
                    features.raffles 
                      ? 'hover:bg-[rgba(255,255,255,0.1)]' 
                      : 'opacity-50 cursor-not-allowed'
                  }`}
                  title={!features.raffles ? 'Disponible en el plan Event 24h' : undefined}
                >
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">Sorteo</div>
                    <div className="text-sm text-gray-400">
                      {features.raffles 
                        ? 'Realizar un sorteo entre jugadores'
                        : 'Disponible en el plan Event 24h'}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Delete Player - For all games */}
              <button
                onClick={() => setShowRemovePlayer(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-red-500/20">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">Eliminar Jugador</div>
                  <div className="text-sm text-gray-400">
                    Eliminar un jugador del juego
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Exit Game - Different text for different games */}
              <button
                onClick={() => setShowExitConfirm(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <svg className="w-5 h-5 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">
                    {gameType.toLowerCase() === 'empareja2' ? 'Salir de la partida' : 'Terminar el juego'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {gameType.toLowerCase() === 'empareja2' ? 'Volver a la selección de partida' : 'Finalizar y salir del juego'}
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
