import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ThemeProvider } from '../theme'
import { getGameById } from '../../games'
import { publicApi, type PublicGameResponse } from '../../api/publicApi'
import { loadAssignment, loadPlayerToken } from './playerSession'
import JoinForm from './JoinForm'
import AssignmentView from './AssignmentView'
import ValidateView from './ValidateView'
import ResultView from './ResultView'

type Step = 'loading' | 'unsupported' | 'join' | 'assignment' | 'validate' | 'result'

export default function ParticipantShell() {
  const { gameId = '' } = useParams()
  const game = getGameById('EMPAREJA2')
  const [step, setStep] = useState<Step>('loading')
  const [gameMeta, setGameMeta] = useState<PublicGameResponse | null>(null)
  const [playerToken, setPlayerToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        if (meta.gameType !== 'EMPAREJA2') {
          setStep('unsupported')
          return
        }
        const token = loadPlayerToken(gameId)
        const assignment = loadAssignment(gameId)
        if (token && assignment) {
          setPlayerToken(token)
          if (assignment.validated) {
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

  const colors = game?.colors

  return (
    <ThemeProvider game={game ?? null}>
      <div
        className="min-h-dvh text-textMain font-sans px-4 py-6"
        style={{ background: colors?.background ?? '#0B0A12', color: colors?.textMain ?? '#EAEAF2' }}
      >
        <div className="mx-auto max-w-md w-full space-y-6">
          {step === 'loading' && <p className="text-center text-textSub">Cargando...</p>}
          {step === 'unsupported' && (
            <div className="card p-6 text-center space-y-2">
              <p className="font-semibold">Juego no disponible</p>
              <p className="text-sm text-textSub">{error || 'Este enlace no es válido o el juego no admite participación web todavía.'}</p>
            </div>
          )}
          {step === 'join' && gameMeta && (
            <JoinForm
              gameId={gameId}
              gameMeta={gameMeta}
              onJoined={(token) => {
                setPlayerToken(token)
                setStep('assignment')
              }}
            />
          )}
          {step === 'assignment' && gameMeta && playerToken && (
            <AssignmentView
              gameId={gameId}
              gameMeta={gameMeta}
              playerToken={playerToken}
              onValidate={() => setStep('validate')}
            />
          )}
          {step === 'validate' && playerToken && (
            <ValidateView
              gameId={gameId}
              playerToken={playerToken}
              onResult={() => setStep('result')}
              onBack={() => setStep('assignment')}
            />
          )}
          {step === 'result' && (
            <ResultView gameId={gameId} onPlayAgain={() => setStep('validate')} />
          )}
        </div>
      </div>
    </ThemeProvider>
  )
}
