import { useState, useEffect, useRef, useMemo } from 'react'
import type { GameScreenProps } from '../../core/types'
import { LandscapeInfoInstruction } from '../../core/widgets/GameLandscapeInfoColumn'
import GameLandscapeLeftColumn from '../../core/widgets/GameLandscapeLeftColumn'
import GameStateAvatar from '../../core/widgets/GameStateAvatar'
import BackButton from '../../core/widgets/BackButton'
import MobileParticipantsPanel from '../../core/widgets/MobileParticipantsPanel'
import { api } from '../../api/api'
import { CODE_INPUT_PLACEHOLDER, VALIDATE_LABEL } from '../../core/ui/gameValidationCopy'
import {
  GAME_LANDSCAPE_CENTER_CARD,
  GAME_LANDSCAPE_THREE_COL_GRID,
} from '../../core/ui/gameScreenLayout'
import { useGameInput } from '../../core/input/useGameInput'
import type { InputEventEnvelope } from '../../core/input/types'
import { useAvatarsEnabled } from '../../core/theme'
import { useWebOsPointerPrimary } from '../../core/input/useWebOsPointerPrimary'
import { resolveGameAccess } from '../../core/settings/gameAccess'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'
import { PrizeImage } from '../../core/widgets/PrizePresentation'

type GameState = 'idle' | 'validated' | 'preparing' | 'playing' | 'hidden' | 'finished'

export default function T1merGameScreen({
  gameId,
  orientation,
  logoElement,
  playersElement,
  sidebarElement,
  topX: legacyTopX,
  prizeLabel: legacyPrizeLabel,
  prizeCatalog,
  onCounterActiveChange,
  onAvatarStateChange,
  avatarMediaUrls,
  joinChannel,
  playMode,
}: GameScreenProps) {
  const { t } = useOperatorLanguage()
  const topX = prizeCatalog !== undefined ? prizeCatalog.ranking?.topX : legacyTopX
  const prizeLabel = prizeCatalog !== undefined ? prizeCatalog.ranking?.name : legacyPrizeLabel
  const rankingPrize = prizeCatalog?.ranking
  const avatarsEnabled = useAvatarsEnabled()
  const isPhoneMode = resolveGameAccess('T1MER', { playMode, joinChannel }).playMode === 'mobile'
  const [gameState, setGameState] = useState<GameState>('idle')
  const [timer, setTimer] = useState(0)
  const [playerCode, setPlayerCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ time: number; difference: number } | null>(null)
  const [resultRank, setResultRank] = useState<number | null>(null)
  const intervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const startButtonRef = useRef<HTMLButtonElement | null>(null)
  const stopButtonRef = useRef<HTMLButtonElement | null>(null)
  const resetBackRef = useRef<HTMLButtonElement | null>(null)
  const validateButtonRef = useRef<HTMLButtonElement | null>(null)

  // Notify parent when counter is running so API polling can be paused (avoid lag)
  useEffect(() => {
    const active = gameState === 'playing' || gameState === 'hidden'
    onCounterActiveChange?.(active)
    return () => {
      onCounterActiveChange?.(false)
    }
  }, [gameState, onCounterActiveChange])

  // Timer logic
  useEffect(() => {
    if (gameState === 'playing') {
      intervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        setTimer(elapsed)
        if (elapsed >= 5) {
          setGameState('hidden')
        }
      }, 10) // Update every 10ms for precision
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [gameState])

  const showJoinBlock = gameState === 'idle'

  // Format timer as SS:CC.MMM (seconds:centiseconds.milliseconds)
  const formatTimer = (seconds: number): string => {
    const totalSeconds = Math.floor(seconds)
    const centiseconds = Math.floor((seconds % 1) * 100)
    const milliseconds = Math.floor(((seconds % 1) * 1000) % 10)
    return `${String(totalSeconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}.${String(milliseconds)}`
  }

  const handleValidate = async () => {
    if (!playerCode.trim() || !gameId) {
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      const data = await api.post<{
        valid: boolean
        playerId?: string
        username?: string
        profilePicUrl?: string
        message?: string
        error?: string
      }>('/v1/game/validate', {
        gameId: gameId,
        codes: [String(playerCode).trim()]
      })
      
      if (data.valid && data.playerId) {
        setPlayerId(data.playerId)
        setUsername(data.username || null)
        const pic = typeof data.profilePicUrl === 'string' ? data.profilePicUrl.trim() : ''
        setProfilePicUrl(pic || null)
        setError(null)
        setGameState('preparing')
      } else {
        // If valid is false, show the message from response
        throw new Error(data.message || t('Código inválido', 'Invalid code'))
      }
    } catch (err: any) {
      setError(err.message || t('Error al validar el código', 'Error validating the code'))
    } finally {
      setIsValidating(false)
    }
  }


  const handleStop = () => {
    if (gameState === 'playing' || gameState === 'hidden') {
      const finalTime = (Date.now() - startTimeRef.current) / 1000
      const targetTime = 10.0
      const difference = Math.abs(finalTime - targetTime)
      
      setResult({ time: finalTime, difference })
      setGameState('finished')
      
      // Submit score if playerId is available
      if (playerId && gameId) {
        submitScore(finalTime, difference)
      }
    }
  }

  const handleStart = () => {
    if (gameState === 'preparing') {
      startTimeRef.current = Date.now()
      setGameState('playing')
    }
  }

  const submitScore = async (time: number, difference: number) => {
    if (!playerId || !gameId) {
      console.error('Missing playerId or gameId')
      return
    }

    try {
      const scoreMs = Math.round(difference * 1000)
      const data = await api.post<{ ok: boolean; rank?: number }>('/v1/game/score', {
        gameId: gameId,
        playerId: playerId,
        timer: time.toFixed(3),
        score: scoreMs
      })
      if (data.ok && typeof data.rank === 'number') {
        setResultRank(data.rank)
      }
    } catch (err: any) {
      console.error('Error submitting score:', err)
      setError(err.message || t('Error al enviar la puntuación', 'Error submitting the score'))
    }
  }

  const handleReset = () => {
    setGameState('idle')
    setTimer(0)
    setResult(null)
    setResultRank(null)
    setError(null)
    setPlayerCode('')
    setPlayerId(null)
    setUsername(null)
    setProfilePicUrl(null)
  }

  const handleStartRef = useRef(handleStart)
  const handleStopRef = useRef(handleStop)
  const handleValidateRef = useRef(handleValidate)
  const handleResetFnRef = useRef(handleReset)
  handleStartRef.current = handleStart
  handleStopRef.current = handleStop
  handleValidateRef.current = handleValidate
  handleResetFnRef.current = handleReset

  const gameStateRef = useRef(gameState)
  gameStateRef.current = gameState

  /**
   * Clic en zona vacía (inputManager): validar / empezar / detener.
   * En `finished` no hacemos nada aquí: hace falta un clic explícito en «Volver a validar» (evita que el mismo gesto
   * que detiene salte al reset).
   */
  const inputHandlers = useMemo(
    () => ({
      click: (ev: InputEventEnvelope) => {
        const t = ev.nativeEvent.target
        if (t instanceof Element && t.closest('button, a[href], [role="button"], input, textarea, select')) {
          return
        }
        const st = gameStateRef.current
        if (st === 'finished') return
        if (st === 'idle') {
          void handleValidateRef.current()
          return
        }
        if (st === 'preparing') {
          handleStartRef.current()
        } else if (st === 'playing' || st === 'hidden') {
          handleStopRef.current()
        }
      },
    }),
    []
  )

  useGameInput(`t1mer:${gameId}`, inputHandlers)

  useWebOsPointerPrimary(() => {
    switch (gameStateRef.current) {
      case 'preparing':
        if (!startButtonRef.current) return null
        return { primary: startButtonRef.current, activate: () => handleStartRef.current() }
      case 'playing':
      case 'hidden':
        if (!stopButtonRef.current) return null
        return { primary: stopButtonRef.current, activate: () => handleStopRef.current() }
      case 'finished':
        return null
      case 'idle': {
        const v = validateButtonRef.current
        if (!v || v.disabled) return null
        return { primary: v, activate: () => void handleValidateRef.current() }
      }
      default:
        return null
    }
  })

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null
  const avatarState: string = isPhoneMode
    ? 'idle'
    : gameState === 'preparing'
      ? 'ready'
      : gameState === 'hidden'
        ? 'playing'
        : gameState

  useEffect(() => {
    onAvatarStateChange?.(avatarState)
  }, [avatarState, onAvatarStateChange])

  const gameName = localStorage.getItem('gameName') || gameId || 'T1MER'

  const renderPhoneCenter = () => {
    if (avatarsEnabled) {
      return (
        <GameStateAvatar
          state="idle"
          mediaUrls={avatarMediaUrls}
          t={t}
          className="w-full h-full min-h-[200px]"
        />
      )
    }
    return <MobileParticipantsPanel gameId={gameId!} gameName={gameName} />
  }

  /** Altura fija del contador: no crece ni se mueve entre estados. */
  const t1merTimerSlotClassPortrait =
    'text-center h-[140px] sm:h-[160px] flex items-center justify-center shrink-0 w-full'
  const t1merTimerSlotClass =
    'text-center h-[160px] flex items-center justify-center shrink-0 w-full'
  const t1merActionSlotClass = 'w-full min-w-0 shrink-0 min-h-[7.5rem] flex flex-col justify-center py-2'
  const t1merPrimaryButtonClass =
    'w-full p-8 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors flex items-center justify-center'
  const t1merPrimaryButtonLabelClass = 'text-2xl sm:text-3xl lg:text-4xl font-bold'
  /** Altura fija del bloque de usuario + instrucción: al jugar sigue ocupando sitio para que EMPEZAR y DETENER coincidan. */
  /** Misma caja que “preparing”: aquí va resultado (posición/premio) al terminar para no empujar el contador. */
  const t1merPreparingHeaderSlotLandscape =
    'shrink-0 h-[9rem] flex flex-col justify-center text-center py-3 min-h-0 px-2 sm:px-3'
  const t1merPreparingHeaderSlotPortrait =
    'shrink-0 h-[12.5rem] sm:h-[13rem] flex flex-col justify-center text-center py-4 min-h-0 px-3 sm:px-4'

  if (isPhoneMode && isLandscape) {
    return (
      <div className={GAME_LANDSCAPE_THREE_COL_GRID}>
        <GameLandscapeLeftColumn gameId={gameId} joinChannel={joinChannel} logoElement={logoElement} playersElement={playersElement}>
          <LandscapeInfoInstruction>{t('Los asistentes juegan desde su móvil (/play).', 'Attendees play on their phones (/play).')}</LandscapeInfoInstruction>
          <LandscapeInfoInstruction>{t('Esta es la pantalla del evento para el monitor o proyector.', 'This is the event screen for the monitor or projector.')}</LandscapeInfoInstruction>
          <LandscapeInfoInstruction>{t('Los enlaces están en Configurar juego.', 'Links are in Game Settings.')}</LandscapeInfoInstruction>
        </GameLandscapeLeftColumn>
        <div className={`${GAME_LANDSCAPE_CENTER_CARD} justify-center items-center min-h-0`}>
          {renderPhoneCenter()}
        </div>
        <div className="flex flex-col gap-0 min-h-0 min-w-0 overflow-hidden items-center w-full">
          <div className="flex flex-col gap-1.5 p-0 flex-1 min-h-0 overflow-hidden items-center w-full min-w-0 bg-transparent border-0">
            {sidebarElement}
          </div>
        </div>
      </div>
    )
  }

  if (isPhoneMode) {
    return (
      <div className="w-full h-full min-h-0 flex flex-col overflow-hidden items-center justify-center">
        {renderPhoneCenter()}
      </div>
    )
  }

  if (isLandscape) {
    return (
      <div className={GAME_LANDSCAPE_THREE_COL_GRID}>
        <GameLandscapeLeftColumn
          gameId={gameId}
          joinChannel={joinChannel}
          logoElement={logoElement}
          playersElement={playersElement}
          avatarElement={
            avatarsEnabled ? (
              <GameStateAvatar state={avatarState} mediaUrls={avatarMediaUrls} t={t} />
            ) : undefined
          }
        >
          <LandscapeInfoInstruction>
            {joinChannel === 'instagram' ? t('Escanea el QR y pulsa JUGAR en Instagram.', 'Scan the QR code and tap PLAY on Instagram.') : t('Escanea el QR y completa el formulario web.', 'Scan the QR code and complete the web form.')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('Ingresa tu código y valida.', 'Enter and validate your code.')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('El temporizador se oculta a los 5 s.', 'The timer disappears after 5 seconds.')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('Detén en 10 segundos.', 'Stop at 10 seconds.')}
          </LandscapeInfoInstruction>
        </GameLandscapeLeftColumn>
        <div className={`${GAME_LANDSCAPE_CENTER_CARD} items-center`}>
          {/* Idle: temporizador + código + Validar (validación a escondidas, mismo formulario) */}
          {gameState === 'idle' && (
            <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0">
              <div className="text-center py-6">
                <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-textSub/40 font-digital opacity-50">00:00.0</div>
              </div>
              <div className="max-w-md mx-auto w-full space-y-4">
                <div className="flex gap-3">
                  <input id="player-code-landscape" type="number" inputMode="numeric" min={1000} max={9999} value={playerCode} onChange={(e) => setPlayerCode(String(e.target.value))} placeholder={t(CODE_INPUT_PLACEHOLDER, 'Enter code')} className="flex-1 min-w-0 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20" />
                  <button ref={validateButtonRef} type="button" onClick={handleValidate} disabled={!playerCode.trim() || isValidating} className="inline-flex items-center justify-center gap-2 px-8 h-14 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex-shrink-0">
                    {isValidating ? (
                      <svg className="w-5 h-5 shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {isValidating ? t('Validando…', 'Validating…') : t(VALIDATE_LABEL, 'Validate')}
                  </button>
                </div>
                {error && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{localizeOperatorMessage(error, t)}</div>}
              </div>
            </div>
          )}
          {(gameState === 'preparing' ||
            gameState === 'playing' ||
            gameState === 'hidden' ||
            (gameState === 'finished' && result)) && (
            <div className="flex flex-col gap-5 sm:gap-6 flex-1 min-h-0 w-full min-w-0 justify-start px-1 sm:px-2">
              <div className={t1merPreparingHeaderSlotLandscape}>
                <div className="space-y-2 sm:space-y-3 overflow-y-auto min-h-0 max-h-full overscroll-contain">
                  {gameState === 'preparing' && (
                    <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center sm:gap-4">
                      {profilePicUrl ? (
                        <img
                          src={profilePicUrl}
                          alt={
                            username
                              ? t(`Foto de perfil de ${username.startsWith('@') ? username : `@${username}`}`, `Profile picture of ${username.startsWith('@') ? username : `@${username}`}`)
                              : t('Foto de perfil', 'Profile picture')
                          }
                          referrerPolicy="no-referrer"
                          className="h-14 w-14 shrink-0 rounded-full border-2 border-primary/40 object-cover shadow-md sm:h-16 sm:w-16"
                        />
                      ) : null}
                      <div className="min-w-0 max-w-full space-y-2 text-center sm:space-y-3 sm:text-left">
                        {username && (
                          <p className="text-3xl font-bold leading-tight text-primary">
                            {username.startsWith('@') ? username : `@${username}`}
                          </p>
                        )}
                        <p className="text-xl leading-snug text-textSub sm:text-2xl">
                          {t('Detén el contador cuando llegue a', 'Stop the timer when it reaches')}{' '}
                          <span className="font-digital text-2xl text-primary sm:text-3xl">10:00.0</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {gameState === 'finished' && result && (
                    <>
                      {resultRank != null && (
                        <div className="text-xl sm:text-2xl font-semibold text-textMain leading-tight">{t('Posición:', 'Rank:')} {resultRank}</div>
                      )}
                      {topX != null && resultRank != null && resultRank <= topX && (prizeCatalog === undefined || prizeLabel || rankingPrize?.imageUrl) && (
                        <div className="text-base sm:text-lg font-semibold text-green-400 leading-snug flex items-center justify-center gap-2">
                          <PrizeImage prize={rankingPrize} compact />
                          {t(`¡Premio por entrar en el top ${topX}!`, `Prize for reaching the top ${topX}!`)}{prizeLabel ? ` ${prizeLabel}` : ''}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-5 sm:gap-6 min-w-0 shrink-0 w-full">
                <div className={t1merTimerSlotClass}>
                  {gameState === 'preparing' && (
                    <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-textSub/40 font-digital opacity-50">00:00.0</div>
                  )}
                  {gameState === 'playing' && (
                    <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-primary font-digital">{formatTimer(timer)}</div>
                  )}
                  {gameState === 'hidden' && (
                    <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-textSub/40 font-digital">???</div>
                  )}
                  {gameState === 'finished' && result && (
                    <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-primary font-digital">{formatTimer(result.time)}</div>
                  )}
                </div>
                <div className={t1merActionSlotClass}>
                  {gameState === 'preparing' && (
                    <button
                      ref={startButtonRef}
                      type="button"
                      onClick={handleStart}
                      className={t1merPrimaryButtonClass}
                    >
                      <span className={t1merPrimaryButtonLabelClass}>{t('EMPEZAR', 'START')}</span>
                    </button>
                  )}
                  {(gameState === 'playing' || gameState === 'hidden') && (
                    <button
                      ref={stopButtonRef}
                      type="button"
                      onClick={handleStop}
                      className={t1merPrimaryButtonClass}
                    >
                      <span className={t1merPrimaryButtonLabelClass}>{t('DETENER', 'STOP')}</span>
                    </button>
                  )}
                  {gameState === 'finished' && result && (
                    <div className="flex justify-center items-center min-h-[7.5rem] py-2">
                      <BackButton ref={resetBackRef} onClick={handleReset} aria-label={t('Volver a validar', 'Validate again')} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-0 min-h-0 min-w-0 overflow-hidden items-center w-full">
          <div className="flex flex-col gap-1.5 p-0 flex-1 min-h-0 overflow-hidden items-center w-full min-w-0 bg-transparent border-0">
            {sidebarElement}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden min-w-0 w-full items-center">
      {!showJoinBlock && (
        <div className="flex-shrink-0 flex justify-end w-full mb-2">
          <BackButton onClick={handleReset} aria-label={t('Volver', 'Back')} />
        </div>
      )}
      <div className="flex flex-col overflow-hidden min-h-0 flex-1 w-full gap-3">
      <div className="flex-1 min-h-0 flex flex-col justify-start overflow-hidden min-w-0 w-full">
        <div className="space-y-6 flex flex-col flex-1 min-h-0 justify-start">
          {gameState === 'idle' && (
            <div className="flex-1 flex flex-col justify-center min-h-0">
              <div className="text-center py-6">
                <div className="font-normal text-textSub/40 font-digital opacity-50 text-6xl sm:text-7xl lg:text-8xl">00:00.0</div>
              </div>
              <div className="flex-shrink-0 space-y-4">
                <div className="flex gap-3">
                  <input
                    id="player-code"
                    type="number"
                    inputMode="numeric"
                    min={1000}
                    max={9999}
                    value={playerCode}
                    onChange={(e) => setPlayerCode(String(e.target.value))}
                    placeholder={t(CODE_INPUT_PLACEHOLDER, 'Enter code')}
                    className="flex-1 min-w-0 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20"
                  />
                  <button
                    ref={validateButtonRef}
                    type="button"
                    onClick={handleValidate}
                    disabled={!playerCode.trim() || isValidating}
                    className="inline-flex items-center justify-center gap-2 px-8 h-14 rounded-xl bg-primary/20 border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex-shrink-0"
                  >
                    {isValidating ? (
                      <svg className="w-5 h-5 shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {isValidating ? t('Validando…', 'Validating…') : t(VALIDATE_LABEL, 'Validate')}
                  </button>
                </div>
                {error && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">{localizeOperatorMessage(error, t)}</div>}
              </div>
            </div>
          )}
          {(gameState === 'preparing' ||
            gameState === 'playing' ||
            gameState === 'hidden' ||
            (gameState === 'finished' && result)) && (
            <div className="flex flex-col gap-5 sm:gap-6 flex-1 min-h-0 w-full min-w-0 justify-start px-2 sm:px-3">
              <div className={t1merPreparingHeaderSlotPortrait}>
                <div className="space-y-2 sm:space-y-3 overflow-y-auto min-h-0 max-h-full overscroll-contain">
                  {gameState === 'preparing' && (
                    <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center sm:gap-4">
                      {profilePicUrl ? (
                        <img
                          src={profilePicUrl}
                          alt={
                            username
                              ? t(`Foto de perfil de ${username.startsWith('@') ? username : `@${username}`}`, `Profile picture of ${username.startsWith('@') ? username : `@${username}`}`)
                              : t('Foto de perfil', 'Profile picture')
                          }
                          referrerPolicy="no-referrer"
                          className="h-16 w-16 shrink-0 rounded-full border-2 border-primary/40 object-cover shadow-md sm:h-[4.5rem] sm:w-[4.5rem]"
                        />
                      ) : null}
                      <div className="min-w-0 max-w-full space-y-2 text-center sm:space-y-3 sm:text-left">
                        {username && (
                          <p className="text-4xl font-bold leading-tight text-primary lg:text-5xl">
                            {username.startsWith('@') ? username : `@${username}`}
                          </p>
                        )}
                        <p className="text-lg leading-snug text-textSub sm:text-xl lg:text-2xl">
                          {t('Detén el contador cuando llegue a', 'Stop the timer when it reaches')}{' '}
                          <span className="font-digital text-2xl text-primary sm:text-3xl lg:text-4xl">10:00.0</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {gameState === 'finished' && result && (
                    <>
                      {resultRank != null && (
                        <div
                          className="text-xl sm:text-2xl font-semibold text-textMain leading-tight"
                        >
                          {t('Posición:', 'Rank:')} {resultRank}
                        </div>
                      )}
                      {topX != null && resultRank != null && resultRank <= topX && (prizeCatalog === undefined || prizeLabel || rankingPrize?.imageUrl) && (
                        <div className="text-base sm:text-lg lg:text-xl font-semibold text-green-400 leading-snug flex items-center justify-center gap-2">
                          <PrizeImage prize={rankingPrize} compact />
                          {t(`¡Premio por entrar en el top ${topX}!`, `Prize for reaching the top ${topX}!`)}{prizeLabel ? ` ${prizeLabel}` : ''}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-5 sm:gap-6 shrink-0 w-full">
                <div className={t1merTimerSlotClassPortrait}>
                  {gameState === 'preparing' && (
                    <div className="font-normal text-textSub/40 font-digital opacity-50 text-6xl sm:text-7xl lg:text-8xl">00:00.0</div>
                  )}
                  {gameState === 'playing' && (
                    <div className="font-normal text-primary font-digital text-6xl sm:text-7xl lg:text-8xl">{formatTimer(timer)}</div>
                  )}
                  {gameState === 'hidden' && (
                    <div className="font-normal text-textSub/40 font-digital text-6xl sm:text-7xl lg:text-8xl">???</div>
                  )}
                  {gameState === 'finished' && result && (
                    <div className="font-normal text-primary font-digital text-6xl sm:text-7xl lg:text-8xl">{formatTimer(result.time)}</div>
                  )}
                </div>
                <div className={t1merActionSlotClass}>
                  {gameState === 'preparing' && (
                    <button
                      ref={startButtonRef}
                      type="button"
                      onClick={handleStart}
                      className={t1merPrimaryButtonClass}
                    >
                      <span className={t1merPrimaryButtonLabelClass}>{t('EMPEZAR', 'START')}</span>
                    </button>
                  )}
                  {(gameState === 'playing' || gameState === 'hidden') && (
                    <button
                      ref={stopButtonRef}
                      type="button"
                      onClick={handleStop}
                      className={t1merPrimaryButtonClass}
                    >
                      <span className={t1merPrimaryButtonLabelClass}>{t('DETENER', 'STOP')}</span>
                    </button>
                  )}
                  {gameState === 'finished' && result && (
                    <div className="flex justify-center items-center min-h-[7.5rem] py-2">
                      <BackButton ref={resetBackRef} onClick={handleReset} aria-label={t('Volver a validar', 'Validate again')} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {gameState === 'finished' && result && error && (
        <div className="flex-shrink-0 space-y-4">
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{localizeOperatorMessage(error, t)}</div>
        </div>
      )}
    </div>
  )
}
