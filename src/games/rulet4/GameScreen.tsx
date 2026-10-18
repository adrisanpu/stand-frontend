import { useState, useEffect, useRef } from 'react'
import type { GameScreenProps } from '../../core/types'
import { LandscapeInfoInstruction } from '../../core/widgets/GameLandscapeInfoColumn'
import GameLandscapeLeftColumn from '../../core/widgets/GameLandscapeLeftColumn'
import BackButton from '../../core/widgets/BackButton'
import type { Rulet4Settings, Rulet4PanelConfig } from './GameConfig'
import { api } from '../../api/api'
import { CODE_INPUT_PLACEHOLDER, VALIDATE_LABEL } from '../../core/ui/gameValidationCopy'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { localizeOperatorMessage } from '../operatorText'
import Rulet4Wheel, { type WheelSpin } from './Rulet4Wheel'
import {
  GAME_LANDSCAPE_CENTER_CARD,
  GAME_LANDSCAPE_THREE_COL_GRID,
} from '../../core/ui/gameScreenLayout'

type GameState =
  | 'idle'       // player code input
  | 'validating' // calling /validate
  | 'ready'      // validated, ready to spin
  | 'spinning'   // roulette animation in progress
  | 'result'     // showing selected panel
  | 'finished'   // optional; auto-reset logic

export default function Rulet4GameScreen({ gameId, orientation, logoElement, playersElement, sidebarElement }: GameScreenProps) {
  const { t } = useOperatorLanguage()
  const [gameState, setGameState] = useState<GameState>('idle')
  const [playerCode, setPlayerCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [winningPanel, setWinningPanel] = useState<Rulet4PanelConfig | null>(null)
  const [settings, setSettings] = useState<Rulet4Settings | null>(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [spin, setSpin] = useState<WheelSpin | null>(null)
  const pendingSpinRef = useRef<{ id: number; panel: Rulet4PanelConfig; index: number } | null>(null)
  const spinIdRef = useRef(0)
  const validationRef = useRef<object>({})
  const hasSpunRef = useRef(false)

  useEffect(() => {
    handleReset()
    return () => {
      pendingSpinRef.current = null
      validationRef.current = {}
    }
  }, [gameId])

  // Load settings from localStorage
  useEffect(() => {
    if (gameId) {
      const storageKey = `RULET4_settings_${gameId}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          setSettings(JSON.parse(saved))
        } catch {
          // Use default settings
          setSettings({ panels: [
            { id: '1', label: 'Rojo', color: '#DC2626', count: 4 },
            { id: '2', label: 'Negro', color: '#000000', count: 4 },
            { id: '3', label: 'Verde', color: '#22C55E', count: 1 },
          ]})
        }
      } else {
        // Use default settings
        setSettings({ panels: [
          { id: '1', label: 'Rojo', color: '#DC2626', count: 4 },
          { id: '2', label: 'Negro', color: '#000000', count: 4 },
          { id: '3', label: 'Verde', color: '#22C55E', count: 1 },
        ]})
      }
    }
  }, [gameId])

  const handleValidate = async () => {
    if (!playerCode.trim() || !gameId) {
      setError(t('Por favor ingresa tu código de jugador', 'Please enter your player code'))
      return
    }

    setIsValidating(true)
    setGameState('validating')
    setError(null)
    const validation = {}
    validationRef.current = validation

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
      if (validation !== validationRef.current) return
      
      if (data.valid && data.playerId) {
        setPlayerId(data.playerId)
        setUsername(data.username || null)
        const pic = typeof data.profilePicUrl === 'string' ? data.profilePicUrl.trim() : ''
        setProfilePicUrl(pic || null)
        setError(null)
        hasSpunRef.current = false
        setGameState('ready')
      } else {
        throw new Error(data.message || t('Código inválido', 'Invalid code'))
      }
    } catch (err: any) {
      if (validation !== validationRef.current) return
      setError(err.message || t('Error al validar el código', 'Error validating the code'))
      setGameState('idle')
    } finally {
      if (validation === validationRef.current) setIsValidating(false)
    }
  }

  const handleSpin = () => {
    if (gameState !== 'ready' || !sceneReady || hasSpunRef.current || pendingSpinRef.current) return
    if (segments.length === 0) {
      setError(t('La ruleta no tiene paneles configurados', 'The roulette has no panels configured'))
      return
    }

    // Randomly select winning segment from the already randomized segments array
    const randomIndex = Math.floor(Math.random() * segments.length)
    const selectedPanel = segments[randomIndex]
    const id = ++spinIdRef.current
    pendingSpinRef.current = { id, panel: selectedPanel, index: randomIndex }
    hasSpunRef.current = true
    setGameState('spinning')
    setSpin({ id, index: randomIndex })
  }

  const handleSpinComplete = (id: number) => {
    const pending = pendingSpinRef.current
    if (!pending || pending.id !== id) return
    pendingSpinRef.current = null
    setWinningPanel(pending.panel)
    setGameState('result')
    void submitScore(pending.panel, pending.index)
  }

  const submitScore = async (panel: Rulet4PanelConfig, index: number) => {
    if (!playerId || !gameId) {
      console.error('Missing playerId or gameId')
      return
    }

    try {
      await api.post('/v1/game/score', {
        gameId: gameId,
        playerId: playerId,
        prize: panel.label,
        index: index,
      })
    } catch (err: any) {
      console.error('Error submitting score:', err)
      // Don't show error to user, just log it
    }
  }

  const handleReset = () => {
    validationRef.current = {}
    setIsValidating(false)
    setGameState('idle')
    setPlayerCode('')
    setPlayerId(null)
    setUsername(null)
    setProfilePicUrl(null)
    setError(null)
    pendingSpinRef.current = null
    setSpin(null)
    setWinningPanel(null)
    hasSpunRef.current = false
  }

  // Build segments array from settings with random order (memoized)
  const [segments, setSegments] = useState<Rulet4PanelConfig[]>([])
  
  useEffect(() => {
    if (settings) {
      const panels = settings.panels
      const allSegments: Rulet4PanelConfig[] = []
      // If we have exactly two panel types with the same count, interleave them then append the rest
      const maxCount = Math.max(...panels.map(p => p.count), 0)
      const withMaxCount = panels.filter(p => p.count === maxCount)
      if (withMaxCount.length === 2 && maxCount >= 2) {
        const [a, b] = withMaxCount
        const rest = panels.filter(p => p !== a && p !== b)
        for (let i = 0; i < maxCount; i++) {
          allSegments.push(a)
          allSegments.push(b)
        }
        rest.forEach(panel => {
          for (let i = 0; i < panel.count; i++) allSegments.push(panel)
        })
      } else {
        panels.forEach(panel => {
          for (let i = 0; i < panel.count; i++) allSegments.push(panel)
        })
        // Shuffle the segments randomly (Fisher-Yates shuffle)
        for (let i = allSegments.length - 1; i > 0; i--) {
          const j: number = Math.floor(Math.random() * (i + 1))
          const tmp = allSegments[j]
          allSegments[j] = allSegments[i]
          allSegments[i] = tmp
        }
      }
      setSegments(allSegments)
    }
  }, [settings])

  const showJoinBlock = !(['ready', 'spinning', 'result'] as GameState[]).includes(gameState)

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null
  const hasProfilePic = profilePicUrl != null && profilePicUrl !== ''

  const profileAvatarColumn = hasProfilePic ? (
    <div className="flex w-20 shrink-0 flex-col items-center justify-center sm:w-24">
      <img
        src={profilePicUrl}
        alt={username ? t(`Foto de perfil de ${username}`, `Profile picture of ${username}`) : t('Foto de perfil', 'Profile picture')}
        className="h-20 w-20 rounded-full border-2 border-[rgba(250,204,21,0.4)] object-cover shadow-md sm:h-24 sm:w-24"
      />
    </div>
  ) : null

  /** Fila superior: avatar + contenido (idle/validating cuando ya hay foto, p. ej. flujos futuros). */
  const wrapTopWithProfilePic = (align: 'start' | 'center', children: React.ReactNode) => {
    if (!hasProfilePic) return <>{children}</>
    const rowAlign = align === 'start' ? 'items-start' : 'items-center'
    return (
      <div className={`flex flex-row gap-5 sm:gap-6 ${rowAlign}`}>
        {profileAvatarColumn}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  }

  const renderWelcomeBanner = (layout: 'landscape' | 'portrait', spinning: boolean) => {
    const outerPad =
      layout === 'landscape'
        ? 'p-8'
        : showJoinBlock
          ? 'p-8'
          : 'p-6 flex-1 flex flex-col justify-center'
    const titleClass =
      layout === 'landscape'
        ? 'text-3xl font-bold text-[#FACC15] mb-2'
        : showJoinBlock
          ? 'text-3xl font-bold text-[#FACC15] mb-2'
          : 'text-4xl font-bold text-[#FACC15] mb-2'
    const subBase =
      layout === 'landscape'
        ? 'text-xl text-gray-300'
        : showJoinBlock
          ? 'text-xl text-gray-300'
          : 'text-2xl text-gray-300'
    const subClass = `${subBase}${spinning ? ' animate-pulse' : ''}`

    const innerMsg = (
      <div className={hasProfilePic ? 'min-w-0 flex-1 text-left' : 'text-center'}>
        <div className={titleClass}>{username ? `${t('¡Bienvenido', 'Welcome')}, ${username}!` : t('¡Bienvenido!', 'Welcome!')}</div>
        <div className={subClass}>
          {spinning ? t('Girando...', 'Spinning...') : t('Estás listo para girar la ruleta', 'You are ready to spin the wheel')}
        </div>
      </div>
    )

    return (
      <div
        role="status"
        className={`${outerPad} rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)]`}
      >
        {hasProfilePic ? (
          <div className="flex flex-row items-center gap-5 sm:gap-6">
            {profileAvatarColumn}
            {innerMsg}
          </div>
        ) : (
          innerMsg
        )}
      </div>
    )
  }

  const renderResultBanner = (layout: 'landscape' | 'portrait') => {
    if (!winningPanel) return null
    const outerPad =
      layout === 'landscape'
        ? 'p-8'
        : showJoinBlock
          ? 'p-8'
          : 'p-8 flex-1 flex flex-col justify-center'
    const titleClass =
      layout === 'landscape'
        ? 'text-3xl font-bold text-[#FACC15] mb-2'
        : showJoinBlock
          ? 'text-3xl font-bold text-[#FACC15] mb-2'
          : 'text-4xl font-bold text-[#FACC15] mb-2'
    const prizeClass =
      layout === 'landscape'
        ? 'text-4xl font-bold text-white'
        : showJoinBlock
          ? 'text-4xl font-bold text-white'
          : 'text-5xl font-bold text-white'

    const inner = (
      <div className={hasProfilePic ? 'min-w-0 flex-1 text-left' : 'text-center'}>
        <div className={titleClass}>{username ? `${username}, ` : ''}{t('¡Has ganado!', 'You won!')}</div>
        <div className={prizeClass}>{winningPanel.label}</div>
      </div>
    )

    return (
      <div
        role="status"
        className={`${outerPad} rounded-xl bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.3)]`}
      >
        {hasProfilePic ? (
          <div className="flex flex-row items-center gap-5 sm:gap-6">
            {profileAvatarColumn}
            {inner}
          </div>
        ) : (
          inner
        )}
      </div>
    )
  }

  if (isLandscape) {
    return (
      <div className={GAME_LANDSCAPE_THREE_COL_GRID}>
        <GameLandscapeLeftColumn gameId={gameId} logoElement={logoElement} playersElement={playersElement}>
          <LandscapeInfoInstruction>
            {t('Escanea el QR y pulsa JUGAR.', 'Scan the QR code and tap PLAY.')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('Recibe tu código al registrarte en el formulario web.', 'Get your code when you register on the web form.')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('Ingresa y valida tu código.', 'Enter and validate your code.')}
          </LandscapeInfoInstruction>
          <LandscapeInfoInstruction>
            {t('Tienes una tirada de la ruleta.', 'You get one spin of the wheel.')}
          </LandscapeInfoInstruction>
        </GameLandscapeLeftColumn>
        <div className={GAME_LANDSCAPE_CENTER_CARD}>
          {/* Validation + messages + wheel - same as portrait flow */}
          <div className="space-y-4 min-h-[140px]">
            {gameState === 'idle' &&
              wrapTopWithProfilePic(
                'start',
                <>
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <input
                        id="player-code-landscape"
                        aria-label={t(CODE_INPUT_PLACEHOLDER, 'Enter code')}
                        type="number"
                        inputMode="numeric"
                        min={1000}
                        max={9999}
                        value={playerCode}
                        onChange={(e) => setPlayerCode(String(e.target.value))}
                        placeholder={t(CODE_INPUT_PLACEHOLDER, 'Enter code')}
                        className="flex-1 min-w-0 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20"
                        onKeyPress={(e) => { if (e.key === 'Enter') handleValidate() }}
                      />
                      <button
                        type="button"
                        onClick={handleValidate}
                        disabled={!playerCode.trim() || isValidating}
                        className="inline-flex items-center justify-center gap-2 px-8 h-14 shrink-0 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
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
                  </div>
                  {error && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{localizeOperatorMessage(error, t)}</div>}
                </>
              )}
            {gameState === 'validating' &&
              wrapTopWithProfilePic(
                'center',
                <div className="flex items-center justify-center py-10">
                  <div className="flex items-center justify-center gap-4">
                    <svg className="w-8 h-8 animate-spin text-[#FACC15]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <p className="text-2xl font-semibold text-[#FACC15]">{t('Validando código...', 'Validating code...')}</p>
                  </div>
                </div>
              )}
            {gameState === 'ready' && renderWelcomeBanner('landscape', false)}
            {gameState === 'spinning' && renderWelcomeBanner('landscape', true)}
            {gameState === 'result' && renderResultBanner('landscape')}
          </div>
          {segments.length > 0 && (
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className="relative w-[min(520px,85vw)] h-[min(520px,85vw)] max-w-[520px] max-h-[520px]">
                  <Rulet4Wheel segments={segments} spin={spin} completed={gameState === 'result'} dimmed={showJoinBlock} onReadyChange={setSceneReady} onComplete={handleSpinComplete} />
                </div>
              </div>
              <div className="text-center flex justify-center items-center min-h-[76px]">
                {gameState === 'result' ? (
                  <BackButton onClick={handleReset} aria-label={t('Volver a introducir código', 'Back to enter code')} className="scale-125" />
                ) : (
                  <button type="button" onClick={handleSpin} disabled={gameState !== 'ready' || !sceneReady || hasSpunRef.current} className="px-10 py-5 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-2xl">{t('GIRAR RULETA', 'SPIN THE WHEEL')}</button>
                )}
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
    <div className="w-full h-full min-h-0 flex flex-col overflow-hidden">
      {!showJoinBlock && gameState !== 'result' && (
        <div className="flex justify-end mb-2 flex-shrink-0">
          <BackButton onClick={handleReset} aria-label={t('Volver', 'Back')} />
        </div>
      )}
      <div className="flex flex-col flex-1 min-h-0 space-y-4 overflow-hidden">
        {gameState === 'idle' &&
          wrapTopWithProfilePic(
            'start',
            <>
              <div className="space-y-2">
                <div className="flex gap-3">
                  <input
                    id="player-code"
                    aria-label={t(CODE_INPUT_PLACEHOLDER, 'Enter code')}
                    type="number"
                    inputMode="numeric"
                    min={1000}
                    max={9999}
                    value={playerCode}
                    onChange={(e) => setPlayerCode(String(e.target.value))}
                    placeholder={t(CODE_INPUT_PLACEHOLDER, 'Enter code')}
                    className="flex-1 min-w-0 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleValidate()
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={!playerCode.trim() || isValidating}
                    className="inline-flex items-center justify-center gap-2 px-8 h-14 shrink-0 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
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
              </div>

              {error && (
                <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">
                  {error && localizeOperatorMessage(error, t)}
                </div>
              )}
            </>
          )}

        {/* Validating State */}
        {gameState === 'validating' &&
          wrapTopWithProfilePic(
            'center',
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center justify-center gap-4">
                <svg className="w-8 h-8 animate-spin text-[#FACC15]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p className="text-2xl font-semibold text-[#FACC15]">{t('Validando código...', 'Validating code...')}</p>
              </div>
            </div>
          )}

        {/* Welcome Message - After validation */}
        {gameState === 'ready' && renderWelcomeBanner('portrait', false)}

        {/* Spinning State - Show in welcome message box */}
        {gameState === 'spinning' && renderWelcomeBanner('portrait', true)}

        {/* Prize Display - After spin result */}
        {gameState === 'result' && renderResultBanner('portrait')}
      </div>

      {/* Roulette Wheel - Always visible */}
      {segments.length > 0 && (
        <div className={showJoinBlock ? 'space-y-6' : 'flex-1 flex flex-col min-h-0 space-y-6'}>
          {/* Roulette Container */}
          <div className="flex flex-col items-center flex-1 min-h-0 justify-center">
            {/* Wheel - larger when expanded (portrait) */}
            <div className={`relative ${showJoinBlock ? 'w-[min(520px,85vw)] h-[min(520px,85vw)] max-w-[520px] max-h-[520px]' : 'w-[min(600px,90vw)] h-[min(600px,90vw)] max-w-[600px] max-h-[600px]'}`}>
              <Rulet4Wheel segments={segments} spin={spin} completed={gameState === 'result'} dimmed={showJoinBlock} onReadyChange={setSceneReady} onComplete={handleSpinComplete} />
            </div>
          </div>

          {/* Spin / volver: mismo hueco bajo la ruleta */}
          <div className="text-center flex justify-center items-center min-h-[76px]">
            {gameState === 'result' ? (
              <BackButton onClick={handleReset} aria-label={t('Volver a introducir código', 'Back to enter code')} className="scale-125" />
            ) : (
              <button
                type="button"
                onClick={handleSpin}
                disabled={gameState !== 'ready' || !sceneReady || hasSpunRef.current}
                className="px-10 py-5 rounded-xl bg-[rgba(250,204,21,0.2)] border border-[rgba(250,204,21,0.3)] hover:bg-[rgba(250,204,21,0.3)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-2xl"
              >
                {t('GIRAR RULETA', 'SPIN THE WHEEL')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
