import { useState, useEffect, useRef, useMemo } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/widgets/QRCode'
import BackButton from '../../core/widgets/BackButton'
import { getInstagramDmUrl } from '../../core/lib/instagram'
import { api } from '../../api/api'
import { useGameInput } from '../../core/input/useGameInput'
import type { InputEventEnvelope } from '../../core/input/types'
import { isWebOSBrowser, shouldHijackOkPointerToPrimary, webosOkHijackEnabled } from './webosOkHijack'

type GameState = 'idle' | 'validated' | 'preparing' | 'playing' | 'hidden' | 'finished'

export default function T1merGameScreen({ gameId, orientation, logoElement, sidebarElement, topX, prizeLabel, onCounterActiveChange }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [timer, setTimer] = useState(0)
  const [playerCode, setPlayerCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
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
      setError('Por favor ingresa tu código de jugador')
      return
    }

    setIsValidating(true)
    setError(null)

    try {
      const data = await api.post<{ valid: boolean; playerId?: string; username?: string; message?: string; error?: string }>('/v1/game/validate', {
        gameId: gameId,
        codes: [String(playerCode).trim()]
      })
      
      if (data.valid && data.playerId) {
        setPlayerId(data.playerId)
        setUsername(data.username || null)
        setError(null)
        setGameState('preparing')
      } else {
        // If valid is false, show the message from response
        throw new Error(data.message || 'Código inválido')
      }
    } catch (err: any) {
      setError(err.message || 'Error al validar el código')
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
      setError(err.message || 'Error al enviar la puntuación')
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

  /** Solo acción `click` del inputManager: empezar / detener / volver a validación; no duplicar botones enlaces o campos. */
  const inputHandlers = useMemo(
    () => ({
      click: (ev: InputEventEnvelope) => {
        const t = ev.nativeEvent.target
        if (t instanceof Element && t.closest('button, a[href], [role="button"], input, textarea, select')) {
          return
        }
        const st = gameStateRef.current
        if (st === 'idle') {
          void handleValidateRef.current()
          return
        }
        if (st === 'preparing') {
          handleStartRef.current()
        } else if (st === 'playing' || st === 'hidden') {
          handleStopRef.current()
        } else if (st === 'finished') {
          handleResetFnRef.current()
        }
      },
    }),
    []
  )

  useGameInput(`t1mer:${gameId}`, inputHandlers)

  // webOS: OK en modo puntero → pointerdown:mouse donde está el cursor (no se puede mover por JS).
  // Si el clic no cae en otro botón/enlace/input, ejecutamos la acción del CTA del estado actual.
  useEffect(() => {
    if (!isWebOSBrowser() || !webosOkHijackEnabled()) return

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return

      let primary: HTMLElement | null = null
      let onActivate: (() => void) | null = null

      switch (gameState) {
        case 'preparing':
          primary = startButtonRef.current
          onActivate = () => handleStartRef.current()
          break
        case 'playing':
        case 'hidden':
          primary = stopButtonRef.current
          onActivate = () => handleStopRef.current()
          break
        case 'finished':
          primary = resetBackRef.current
          onActivate = () => handleResetFnRef.current()
          break
        case 'idle': {
          const v = validateButtonRef.current
          if (v && !v.disabled) {
            primary = v
            onActivate = () => void handleValidateRef.current()
          }
          break
        }
        default:
          return
      }

      if (!primary || !onActivate) return
      if (!shouldHijackOkPointerToPrimary(e.target, primary)) return

      e.preventDefault()
      e.stopImmediatePropagation()
      onActivate()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [gameState])

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null

  if (isLandscape) {
    return (
      <div className="grid grid-cols-[25%_40%_25%] gap-4 items-stretch h-full min-h-0">
        <div className="card flex flex-col gap-2 p-4 sm:p-5 overflow-hidden min-h-0 min-w-0">
          <div className="flex-shrink-0 flex justify-center items-center w-full min-h-0 min-w-0">
            {logoElement}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center">
            <div className="flex-shrink-0 w-full min-w-0">
              <h3 className="text-xs font-semibold text-textMain mb-1">Instrucciones</h3>
              <ol className="flex flex-col gap-1.5 text-xs text-gray-300">
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">1</span><span className="pt-0.5">📸 Escanea el QR y pulsa JUGAR.</span></li>
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">2</span><span className="pt-0.5">✅ Ingresa tu código y valida.</span></li>
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">3</span><span className="pt-0.5">⏱️ El temporizador se oculta a los 5 s.</span></li>
                <li className="flex gap-2 items-start"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">4</span><span className="pt-0.5">🎯 Detén en 10 segundos.</span></li>
              </ol>
            </div>
          </div>
          <div className="flex-shrink-0 grid grid-cols-2 w-full min-h-0 gap-2 pt-1 pb-2 items-center">
            <div aria-hidden className="min-h-0 min-w-0" />
            <div className="flex justify-center items-center min-h-0 min-w-0">
              <QRCode
                data={getInstagramDmUrl(gameId)}
                size={320}
                margin={6}
                containerClassName="h-[clamp(92px,16vh,156px)] w-[clamp(92px,11vw,156px)]"
                alt="QR Code para Instagram DM"
                className="!border-0 !bg-transparent !p-0"
              />
            </div>
          </div>
        </div>
        <div className="card flex flex-col p-6 sm:p-8 overflow-hidden min-h-0 min-w-0 space-y-6 items-center">
          {/* Idle: temporizador + código + Validar (validación a escondidas, mismo formulario) */}
          {gameState === 'idle' && (
            <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0">
              <div className="text-center py-6">
                <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-gray-600 font-digital opacity-50">00:00.0</div>
              </div>
              <div className="max-w-md mx-auto w-full space-y-2">
                <div className="flex gap-3">
                  <input id="player-code-landscape" type="number" inputMode="numeric" min={1000} max={9999} value={playerCode} onChange={(e) => setPlayerCode(String(e.target.value))} placeholder="Ingresa tu código" className="flex-1 min-w-0 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20" />
                  <button ref={validateButtonRef} type="button" onClick={handleValidate} disabled={!playerCode.trim() || isValidating} className="px-8 h-14 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex-shrink-0">{isValidating ? 'Validando...' : 'Validar'}</button>
                </div>
              </div>
              {error && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>}
            </div>
          )}
          {/* Preparando: username + instrucción + contador + EMPEZAR */}
          {gameState === 'preparing' && (
            <>
              <div className="text-center py-4 space-y-2">
                {username && <p className="text-3xl font-bold text-red-500">{username.startsWith('@') ? username : `@${username}`}</p>}
                <p className="text-xl sm:text-2xl text-gray-300">
                  Detén el contador cuando llegue a <span className="font-digital text-red-500 text-2xl sm:text-3xl">10:00.0</span>
                </p>
              </div>
              <div className="space-y-6 min-w-0 flex-1 flex flex-col justify-center">
                <div className="text-center py-6 min-h-[120px] flex items-center justify-center">
                  <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-gray-600 font-digital opacity-50">00:00.0</div>
                </div>
                <div className="w-full min-w-0">
                  <button
                    ref={startButtonRef}
                    type="button"
                    onClick={handleStart}
                    className="w-full p-8 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                  >
                    <span className="text-2xl sm:text-3xl font-bold">EMPEZAR</span>
                  </button>
                </div>
              </div>
            </>
          )}
          {/* Jugando / oculto / terminado: temporizador + DETENER (o resultado) */}
          {(gameState === 'playing' || gameState === 'hidden' || gameState === 'finished') && (
            <div className="space-y-6 min-w-0 flex-1 flex flex-col justify-center">
              <div className="text-center py-10 min-h-[160px] flex items-center justify-center">
                {gameState === 'playing' && <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-red-500 font-digital">{formatTimer(timer)}</div>}
                {gameState === 'hidden' && <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-gray-600 font-digital">???</div>}
                {gameState === 'finished' && result && <div className="text-6xl sm:text-7xl lg:text-8xl font-normal text-red-500 font-digital">{formatTimer(result.time)}</div>}
              </div>
              {gameState !== 'finished' && (
                <div className="w-full min-w-0">
                  <button
                    ref={stopButtonRef}
                    type="button"
                    onClick={handleStop}
                    className="w-full p-8 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                  >
                    <span className="text-2xl sm:text-3xl font-bold">DETENER</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {gameState === 'finished' && result && (
            <div className="text-center space-y-4">
              {resultRank != null && <div className="text-2xl font-semibold text-textMain">Posición: {resultRank}</div>}
              {topX != null && resultRank != null && resultRank <= topX && (
                <div className="text-xl font-semibold text-green-400">
                  ¡Premio por entrar en el top {topX}!{prizeLabel ? ` ${prizeLabel}` : ''}
                </div>
              )}
              <div className="flex justify-center">
                <BackButton ref={resetBackRef} onClick={handleReset} aria-label="Volver a validar" />
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
      {!showJoinBlock && (
        <div className="flex-shrink-0 flex justify-end mb-2">
          <BackButton onClick={handleReset} aria-label="Volver" />
        </div>
      )}
      <div className={`flex flex-col overflow-hidden min-h-0 flex-1 ${orientation === 'portrait' ? 'justify-center gap-8' : 'gap-3'}`}>
      {/* QR and instructions first (no game code block) */}
      <div className="flex-shrink-0 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* QR Code - Left column */}
          <div className="flex justify-center items-start min-w-0">
            <QRCode
              data={getInstagramDmUrl(gameId)}
              size={orientation === 'portrait' ? 180 : 380}
              margin={orientation === 'portrait' ? 6 : 12}
              alt="QR Code para Instagram DM"
              className="!border-0 !bg-transparent"
            />
          </div>

          {/* Instructions - Right column */}
          <div className="space-y-1.5 min-w-0 overflow-hidden">
            <h3 className="text-sm font-semibold text-textMain mb-1">Instrucciones</h3>
            <ol className="space-y-1.5 text-xs text-gray-300">
              <li className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">1</span>
                <span className="pt-0.5">Escanea el QR y pulsa JUGAR en el chat de Instagram para obtener tu código de jugador.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">2</span>
                <span className="pt-0.5">Ingresa tu código y valida.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">3</span>
                <span className="pt-0.5">El temporizador se ocultará a los 5 segundos.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">4</span>
                <span className="pt-0.5">Intenta detenerlo exactamente en 10 segundos.</span>
              </li>
            </ol>
          </div>
        </div>

      {/* Contenedor central: idle = timer + código + Validar (validación a escondidas); preparando = username + instrucción + EMPEZAR; jugando/oculto/terminado = timer + DETENER o resultado */}
      <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden min-w-0">
        <div className="space-y-6 flex flex-col flex-1 min-h-0 justify-center">
          {gameState === 'idle' && (
            <div className="flex-1 flex flex-col justify-center min-h-0">
              <div className="text-center py-6">
                <div className="font-normal text-gray-600 font-digital opacity-50 text-6xl sm:text-7xl lg:text-8xl">00:00.0</div>
              </div>
              <div className="flex-shrink-0 space-y-4">
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <input
                      id="player-code"
                      type="number"
                      inputMode="numeric"
                      min={1000}
                      max={9999}
                      value={playerCode}
                      onChange={(e) => setPlayerCode(String(e.target.value))}
                      placeholder="Ingresa tu código"
                      className="flex-1 min-w-0 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20"
                    />
                    <button
                      ref={validateButtonRef}
                      type="button"
                      onClick={handleValidate}
                      disabled={!playerCode.trim() || isValidating}
                      className="px-8 h-14 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex-shrink-0"
                    >
                      {isValidating ? 'Validando...' : 'Validar'}
                    </button>
                  </div>
                </div>
                {error && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">{error}</div>}
              </div>
            </div>
          )}
          {gameState === 'preparing' && (
            <>
              <div className="flex-shrink-0 text-center py-6 space-y-2">
                {username && <p className="text-4xl lg:text-5xl font-bold text-red-500">{username.startsWith('@') ? username : `@${username}`}</p>}
                <p className="text-lg sm:text-xl lg:text-2xl text-gray-300">
                  Detén el contador cuando llegue a <span className="font-digital text-red-500 text-2xl sm:text-3xl lg:text-4xl">10:00.0</span>
                </p>
              </div>
              <div className="text-center flex items-center justify-center flex-1 min-h-0 py-6">
                <div className="font-normal text-gray-600 font-digital opacity-50 text-6xl sm:text-7xl lg:text-8xl">00:00.0</div>
              </div>
              <div className="w-full min-w-0 flex-shrink-0">
                <button
                  ref={startButtonRef}
                  type="button"
                  onClick={handleStart}
                  className="w-full rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors p-8"
                >
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-bold">EMPEZAR</span>
                </button>
              </div>
            </>
          )}
          {(gameState === 'playing' || gameState === 'hidden' || gameState === 'finished') && (
            <>
              <div className={`text-center flex items-center justify-center flex-1 min-h-0 ${showJoinBlock ? 'py-10 min-h-[120px]' : 'py-6'}`}>
                {gameState === 'playing' && <div className="font-normal text-red-500 font-digital text-6xl sm:text-7xl lg:text-8xl">{formatTimer(timer)}</div>}
                {gameState === 'hidden' && <div className="font-normal text-gray-600 font-digital text-6xl sm:text-7xl lg:text-8xl">???</div>}
                {gameState === 'finished' && result && <div className="font-normal text-red-500 font-digital text-6xl sm:text-7xl lg:text-8xl">{formatTimer(result.time)}</div>}
              </div>
              {gameState !== 'finished' && (
                <div className="w-full min-w-0 flex-shrink-0">
                  <button
                    ref={stopButtonRef}
                    type="button"
                    onClick={handleStop}
                    className="w-full rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors p-8"
                  >
                    <span className="text-2xl sm:text-3xl lg:text-4xl font-bold">DETENER</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Result Display - Solo posición, premio si aplica y botón volver */}
      {gameState === 'finished' && result && (
        <div className="flex-shrink-0 space-y-4">
          <div className="text-center space-y-4">
            {resultRank != null && (
              <div className={showJoinBlock ? 'text-xl font-semibold text-textMain' : 'text-2xl font-semibold text-textMain'}>
                Posición: {resultRank}
              </div>
            )}
            {topX != null && resultRank != null && resultRank <= topX && (
              <div className="text-xl sm:text-2xl font-semibold text-green-400">
                ¡Premio por entrar en el top {topX}!{prizeLabel ? ` ${prizeLabel}` : ''}
              </div>
            )}
            <div className="flex justify-center">
              <BackButton ref={resetBackRef} onClick={handleReset} aria-label="Volver a validar" />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  )
}
