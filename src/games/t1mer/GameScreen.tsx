import { useState, useEffect, useRef } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/QRCode'
import BackButton from '../../core/BackButton'
import { api } from '../../api/api'

const INSTAGRAM_HANDLE = 'stand_official'
const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`

type GameState = 'idle' | 'validated' | 'preparing' | 'playing' | 'hidden' | 'finished'

export default function T1merGameScreen({ gameName, gameId, orientation, logoElement, sidebarElement }: GameScreenProps) {
  const [gameState, setGameState] = useState<GameState>('idle')
  const [timer, setTimer] = useState(0)
  const [playerCode, setPlayerCode] = useState('')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ time: number; difference: number } | null>(null)
  const [preparingText, setPreparingText] = useState('Preparado')
  const intervalRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const preparingTimeoutRef = useRef<number | null>(null)

  // Preparing animation logic
  useEffect(() => {
    if (gameState === 'preparing') {
      const baseText = username ? `${username} Preparado` : 'Preparado'
      let dots = 0
      const interval = setInterval(() => {
        dots = (dots + 1) % 4
        setPreparingText(baseText + '.'.repeat(dots))
      }, 500)

      preparingTimeoutRef.current = window.setTimeout(() => {
        clearInterval(interval)
        startTimeRef.current = Date.now()
        setGameState('playing')
      }, 2000) // 2 seconds of preparation

      return () => {
        clearInterval(interval)
        if (preparingTimeoutRef.current) {
          clearTimeout(preparingTimeoutRef.current)
        }
      }
    }
  }, [gameState, username])

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
        codes: [playerCode.toUpperCase()]
      })
      
      if (data.valid && data.playerId) {
        setPlayerId(data.playerId)
        setUsername(data.username || null)
        setError(null)
        // Go directly to preparing animation
        setGameState('preparing')
        setPreparingText(data.username ? `${data.username} Preparado` : 'Preparado')
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

  const submitScore = async (time: number, difference: number) => {
    if (!playerId || !gameId) {
      console.error('Missing playerId or gameId')
      return
    }

    try {
      const scoreMs = Math.round(difference * 1000) // Convert to integer milliseconds

      await api.post('/v1/game/score', {
        gameId: gameId,
        playerId: playerId, // string or number
        timer: time.toFixed(3), // seconds as string
        score: scoreMs // integer (difference in ms from target time)
      })
    } catch (err: any) {
      console.error('Error submitting score:', err)
      setError(err.message || 'Error al enviar la puntuación')
    }
  }

  const handleReset = () => {
    // Reset everything for next player
    setGameState('idle')
    setTimer(0)
    setResult(null)
    setError(null)
    setPlayerCode('')
    setPlayerId(null)
    setUsername(null)
  }

  const isLandscape = orientation === 'landscape' && logoElement != null && sidebarElement != null

  if (isLandscape) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)_200px] gap-4 sm:gap-6 items-stretch h-full min-h-0">
        <div className="card flex flex-col gap-2 p-4 sm:p-5 overflow-hidden min-h-0">
          {logoElement}
          <div className="text-center">
            <div className="p-3 rounded-xl bg-[rgba(240,34,48,0.15)] border border-[rgba(240,34,48,0.3)]">
              <p className="text-xs text-gray-300 mb-1">Código de partida {gameName}:</p>
              <p className="text-xl font-bold tracking-wider text-red-500">{gameId}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 min-h-0 flex-1">
            <div className="flex justify-center flex-shrink-0">
              <QRCode data={INSTAGRAM_DM_URL} size={260} margin={8} alt="QR Code para Instagram DM" />
            </div>
            <div className="space-y-1.5 min-h-0">
              <h3 className="text-sm font-semibold text-textMain mb-1">Instrucciones</h3>
              <ol className="space-y-1.5 text-xs text-gray-300">
                <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">1</span><span className="pt-0.5">Escanea el QR para obtener tu código de jugador.</span></li>
                <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">2</span><span className="pt-0.5">Ingresa tu código y valida.</span></li>
                <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">3</span><span className="pt-0.5">El temporizador se ocultará a los 5 segundos.</span></li>
                <li className="flex gap-2"><span className="flex-shrink-0 w-5 h-5 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-[10px]">4</span><span className="pt-0.5">Intenta detenerlo exactamente en 10 segundos.</span></li>
              </ol>
            </div>
          </div>
        </div>
        <div className="card flex flex-col p-6 sm:p-8 overflow-hidden min-h-0 space-y-6">
          {gameState === 'idle' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="player-code-landscape" className="text-sm text-gray-300">Tu código de jugador</label>
                <div className="flex gap-3">
                  <input id="player-code-landscape" type="text" value={playerCode} onChange={(e) => setPlayerCode(e.target.value.toUpperCase())} placeholder="Ingresa tu código" className="flex-1 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20 uppercase" onKeyPress={(e) => { if (e.key === 'Enter') handleValidate() }} />
                  <button onClick={handleValidate} disabled={!playerCode.trim() || isValidating} className="px-8 h-14 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg">{isValidating ? 'Validando...' : 'Validar'}</button>
                </div>
              </div>
              {error && <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>}
            </div>
          )}
          {gameState === 'idle' && isValidating && (
            <div className="flex items-center justify-center gap-4 py-6">
              <svg className="w-8 h-8 animate-spin text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <p className="text-2xl font-semibold text-red-500">Validando código...</p>
            </div>
          )}
          {gameState === 'preparing' && <div className="text-center py-6"><p className="text-4xl font-bold text-red-500 animate-pulse">{preparingText}</p></div>}
          <div className="space-y-6">
            <div className="text-center py-10 min-h-[160px] flex items-center justify-center">
              {gameState === 'idle' && <div className="text-7xl lg:text-8xl font-bold text-gray-600 font-mono opacity-50">00:00.0</div>}
              {gameState === 'preparing' && <div className="text-7xl lg:text-8xl font-bold text-gray-600 font-mono opacity-50">00:00.0</div>}
              {gameState === 'playing' && <div className="text-7xl lg:text-8xl font-bold text-red-500 font-mono">{formatTimer(timer)}</div>}
              {gameState === 'hidden' && <div className="text-7xl lg:text-8xl font-bold text-gray-600 font-mono">???</div>}
              {gameState === 'finished' && result && <div className="text-7xl lg:text-8xl font-bold text-red-500 font-mono">{formatTimer(result.time)}</div>}
              {!['idle','preparing','playing','hidden','finished'].includes(gameState) && <div className="text-7xl lg:text-8xl font-bold text-gray-600 font-mono opacity-50">00:00.0</div>}
            </div>
            <button onClick={handleStop} disabled={gameState !== 'playing' && gameState !== 'hidden'} className="w-full p-8 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><span className="text-3xl font-bold">DETENER</span></button>
            {gameState === 'idle' && <p className="text-sm text-gray-400 text-center">Valida tu código para activar el temporizador</p>}
          </div>
          {gameState === 'finished' && result && (
            <div className="text-center space-y-4">
              <div className="text-2xl text-gray-300">Diferencia: {result.difference.toFixed(3)}s</div>
              <div className={`text-3xl font-semibold ${result.difference < 0.1 ? 'text-green-400' : result.difference < 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                {result.difference < 0.1 ? '¡Excelente!' : result.difference < 0.5 ? '¡Bien!' : 'Sigue intentando'}
              </div>
            </div>
          )}
        </div>
        <div className="card flex flex-col gap-3 p-4 min-w-0 min-h-0 overflow-hidden items-start">{sidebarElement}</div>
      </div>
    )
  }

  return (
    <div className={`w-full flex flex-col ${!showJoinBlock ? 'min-h-[70vh]' : ''}`}>
      {!showJoinBlock && (
        <div className="flex justify-end mb-2">
          <BackButton onClick={handleReset} aria-label="Volver" />
        </div>
      )}
      <div className={showJoinBlock ? 'space-y-6' : 'flex flex-col flex-1 min-h-0 space-y-4'}>
      {/* Game Code - Always visible */}
      <div className="text-center flex-shrink-0">
        <div className="p-5 rounded-xl bg-[rgba(240,34,48,0.15)] border border-[rgba(240,34,48,0.3)]">
          <p className="text-base text-gray-300 mb-2">Código de partida {gameName}:</p>
          <p className="text-4xl lg:text-5xl font-bold tracking-wider text-red-500">{gameId}</p>
        </div>
      </div>

      {/* QR Code and Instructions - Always visible (portrait) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* QR Code - Left column */}
          <div className="flex justify-center items-start">
            <QRCode 
              data={INSTAGRAM_DM_URL}
              size={380}
              margin={12}
              alt="QR Code para Instagram DM"
            />
          </div>

          {/* Instructions - Right column */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-textMain mb-3">Instrucciones</h3>
            <ol className="space-y-4 text-base text-gray-300">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-sm">1</span>
                <span className="pt-0.5">Escanea el QR para obtener tu código de jugador.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-sm">2</span>
                <span className="pt-0.5">Ingresa tu código y valida.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-sm">3</span>
                <span className="pt-0.5">El temporizador se ocultará a los 5 segundos.</span>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-sm">4</span>
                <span className="pt-0.5">Intenta detenerlo exactamente en 10 segundos.</span>
              </li>
            </ol>
          </div>
        </div>

      {/* Player Code Input - Only show when idle */}
      {gameState === 'idle' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="player-code" className="text-base text-gray-300">Tu código de jugador</label>
            <div className="flex gap-3">
              <input
                id="player-code"
                type="text"
                value={playerCode}
                onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                placeholder="Ingresa tu código"
                className="flex-1 h-14 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-4 text-lg outline-none focus:border-white/20 uppercase"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleValidate()
                  }
                }}
              />
              <button
                onClick={handleValidate}
                disabled={!playerCode.trim() || isValidating}
                className="px-8 h-14 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
              >
                {isValidating ? 'Validando...' : 'Validar'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-base">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Validating State */}
      {gameState === 'idle' && isValidating && (
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-4">
            <svg className="w-8 h-8 animate-spin text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-2xl font-semibold text-red-500">Validando código...</p>
          </div>
        </div>
      )}

      {/* Preparing Animation */}
      {gameState === 'preparing' && (
        <div className={`text-center ${showJoinBlock ? 'py-6' : 'flex-1 flex flex-col justify-center min-h-0 py-6'}`}>
          <p className={showJoinBlock ? 'text-4xl font-bold text-red-500 animate-pulse' : 'text-5xl lg:text-6xl font-bold text-red-500 animate-pulse'}>
            {preparingText}
          </p>
        </div>
      )}

      {/* Timer Display - Always visible */}
      <div className={showJoinBlock ? 'space-y-6' : 'flex-1 flex flex-col min-h-0 justify-center space-y-6'}>
        <div className={`text-center flex items-center justify-center ${showJoinBlock ? 'py-10 min-h-[160px]' : 'py-6 min-h-0 flex-1'}`}>
          {gameState === 'idle' ? (
            // Disabled state - show initial timer with reduced opacity
            <div className={`font-bold text-gray-600 font-mono opacity-50 ${showJoinBlock ? 'text-7xl lg:text-8xl' : 'text-8xl lg:text-9xl'}`}>
              00:00.0
            </div>
          ) : gameState === 'preparing' ? (
            // Preparing state - show initial timer
            <div className={`font-bold text-gray-600 font-mono opacity-50 ${showJoinBlock ? 'text-7xl lg:text-8xl' : 'text-8xl lg:text-9xl'}`}>
              00:00.0
            </div>
          ) : gameState === 'playing' ? (
            // Playing state - show active timer
            <div className={`font-bold text-red-500 font-mono ${showJoinBlock ? 'text-7xl lg:text-8xl' : 'text-8xl lg:text-9xl'}`}>
              {formatTimer(timer)}
            </div>
          ) : gameState === 'hidden' ? (
            // Hidden state - show ???
            <div className={`font-bold text-gray-600 font-mono ${showJoinBlock ? 'text-7xl lg:text-8xl' : 'text-8xl lg:text-9xl'}`}>
              ???
            </div>
          ) : gameState === 'finished' && result ? (
            // Finished state - show result
            <div className={`font-bold text-red-500 font-mono ${showJoinBlock ? 'text-7xl lg:text-8xl' : 'text-8xl lg:text-9xl'}`}>
              {formatTimer(result.time)}
            </div>
          ) : (
            // Fallback
            <div className={`font-bold text-gray-600 font-mono opacity-50 ${showJoinBlock ? 'text-7xl lg:text-8xl' : 'text-8xl lg:text-9xl'}`}>
              00:00.0
            </div>
          )}
        </div>

        {/* Stop Button - Always visible, disabled until validated */}
        <button
          onClick={handleStop}
          disabled={gameState !== 'playing' && gameState !== 'hidden'}
          className={`w-full rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${showJoinBlock ? 'p-8' : 'p-10'}`}
        >
          <span className={showJoinBlock ? 'text-3xl font-bold' : 'text-4xl font-bold'}>DETENER</span>
        </button>
        {gameState === 'idle' && (
          <p className="text-base text-gray-400 text-center">Valida tu código para activar el temporizador</p>
        )}
      </div>

      {/* Result Display - After stopping */}
      {gameState === 'finished' && result && (
        <div className={`space-y-4 ${!showJoinBlock ? 'flex-shrink-0' : ''}`}>
          <div className="text-center space-y-4">
            <div className={showJoinBlock ? 'text-2xl text-gray-300' : 'text-3xl text-gray-300'}>
              Diferencia: {result.difference.toFixed(3)}s
            </div>
            <div className={`font-semibold ${
              result.difference < 0.1 ? 'text-green-400' :
              result.difference < 0.5 ? 'text-yellow-400' :
              'text-red-400'
            } ${showJoinBlock ? 'text-3xl' : 'text-4xl'}`}>
              {result.difference < 0.1 ? '¡Excelente!' :
               result.difference < 0.5 ? '¡Bien!' :
               'Sigue intentando'}
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
