import { useState, useEffect, useRef } from 'react'
import type { GameScreenProps } from '../../core/types'
import QRCode from '../../core/QRCode'

const INSTAGRAM_HANDLE = 'stand_official'
const INSTAGRAM_DM_URL = `https://ig.me/m/${INSTAGRAM_HANDLE}`
const API_BASE = "https://3u0n7y51m9.execute-api.us-east-1.amazonaws.com/prod"

type GameState = 'idle' | 'validated' | 'preparing' | 'playing' | 'hidden' | 'finished'

export default function T1merGameScreen({ gameName, gameId }: GameScreenProps) {
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
      const response = await fetch(`${API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameId,
          codes: [playerCode.toUpperCase()]
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        // If response is not ok, try to get error message from response
        throw new Error(data.message || data.error || 'Error al validar el código')
      }
      
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

      const response = await fetch(`${API_BASE}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameId,
          playerId: playerId, // string or number
          timer: time.toFixed(3), // seconds as string
          score: scoreMs // integer (difference in ms from target time)
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al enviar la puntuación')
      }
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

  // Auto-reset after showing result for 3 seconds
  useEffect(() => {
    if (gameState === 'finished') {
      const timeout = setTimeout(() => {
        handleReset()
      }, 3000)
      return () => clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState])

  return (
    <div className="w-full space-y-6">
      {/* Game Code - Always visible */}
      <div className="text-center">
        <div className="p-4 rounded-xl bg-[rgba(240,34,48,0.15)] border border-[rgba(240,34,48,0.3)]">
          <p className="text-sm text-gray-300 mb-2">Código de partida {gameName}:</p>
          <p className="text-3xl font-bold tracking-wider text-red-500">{gameId}</p>
        </div>
      </div>

      {/* QR Code and Instructions - Two columns, always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* QR Code - Left column */}
        <div className="flex justify-center items-start">
          <QRCode 
            data={INSTAGRAM_DM_URL}
            size={200}
            margin={8}
            alt="QR Code para Instagram DM"
          />
        </div>

        {/* Instructions - Right column */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-textMain mb-3">Instrucciones</h3>
          <ol className="space-y-3 text-sm text-gray-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-xs">1</span>
              <span className="pt-0.5">Escanea el QR para obtener tu código de jugador.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-xs">2</span>
              <span className="pt-0.5">Ingresa tu código y valida.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-xs">3</span>
              <span className="pt-0.5">El temporizador se ocultará a los 5 segundos.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[rgba(240,34,48,0.2)] border border-[rgba(240,34,48,0.4)] flex items-center justify-center font-semibold text-red-500 text-xs">4</span>
              <span className="pt-0.5">Intenta detenerlo exactamente en 10 segundos.</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Player Code Input - Only show when idle */}
      {gameState === 'idle' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label htmlFor="player-code" className="text-sm text-gray-300">Tu código de jugador</label>
            <div className="flex gap-2">
              <input
                id="player-code"
                type="text"
                value={playerCode}
                onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                placeholder="Ingresa tu código"
                className="flex-1 h-11 rounded-xl bg-[rgba(255,255,255,0.05)] border border-white/10 px-3 outline-none focus:border-white/20 uppercase"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleValidate()
                  }
                }}
              />
              <button
                onClick={handleValidate}
                disabled={!playerCode.trim() || isValidating}
                className="px-6 h-11 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isValidating ? 'Validando...' : 'Validar'}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>
      )}


      {/* Preparing Animation */}
      {gameState === 'preparing' && (
        <div className="text-center py-8">
          <p className="text-3xl font-bold text-red-500 animate-pulse">
            {preparingText}
          </p>
        </div>
      )}

      {/* Timer Display - Playing or Hidden */}
      {(gameState === 'playing' || gameState === 'hidden') && (
        <div className="space-y-6">
          <div className="text-center py-8">
            {gameState === 'playing' ? (
              <div className="text-6xl font-bold text-red-500 font-mono">
                {formatTimer(timer)}
              </div>
            ) : (
              <div className="text-6xl font-bold text-gray-600 font-mono">
                ???
              </div>
            )}
          </div>

          <button
            onClick={handleStop}
            className="w-full p-6 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition-colors"
          >
            <span className="text-2xl font-bold">DETENER</span>
          </button>
        </div>
      )}

      {/* Result Display - After stopping */}
      {gameState === 'finished' && result && (
        <div className="space-y-4">
          <div className="text-center py-6 space-y-4">
            <div className="text-5xl font-bold text-red-500 font-mono">
              {formatTimer(result.time)}
            </div>
            <div className="text-xl text-gray-300">
              Diferencia: {result.difference.toFixed(3)}s
            </div>
            <div className={`text-2xl font-semibold ${
              result.difference < 0.1 ? 'text-green-400' :
              result.difference < 0.5 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
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
  )
}
