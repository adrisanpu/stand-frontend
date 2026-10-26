import { useState, useEffect, useRef } from 'react'
import Raffle from '../widgets/Raffle'
import Quiz from '../widgets/Quiz'
import AppearanceSettings from '../settings/AppearanceSettings'
import GamePlayersSettings from '../settings/GamePlayersSettings'
import OperatorPrizeSettings from '../settings/OperatorPrizeSettings'
import type { GameDefinition } from '../types'
import { api } from '../../api/api'
import { useAuth } from '../../auth/AuthContext'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { getFeaturesByPlan } from '../../auth/featureFlags'
import { inputManager } from '../input/inputManager'
import GameConfigPanel, { type GameConfigSavedPatch } from '../settings/GameConfigPanel'
import { OperatorLanguageSelector, useOperatorLanguage } from './operatorLanguage'

type SettingsMenuProps = {
  onClose: () => void
  gameId?: string
  gameType?: string
  gameDefinition?: GameDefinition
  onLeaveGame?: () => void
  onExitApp?: () => void
  onConfigSaved?: () => void
}

function Countdown({ targetDate }: { targetDate: string }) {
  const { t } = useOperatorLanguage()
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    const updateCountdown = () => {
      try {
        const target = new Date(targetDate).getTime()
        const difference = target - Date.now()

        if (difference <= 0) {
          setTimeLeft('expired')
          return
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24))
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((difference % (1000 * 60)) / 1000)

        if (days > 0) setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
        else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
        else if (minutes > 0) setTimeLeft(`${minutes}m ${seconds}s`)
        else setTimeLeft(`${seconds}s`)
      } catch {
        setTimeLeft('error')
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return <span>{timeLeft === 'expired' ? t('Expirado', 'Expired') : timeLeft === 'error' ? t('Error', 'Error') : timeLeft}</span>
}

export default function SettingsMenu({ onClose, gameId, gameType, gameDefinition, onLeaveGame, onExitApp, onConfigSaved }: SettingsMenuProps) {
  const [showRaffle, setShowRaffle] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  /** tras 1er clic en «Terminar el juego» mostramos el aviso irreversible; 2º clic continúa */
  const [terminateIrreversibleAck, setTerminateIrreversibleAck] = useState(false)
  const [isTerminating, setIsTerminating] = useState(false)
  const [terminateError, setTerminateError] = useState<string | null>(null)
  const [showExportQuiz, setShowExportQuiz] = useState(false)
  const [isExportingQuiz, setIsExportingQuiz] = useState(false)
  const [exportQuizData, setExportQuizData] = useState<any>(null)
  const [showExportShareOptions, setShowExportShareOptions] = useState(false)
  const [exportQuizError, setExportQuizError] = useState<string | null>(null)
  const [showGameConfig, setShowGameConfig] = useState(false)
  const [showGamePlayers, setShowGamePlayers] = useState(false)
  const [showOperatorPrizes, setShowOperatorPrizes] = useState(false)
  const [prizeSaving, setPrizeSaving] = useState(false)
  const prizeSavingRef = useRef(false)
  const [gameSettings, setGameSettings] = useState<any>(null)
  const gameSettingsRef = useRef(gameSettings)
  gameSettingsRef.current = gameSettings
  const [gameConfigSaving, setGameConfigSaving] = useState(false)
  const gameConfigSavingRef = useRef(false)
  gameConfigSavingRef.current = gameConfigSaving
  const [showAppearanceSettings, setShowAppearanceSettings] = useState(false)
  const [showUserInfo, setShowUserInfo] = useState(false)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)
  const { logout } = useAuth()
  const { language, t } = useOperatorLanguage()
  const { user, loading: userLoading, plan } = useCurrentUser()
  const features = getFeaturesByPlan(plan)

  const translateKnownError = (message: string) => {
    const translations: Record<string, string> = {
    'No hay gameId disponible': t('No hay gameId disponible', 'No gameId is available'),
    'No se recibió URL de pago': t('No se recibió URL de pago', 'No payment URL was received'),
    'Error al iniciar el pago. Por favor, intenta de nuevo.': t('Error al iniciar el pago. Por favor, intenta de nuevo.', 'Error starting checkout. Please try again.'),
    'Error al exportar los datos del quiz': t('Error al exportar los datos del quiz', 'Error exporting quiz data'),
    'No se pudo copiar al portapapeles. Por favor, copia manualmente.': t('No se pudo copiar al portapapeles. Por favor, copia manualmente.', 'Could not copy to clipboard. Please copy it manually.'),
    'Error al terminar la partida': t('Error al terminar la partida', 'Error ending the game'),
    }
    return Object.prototype.hasOwnProperty.call(translations, message) ? translations[message] : message
  }

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const settingsMainListRef = useRef<HTMLDivElement>(null)

  const modalSnapRef = useRef({
    showRaffle: false,
    showQuiz: false,
    showExitConfirm: false,
    showExportQuiz: false,
    showExportShareOptions: false,
    showGameConfig: false,
    showGamePlayers: false,
    showOperatorPrizes: false,
    showAppearanceSettings: false,
    showUserInfo: false,
  })
  modalSnapRef.current = {
    showRaffle,
    showQuiz,
    showExitConfirm,
    showExportQuiz,
    showExportShareOptions,
    showGameConfig,
    showGamePlayers,
    showOperatorPrizes,
    showAppearanceSettings,
    showUserInfo,
  }

  useEffect(() => {
    return inputManager.registerBackInterceptor(() => {
      const s = modalSnapRef.current
      if (s.showExportShareOptions) {
        setShowExportShareOptions(false)
        return true
      }
      if (s.showExportQuiz) {
        setShowExportQuiz(false)
        setExportQuizError(null)
        setExportQuizData(null)
        setShowExportShareOptions(false)
        return true
      }
      if (s.showExitConfirm) {
        setShowExitConfirm(false)
        setTerminateIrreversibleAck(false)
        return true
      }
      if (s.showOperatorPrizes) {
        if (!prizeSavingRef.current) setShowOperatorPrizes(false)
        return true
      }
      if (s.showGamePlayers) {
        setShowGamePlayers(false)
        return true
      }
      if (s.showGameConfig) {
        if (!gameConfigSavingRef.current) setShowGameConfig(false)
        return true
      }
      if (s.showUserInfo) {
        setShowUserInfo(false)
        return true
      }
      if (s.showAppearanceSettings) {
        setShowAppearanceSettings(false)
        return true
      }
      if (s.showQuiz) {
        setShowQuiz(false)
        return true
      }
      if (s.showRaffle) {
        setShowRaffle(false)
        return true
      }
      onCloseRef.current()
      return true
    })
  }, [])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      settingsMainListRef.current?.querySelector('button')?.focus()
    })
    return () => window.cancelAnimationFrame(id)
  }, [])

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
      const merged = { ...(gameSettingsRef.current || {}), ...newSettings }
      const { close: shouldClose, refreshGameScreen, ...toPersist } = merged
      localStorage.setItem(storageKey, JSON.stringify(toPersist))
      gameSettingsRef.current = toPersist
      setGameSettings(toPersist)
      // Notify AppShell so it refreshes gameSettings (top X, premios, etc.) in the main view
      onConfigSaved?.()
      if (refreshGameScreen === true) {
        // already notified above
      }
      if (shouldClose === true) {
        setShowGameConfig(false)
        onClose()
      }
    }
  }

  const closeGameConfig = () => {
    if (!gameConfigSavingRef.current) setShowGameConfig(false)
  }

  const handleGameConfigSaved = (patch: GameConfigSavedPatch) => {
    handleGameConfigChange(patch)
    setShowGameConfig(false)
    onClose()
  }

  const handleOperatorPrizePersist = (patch: Record<string, unknown>) => {
    if (!gameId || !gameDefinition?.id) return
    const storageKey = `${gameDefinition.id}_settings_${gameId}`
    const merged = { ...(gameSettingsRef.current || {}), ...patch }
    const { close: shouldClose, refreshGameScreen, ...toPersist } = merged as Record<string, unknown> & {
      close?: boolean
      refreshGameScreen?: boolean
    }
    localStorage.setItem(storageKey, JSON.stringify(toPersist))
    gameSettingsRef.current = toPersist
    setGameSettings(toPersist)
    onConfigSaved?.()
    if (shouldClose === true) {
      setShowOperatorPrizes(false)
      onClose()
    }
  }

  const handleStartCheckout = async () => {
    setIsStartingCheckout(true)
    try {
      const data = await api.post<{ ok: boolean; checkoutUrl: string; sessionId: string }>('/v1/billing/checkout', {})
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        throw new Error('No se recibió URL de pago')
      }
    } catch (error: any) {
      console.error('Error starting checkout:', error)
      alert(translateKnownError(error.message || 'Error al iniciar el pago. Por favor, intenta de nuevo.'))
      setIsStartingCheckout(false)
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
      const data = await api.get(`/quiz?gameId=${encodeURIComponent(gameId)}`)
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
          title: `${t('Datos del Quiz', 'Quiz data')} - ${exportQuizData.gameId}`,
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
      await api.put('/v1/game', { gameId, isActive: false })

      // Close the popup and settings menu, then leave the game
      setShowExportQuiz(false)
      setShowExitConfirm(false)
      setTerminateIrreversibleAck(false)
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

  if (showGamePlayers && gameId) {
    return <GamePlayersSettings gameId={gameId} onBack={() => setShowGamePlayers(false)} onClose={onClose} />
  }

  if (showAppearanceSettings) {
    return (
      <AppearanceSettings
        onBack={() => setShowAppearanceSettings(false)}
        onCloseMenu={onClose}
        gameDefinition={gameDefinition}
      />
    )
  }

  if (showUserInfo) {
    const formatDate = (dateString: string | undefined) => {
      if (!dateString)       return t('N/A', 'N/A')
      try {
        const date = new Date(dateString)
        return date.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
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
      free: t('Gratis', 'Free'),
      event: t('Evento 24h', 'Event 24h'),
      enterprise: 'Enterprise'
    }

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-info-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => setShowUserInfo(false)} aria-hidden="true" />
        <div className="relative card w-full max-w-md p-6 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between mb-6 flex-shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setShowUserInfo(false)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
                aria-label={t('Volver', 'Back')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 id="user-info-title" className="text-xl font-semibold truncate">
                {t('Información del Usuario', 'User information')}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
            <OperatorLanguageSelector />
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
              aria-label={t('Cerrar configuración', 'Close settings')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {userLoading ? (
              <div className="text-center py-8">
                <p className="text-textSub">{t('Cargando información...', 'Loading information...')}</p>
              </div>
            ) : user ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10">
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">{t('Email', 'Email')}</div>
                      <div className="text-textMain font-medium">{user.email || t('No disponible', 'Not available')}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">{t('Plan', 'Plan')}</div>
                      <div className="text-textMain font-medium">
                        {planLabels[user.plan] || user.plan.toUpperCase()}
                      </div>
                    </div>
                    {user.activeUntil && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">{t('Activo hasta', 'Active until')}</div>
                        <div className="text-textMain">
                          <Countdown targetDate={user.activeUntil} />
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-400 mb-1">{t('Cuenta creada', 'Account created')}</div>
                      <div className="text-textMain text-sm">{formatDate(user.createdAt)}</div>
                    </div>
                    {user.updatedAt && user.updatedAt !== user.createdAt && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">{t('Última actualización', 'Last updated')}</div>
                        <div className="text-textMain text-sm">{formatDate(user.updatedAt)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-red-300">{t('No se pudo cargar la información del usuario', 'Could not load user information')}</p>
              </div>
            )}

            {/* Upgrade to Event Plan Button */}
            {plan === 'free' && (
              <div className="mt-2 p-4 rounded-xl bg-blue-500/20 border border-blue-500/30">
                <p className="text-sm text-blue-300 mb-3">
                  {t('Actualiza a Event 24h para desbloquear todas las funciones', 'Upgrade to Event 24h to unlock all features')}
                </p>
                <button
                  onClick={handleStartCheckout}
                  disabled={isStartingCheckout}
                  className="w-full p-3 rounded-xl bg-primary/30 border border-primary/40 hover:bg-primary/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {isStartingCheckout ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {t('Procesando...', 'Processing...')}
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('Activar 24h', 'Activate 24h')}
                    </>
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                onClose()
                logout()
              }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 transition-colors font-medium text-red-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('Cerrar sesión', 'Log out')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showOperatorPrizes && gameId && gameDefinition) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="operator-prizes-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        <div className="absolute inset-0 bg-black/70" onClick={() => { if (!prizeSavingRef.current) onClose() }} aria-hidden="true" />
        <div className="relative card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 p-6 pb-4 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => { if (!prizeSavingRef.current) setShowOperatorPrizes(false) }}
                disabled={prizeSaving}
                className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label={t('Volver', 'Back')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 id="operator-prizes-title" className="text-xl font-semibold truncate">{t('Premios', 'Prizes')}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <OperatorLanguageSelector />
            <button
              type="button"
              onClick={() => { if (!prizeSavingRef.current) onClose() }}
              disabled={prizeSaving}
              className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label={t('Cerrar', 'Close')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6">
            <OperatorPrizeSettings
              gameId={gameId}
              gameDefinition={gameDefinition}
              settings={gameSettings}
              plan={plan}
              onPersist={handleOperatorPrizePersist}
              onSavingChange={(value) => {
                prizeSavingRef.current = value
                setPrizeSaving(value)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (showGameConfig && gameDefinition && gameId) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-config-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        <div className="absolute inset-0 bg-black/70" onClick={closeGameConfig} aria-hidden="true" />
        <div className="relative card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={closeGameConfig}
                disabled={gameConfigSaving}
                className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0 disabled:opacity-40"
                aria-label={t('Volver al juego', 'Back to game')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 id="game-config-title" className="text-xl font-semibold truncate">{t('Configurar juego', 'Configure game')}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <OperatorLanguageSelector />
            <button
              type="button"
              onClick={closeGameConfig}
              disabled={gameConfigSaving}
              className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-40"
              aria-label={t('Cerrar y volver al juego', 'Close and return to game')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
          </div>
          <GameConfigPanel
            gameId={gameId}
            gameDefinition={gameDefinition}
            settings={gameSettings}
            onSettingsChange={handleGameConfigChange}
            onSaved={handleGameConfigSaved}
            onSavingChange={setGameConfigSaving}
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
        <div className="relative card w-full max-w-sm p-6 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 id="export-quiz-title" className="text-xl font-semibold">{t('Exportar Datos del Quiz', 'Export Quiz Data')}</h2>
            <div className="flex items-center gap-2">
              <OperatorLanguageSelector />
            <button
              onClick={() => {
                setShowExportQuiz(false)
                setExportQuizError(null)
                setExportQuizData(null)
                setShowExportShareOptions(false)
              }}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label={t('Cerrar', 'Close')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="mb-6 space-y-4">
              {!showExportShareOptions ? (
                <>
                  <p className="text-sm text-gray-300">
                    {t('Antes de terminar el juego, puedes exportar los datos del quiz para conservarlos.', 'Before ending the game, you can export the Quiz data to keep it.')}
                  </p>
                  {!features.exportResults && (
                    <div className="p-3 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                      <p className="text-yellow-300 text-sm">
                        {t('Disponible en el plan Event', 'Available on the Event plan')}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={handleExportQuizBeforeTerminate}
                    disabled={isExportingQuiz || !gameId || !features.exportResults}
                    className="w-full p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!features.exportResults ? t('Disponible en el plan Event', 'Available on the Event plan') : undefined}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isExportingQuiz ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {t('Exportando...', 'Exporting...')}
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                          </svg>
                          {t('Exportar Datos del Quiz', 'Export Quiz Data')}
                        </>
                      )}
                    </div>
                  </button>
                  {exportQuizError && (
                    <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                      {translateKnownError(exportQuizError)}
                    </div>
                  )}
                  <button
                    onClick={proceedWithTermination}
                    disabled={isTerminating}
                    className="w-full p-3 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isTerminating ? (
                        <>
                          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {t('Terminando...', 'Ending...')}
                        </>
                      ) : (
                        <>
                          {t('Omitir y terminar juego', 'Skip and end game')}
                        </>
                      )}
                    </div>
                  </button>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30">
                    <p className="text-green-300 text-sm">
                      {t('✓ Datos del quiz exportados exitosamente', '✓ Quiz data exported successfully')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      onClick={handleShareQuizData}
                      className="w-full p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        {t('Compartir', 'Share')}
                      </div>
                    </button>
                    <button
                      onClick={handleDownloadQuizData}
                      className="w-full p-3 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {t('Descargar', 'Download')}
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 mt-4">
            <button
              onClick={() => {
                setShowExportQuiz(false)
                setExportQuizError(null)
                setExportQuizData(null)
                setShowExportShareOptions(false)
              }}
              className="w-full p-3 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors"
            >
              {t('Cancelar', 'Cancel')}
            </button>
          </div>
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
        <div
          className="absolute inset-0 bg-black/70"
          onClick={() => {
            setShowExitConfirm(false)
            setTerminateError(null)
            setTerminateIrreversibleAck(false)
          }}
          aria-hidden="true"
        />
        <div className="relative card w-full max-w-sm p-6 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between gap-3 mb-6 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false)
                  setTerminateError(null)
                  setTerminateIrreversibleAck(false)
                }}
                className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label={t('Volver', 'Back')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 id="exit-confirm-title" className="text-xl font-semibold truncate">
                {t('Salir', 'Exit')}
              </h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <OperatorLanguageSelector />
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label={t('Cerrar', 'Close')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-4 flex flex-col">
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirm(false)
                  setTerminateError(null)
                  setTerminateIrreversibleAck(false)
                  if (onLeaveGame) {
                    onLeaveGame()
                  }
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-red-500/20">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="font-medium">{t('Salir del juego', 'Leave game')}</div>
                  <div className="text-sm text-gray-400">{t('Volver a la selección de partida', 'Return to game selection')}</div>
                </div>
              </button>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!terminateIrreversibleAck) {
                      setTerminateIrreversibleAck(true)
                      return
                    }
                    void handleTerminateGame()
                  }}
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
                    <div className="font-medium">{isTerminating ? t('Terminando...', 'Ending...') : t('Terminar el juego', 'End game')}</div>
                    <div className="text-sm text-gray-400">{t('Desactivar la partida permanentemente', 'Permanently deactivate the game')}</div>
                  </div>
                </button>
                {terminateIrreversibleAck && (
                  <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30">
                    <p className="text-red-300/90 text-sm">
                      {t('Esta acción no se puede deshacer. Pulsa otra vez «Terminar el juego» para continuar.', 'This action cannot be undone. Press “End game” again to continue.')}
                    </p>
                  </div>
                )}
              </div>

              {terminateError && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                  {translateKnownError(terminateError)}
                </div>
              )}
            </div>
          </div>
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
      <div className="relative card w-full max-w-sm p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <h2 id="settings-title" className="min-w-0 truncate text-xl font-semibold">{t('Configuración', 'Settings')}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <OperatorLanguageSelector />
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label={t('Cerrar configuración', 'Close settings')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          </div>
        </div>

        <div ref={settingsMainListRef} className="space-y-3 flex-1 min-h-0 overflow-y-auto">
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
                <div className="font-medium">{t('Información del Usuario', 'User information')}</div>
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
                <div className="text-left flex-1 min-w-0">
                  <div className="font-medium">{t('Configurar aspecto', 'Appearance settings')}</div>
                </div>
                <svg
                  className="w-4 h-4 text-gray-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
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
                  <div className="font-medium">{t('Salir de la aplicación', 'Exit application')}</div>
                </div>
              </button>
            </>
          )}

          {/* Game-specific options */}
          {gameType && (
            <>
              {gameDefinition && gameId && (
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
                    <div className="font-medium">{t('Configurar juego', 'Configure game')}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {gameId && gameDefinition && (
                <button
                  type="button"
                  onClick={() => setShowGamePlayers(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                >
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{t('Gestionar jugadores', 'Manage players')}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

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
                  title={plan === 'free' ? t('Disponible en el plan Event 24h', 'Available on the Event 24h plan') : undefined}
                >
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{t('Quiz', 'Quiz')}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

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
                  title={!features.raffles ? t('Disponible en el plan Event 24h', 'Available on the Event 24h plan') : undefined}
                >
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{t('Sorteo', 'Raffle')}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Premios — todos los juegos con partida */}
              {gameId && gameDefinition && (
                <button
                  type="button"
                  onClick={() => setShowOperatorPrizes(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                >
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112-2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{t('Premios', 'Prizes')}</div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Salir: mismo texto en todos los juegos */}
              <button
                onClick={() => {
                  setTerminateIrreversibleAck(false)
                  setShowExitConfirm(true)
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              >
                <div className="p-2 rounded-lg bg-red-500/20">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1" />
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-medium">{t('Salir', 'Exit')}</div>
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
