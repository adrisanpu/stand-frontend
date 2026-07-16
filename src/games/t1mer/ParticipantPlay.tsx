import { useState, useEffect, useRef } from 'react'
import { publicApi } from '../../api/publicApi'
import { loadAssignment } from '../../core/participant/playerSession'

type GameState = 'preparing' | 'playing' | 'hidden' | 'finished'

type Props = {
  gameId: string
  playerToken: string
  onFinished: (result: { time: number; difference: number; rank: number | null }) => void
}

function formatTimer(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const centiseconds = Math.floor((seconds % 1) * 100)
  const milliseconds = Math.floor(((seconds % 1) * 1000) % 10)
  return `${String(totalSeconds).padStart(2, '0')}:${String(centiseconds).padStart(2, '0')}.${String(milliseconds)}`
}

export default function T1merParticipantPlay({ gameId, playerToken, onFinished }: Props) {
  const assignment = loadAssignment(gameId)
  const displayName =
    assignment && 'displayName' in assignment
      ? assignment.displayName
      : assignment && 'characterName' in assignment
        ? assignment.characterName
        : 'Jugador'

  const [gameState, setGameState] = useState<GameState>('preparing')
  const [timer, setTimer] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const startTimeRef = useRef(0)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (gameState !== 'playing') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    intervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      setTimer(elapsed)
      if (elapsed >= 5) setGameState('hidden')
    }, 10)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [gameState])

  const handleStart = () => {
    startTimeRef.current = Date.now()
    setTimer(0)
    setGameState('playing')
  }

  const handleStop = async () => {
    if (gameState !== 'playing' && gameState !== 'hidden') return
    const finalTime = (Date.now() - startTimeRef.current) / 1000
    const difference = Math.abs(finalTime - 10.0)
    setGameState('finished')
    setSubmitting(true)
    setError(null)
    let rank: number | null = null
    try {
      const data = await publicApi.score({
        gameId,
        playerToken,
        timer: finalTime.toFixed(3),
        score: Math.round(difference * 1000),
      })
      if (typeof data.rank === 'number') rank = data.rank
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar la puntuación')
    } finally {
      setSubmitting(false)
      onFinished({ time: finalTime, difference, rank })
    }
  }

  return (
    <div className="card p-6 space-y-6 text-center">
      <div>
        <p className="text-sm text-textSub">Jugando como</p>
        <h1 className="text-xl font-bold truncate">{displayName}</h1>
      </div>

      <div className="h-24 flex items-center justify-center">
        {gameState === 'hidden' || gameState === 'finished' ? (
          <p className="text-4xl font-bold text-textSub tracking-widest">??:??.?</p>
        ) : (
          <p className="text-5xl font-mono font-bold tabular-nums">{formatTimer(timer)}</p>
        )}
      </div>

      {gameState === 'preparing' && (
        <>
          <p className="text-sm text-textSub">Detén el cronómetro lo más cerca posible de 10 segundos. Se oculta a los 5 s.</p>
          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-xl py-4 text-xl font-bold bg-primary/25 border border-primary/40"
          >
            EMPEZAR
          </button>
        </>
      )}

      {(gameState === 'playing' || gameState === 'hidden') && (
        <button
          type="button"
          onClick={() => void handleStop()}
          className="w-full rounded-xl py-4 text-xl font-bold bg-primary/25 border border-primary/40"
        >
          DETENER
        </button>
      )}

      {gameState === 'finished' && submitting && (
        <p className="text-sm text-textSub">Enviando puntuación...</p>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  )
}
