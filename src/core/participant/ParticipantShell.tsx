import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ThemeProvider } from '../theme'
import { getGameById } from '../../games'
import { normalizeGameType } from '../gameTypeMap'
import { publicApi, type PublicGameResponse, type T1merAssignment } from '../../api/publicApi'
import { loadAssignment, loadPlayerToken, savePlayerSession } from './playerSession'
import JoinForm from './JoinForm'
import AssignmentView from './AssignmentView'
import ValidateView from './ValidateView'
import ResultView from './ResultView'
import T1merParticipantPlay from '../../games/t1mer/ParticipantPlay'
import T1merParticipantResult from '../../games/t1mer/ParticipantResult'

type Empareja2Step = 'loading' | 'unsupported' | 'join' | 'assignment' | 'validate' | 'result'
type T1merStep = 'loading' | 'unsupported' | 'join' | 'play' | 'result'
type Step = Empareja2Step | T1merStep

const WEB_PLAY_TYPES = new Set(['EMPAREJA2', 'T1MER'])

function t1merResultFromAssignment(a: T1merAssignment): {
  time: number
  difference: number
  rank: number | null
} | null {
  if (a.score == null || a.timer == null) return null
  return {
    time: a.timer,
    difference: a.score / 1000,
    rank: null,
  }
}

export default function ParticipantShell() {
  const { gameId = '' } = useParams()
  const [step, setStep] = useState<Step>('loading')
  const [gameMeta, setGameMeta] = useState<PublicGameResponse | null>(null)
  const [playerToken, setPlayerToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [t1merResult, setT1merResult] = useState<{
    time: number
    difference: number
    rank: number | null
  } | null>(null)

  const gameType = normalizeGameType(gameMeta?.gameType)
  const game = getGameById(gameType)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!gameId) {
        setStep('unsupported')
        return
      }
      try {
        const meta = await publicApi.getGame(gameId)
        if (cancelled) return
        setGameMeta(meta)
        const gt = normalizeGameType(meta.gameType)
        if (!WEB_PLAY_TYPES.has(gt)) {
          setStep('unsupported')
          return
        }
        const token = loadPlayerToken(gameId)
        let assignment = loadAssignment(gameId)
        if (token && assignment) {
          setPlayerToken(token)
          if (gt === 'T1MER') {
            try {
              const player = await publicApi.getPlayer(token, gameId)
              if (cancelled) return
              if (player.assignment && 'displayName' in player.assignment) {
                assignment = player.assignment
                savePlayerSession(gameId, token, player.assignment)
              }
            } catch {
              // keep local assignment
            }
            const scored =
              assignment && 'displayName' in assignment
                ? t1merResultFromAssignment(assignment)
                : null
            if (scored) {
              setT1merResult(scored)
              setStep('result')
            } else {
              setStep('play')
            }
          } else if ('validated' in assignment && assignment.validated) {
            setStep('result')
          } else {
            setStep('assignment')
          }
        } else {
          setStep('join')
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el juego')
          setStep('unsupported')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId])

  return (
    <ThemeProvider game={game ?? null}>
      <div className="min-h-dvh bg-club text-textMain font-sans px-4 py-6">
        <div className="mx-auto max-w-md w-full space-y-6">
          {step === 'loading' && <p className="text-center text-textSub">Cargando...</p>}
          {step === 'unsupported' && (
            <div className="card p-6 text-center space-y-2">
              <p className="font-semibold">Juego no disponible</p>
              <p className="text-sm text-textSub">
                {error || 'Este enlace no es válido o el juego no admite participación web todavía.'}
              </p>
            </div>
          )}
          {step === 'join' && gameMeta && (
            <JoinForm
              gameId={gameId}
              gameMeta={gameMeta}
              onJoined={(token) => {
                setPlayerToken(token)
                const gt = normalizeGameType(gameMeta.gameType)
                const assignment = loadAssignment(gameId)
                if (gt === 'T1MER' && assignment && 'displayName' in assignment) {
                  const scored = t1merResultFromAssignment(assignment)
                  if (scored) {
                    setT1merResult(scored)
                    setStep('result')
                    return
                  }
                }
                setStep(gt === 'T1MER' ? 'play' : 'assignment')
              }}
            />
          )}

          {gameType === 'EMPAREJA2' && step === 'assignment' && gameMeta && playerToken && (
            <AssignmentView
              gameId={gameId}
              gameMeta={gameMeta}
              playerToken={playerToken}
              onValidate={() => setStep('validate')}
            />
          )}
          {gameType === 'EMPAREJA2' && step === 'validate' && playerToken && (
            <ValidateView
              gameId={gameId}
              playerToken={playerToken}
              onResult={() => setStep('result')}
              onBack={() => setStep('assignment')}
            />
          )}
          {gameType === 'EMPAREJA2' && step === 'result' && (
            <ResultView gameId={gameId} onPlayAgain={() => setStep('validate')} />
          )}

          {gameType === 'T1MER' && step === 'play' && playerToken && (
            <T1merParticipantPlay
              gameId={gameId}
              playerToken={playerToken}
              onFinished={(result) => {
                setT1merResult(result)
                setStep('result')
              }}
            />
          )}
          {gameType === 'T1MER' && step === 'result' && t1merResult && (
            <T1merParticipantResult
              gameId={gameId}
              time={t1merResult.time}
              difference={t1merResult.difference}
              rank={t1merResult.rank}
            />
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
