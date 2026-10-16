import { useCallback, useEffect, useRef, useState } from 'react'
import { PublicApiError, publicApi, type StackAssignment, type StackFinishResponse } from '../../api/publicApi'
import ScoreResultView from '../../core/participant/ScoreResultView'
import { savePlayerSession } from '../../core/participant/playerSession'
import ProfileAvatar from '../../core/widgets/ProfileAvatar'
import { isStackConfig, type StackConfig, type StackSnapshot } from './stackLogic'
import type { StackSceneController } from './stackScene'
import { clearPendingStackResult, loadPendingStackResult, savePendingStackResult, type PendingStackResult } from './stackResultStorage'
import './stack.css'

type Props = {
  gameId: string
  playerToken: string
  config: StackConfig | undefined
  assignment: StackAssignment
  startSupported?: boolean
  finishSupported?: boolean
}

type SceneStatus = 'loading' | 'ready' | 'lost' | 'error'
type StartStatus = 'idle' | 'pending' | 'retry' | 'started' | 'blocked'
const INITIAL_SNAPSHOT: StackSnapshot = { state: 'IDLE', score: 0, perfect: false, placements: [] }

export default function StackParticipantPlay({ gameId, playerToken, config, assignment, startSupported = false, finishSupported = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<StackSceneController | null>(null)
  const mountedRef = useRef(false)
  const startLockRef = useRef(false)
  const attemptIdRef = useRef<string | null>(null)
  const confirmedAttemptRef = useRef(assignment.attempt)
  const finishLockRef = useRef(false)
  const autoFinishRef = useRef<string | null>(null)
  const [status, setStatus] = useState<SceneStatus>('loading')
  const [startStatus, setStartStatus] = useState<StartStatus>(assignment.attempt || assignment.score != null ? 'blocked' : 'idle')
  const [snapshot, setSnapshot] = useState<StackSnapshot>(INITIAL_SNAPSHOT)
  const [paused, setPaused] = useState(false)
  const [manualPause, setManualPause] = useState(false)
  const [error, setError] = useState('')
  const [finishEvidence, setFinishEvidence] = useState<PendingStackResult | null>(null)
  const [finishResult, setFinishResult] = useState<StackFinishResponse | null>(null)
  const [finishStatus, setFinishStatus] = useState<'idle' | 'pending' | 'retry' | 'blocked' | 'saved'>('idle')
  const [finishError, setFinishError] = useState('')
  const [storageWarning, setStorageWarning] = useState('')

  useEffect(() => {
    if (!assignment.attempt || assignment.score != null) return
    try {
      setFinishEvidence(loadPendingStackResult(gameId, assignment.playerId, assignment.attempt.attemptId))
    } catch (cause) {
      setStorageWarning(cause instanceof Error ? cause.message : 'No se pudo recuperar el resultado pendiente.')
    }
  }, [assignment, gameId])

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false
    let controller: StackSceneController | undefined
    const initialize = async () => {
      setStatus('loading')
      try {
        if (!isStackConfig(config)) throw new Error('No se ha recibido una configuración válida de STACK.')
        const { createStackScene } = await import('./stackScene')
        if (cancelled || !canvasRef.current) return
        controller = createStackScene(canvasRef.current, {
          config,
          onContextLost: () => setStatus('lost'),
          onContextRestored: () => setStatus('ready'),
          onError: (cause) => {
            setError(cause instanceof Error ? cause.message : 'No se pudo recuperar la escena 3D.')
            setStatus('error')
          },
          onUpdate: setSnapshot,
          onPauseChange: setPaused,
        })
        sceneRef.current = controller
        setStatus('ready')
      } catch (cause) {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar la escena 3D.')
        setStatus('error')
      }
    }
    void initialize()
    return () => {
      cancelled = true
      mountedRef.current = false
      sceneRef.current = null
      controller?.dispose()
    }
  }, [config])

  const start = async () => {
    if (!startSupported || !finishSupported || startLockRef.current || assignment.attempt || assignment.score != null || status !== 'ready' || !sceneRef.current) return
    if (startStatus !== 'idle' && startStatus !== 'retry') return
    startLockRef.current = true
    setStartStatus('pending')
    setError('')
    let confirmed = false
    try {
      if (!attemptIdRef.current) {
        const bytes = new Uint8Array(16)
        window.crypto.getRandomValues(bytes)
        attemptIdRef.current = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      }
      const result = await publicApi.startStackAttempt({ gameId, playerToken, attemptId: attemptIdRef.current })
      confirmed = true
      if (
        result.ok !== true || result.gameId !== gameId || result.playerId !== assignment.playerId ||
        result.attemptId !== attemptIdRef.current || result.status !== 'started' ||
        result.configVersion !== '1' || !isStackConfig(result.configSnapshot) ||
        typeof result.startedAt !== 'string' || !Number.isFinite(Date.parse(result.startedAt))
      ) {
        throw new Error('El inicio no devolvió las reglas del intento. No se iniciará otra partida; actualiza el backend y verifica tu estado.')
      }
      confirmedAttemptRef.current = {
        attemptId: result.attemptId, status: result.status,
        startedAt: result.startedAt, configVersion: result.configVersion,
      }
      try {
        savePlayerSession(gameId, playerToken, { ...assignment, attempt: confirmedAttemptRef.current })
      } catch {
        setStorageWarning('El intento ya está confirmado en el servidor, pero no se pudo actualizar la sesión de este navegador. No cierres ni recargues la partida.')
      }
      if (!mountedRef.current || !sceneRef.current) return
      setStartStatus('started')
      sceneRef.current.start(result.configSnapshot)
    } catch (cause) {
      if (!mountedRef.current) return
      const rejected = cause instanceof PublicApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 408 && cause.status !== 429
      setStartStatus(confirmed || rejected ? 'blocked' : 'retry')
      const message = cause instanceof Error ? cause.message : 'No se pudo confirmar el inicio de la partida.'
      setError(confirmed ? `El backend ya ha consumido tu intento, pero no se pudo iniciar el juego: ${message}` : message)
    } finally {
      startLockRef.current = false
    }
  }

  useEffect(() => {
    if (snapshot.state !== 'GAME_OVER' || finishEvidence || finishResult || !confirmedAttemptRef.current) return
    const evidence = {
      playerId: assignment.playerId,
      attemptId: confirmedAttemptRef.current.attemptId,
      placements: snapshot.placements,
    }
    try {
      savePendingStackResult(gameId, evidence)
    } catch {
      setStorageWarning('No se pudo conservar el envío en este navegador. No cierres ni recargues hasta confirmar el guardado.')
    }
    setFinishEvidence(evidence)
  }, [snapshot, finishEvidence, finishResult, assignment.playerId, gameId])

  const submitFinish = useCallback(async (evidence: PendingStackResult) => {
    if (finishLockRef.current || !finishSupported) return
    finishLockRef.current = true
    setFinishStatus('pending')
    setFinishError('')
    try {
      const result = await publicApi.finishStackAttempt({
        gameId, playerToken, attemptId: evidence.attemptId, placements: evidence.placements,
      })
      if (
        result.ok !== true || result.gameId !== gameId || result.playerId !== assignment.playerId ||
        result.attemptId !== evidence.attemptId || result.status !== 'finished' || result.configVersion !== '1' ||
        !Number.isSafeInteger(result.score) || result.score < 0 ||
        (result.rank !== null && (!Number.isSafeInteger(result.rank) || result.rank < 1)) ||
        typeof result.scoreUpdatedAt !== 'string' || !Number.isFinite(Date.parse(result.scoreUpdatedAt))
      ) {
        throw new Error('El servidor no confirmó un resultado válido. Reintenta el mismo envío.')
      }
      if (!mountedRef.current) return
      setFinishResult(result)
      setFinishStatus('saved')
      try {
        const attempt = confirmedAttemptRef.current
        if (attempt) {
          savePlayerSession(gameId, playerToken, {
            ...assignment,
            attempt: { ...attempt, status: 'finished', finishedAt: result.scoreUpdatedAt },
            score: result.score, rank: result.rank,
          })
        }
        clearPendingStackResult(gameId)
        setStorageWarning('')
      } catch {
        setStorageWarning('Resultado guardado en el servidor, pero no se pudo actualizar la copia de este navegador.')
      }
    } catch (cause) {
      if (!mountedRef.current) return
      const rejected = cause instanceof PublicApiError && cause.status >= 400 && cause.status < 500 && cause.status !== 408 && cause.status !== 429
      setFinishStatus(rejected ? 'blocked' : 'retry')
      setFinishError(cause instanceof Error ? cause.message : 'No se pudo confirmar el guardado del resultado.')
    } finally {
      finishLockRef.current = false
    }
  }, [assignment, gameId, playerToken, finishSupported])

  useEffect(() => {
    if (!finishEvidence || !finishSupported || autoFinishRef.current === finishEvidence.attemptId) return
    autoFinishRef.current = finishEvidence.attemptId
    void submitFinish(finishEvidence)
  }, [finishEvidence, finishSupported, submitFinish])

  const savedScore = finishResult?.score ?? assignment.score
  const savedRank = finishResult?.rank ?? assignment.rank
  const localScore = finishEvidence ? finishEvidence.placements.length - 1 : snapshot.score
  const hasResult = savedScore != null || finishEvidence !== null || snapshot.state === 'GAME_OVER'
  const playing = snapshot.state === 'PLAYING' || snapshot.state === 'PLACING'
  const canPlace = snapshot.state === 'PLAYING' && status === 'ready' && !paused && !manualPause
  const place = () => {
    if (canPlace) sceneRef.current?.place()
  }
  const togglePause = () => {
    const next = !manualPause
    setManualPause(next)
    sceneRef.current?.setPaused(next)
  }

  return (
    <section className="card p-4 space-y-4 text-center" aria-label="STACK">
      <header className="flex items-center justify-center gap-3 min-w-0">
        <img src="/images/stack-logo.png" alt="STACK" className="h-16 w-auto max-w-[40%] shrink-0 object-contain" />
        <div className="flex items-center gap-2 min-w-0">
          <ProfileAvatar username={assignment.displayName} profilePicUrl={assignment.profilePicUrl} size="md" />
          <p className="text-sm font-semibold truncate text-left" title={assignment.displayName}>{assignment.displayName}</p>
        </div>
      </header>
      <div className="flex items-center justify-between gap-3">
        <p className="stack-score rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 font-semibold tabular-nums" aria-live="polite" aria-atomic="true">
          Pizzas: <span key={savedScore ?? localScore} className={playing ? 'stack-score-value' : undefined}>{savedScore ?? localScore}</span>
        </p>
        {playing && (
          <button type="button" onClick={togglePause} className="rounded-xl border border-white/15 px-4 py-2 text-sm">
            {manualPause ? 'Reanudar' : 'Pausar'}
          </button>
        )}
      </div>
      <div className="stack-viewport relative w-full h-[45vh] min-h-[220px] max-h-[440px] rounded-xl overflow-hidden border border-primary/20">
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          style={{ touchAction: playing ? 'none' : 'auto' }}
          aria-label="Escena 3D de pizzas rectangulares"
          onPointerDown={(event) => {
            if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
            if (canPlace) {
              event.preventDefault()
              place()
            }
          }}
        />
        {snapshot.perfect && playing && (
          <div
            key={snapshot.score}
            className="stack-perfect absolute top-4 inset-x-0 flex flex-col items-center pointer-events-none"
            style={{ animationPlayState: paused || manualPause || status !== 'ready' ? 'paused' : 'running' }}
            role="status"
          >
            <p className="stack-perfect-label rounded-full border border-primary/30 px-5 py-2 font-bold text-accent tracking-widest">PERFECT!</p>
            <p className="mt-1 text-xs font-semibold text-textMain">Sin perder superficie</p>
          </div>
        )}
        {snapshot.state === 'PLAYING' && !paused && !manualPause && status === 'ready' && (
          <p className="absolute bottom-3 inset-x-0 text-xs font-semibold text-textSub pointer-events-none">Toca para apilar</p>
        )}
        {status === 'loading' && <p role="status" className="absolute inset-0 flex items-center justify-center text-textSub">Cargando escena 3D...</p>}
        {status === 'lost' && (
          <p role="alert" className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4">
            Se ha perdido el contexto gráfico. Partida pausada hasta su recuperación.
          </p>
        )}
        {paused && playing && status === 'ready' && (
          <p role="status" className="absolute inset-0 flex items-center justify-center bg-black/70 text-white pointer-events-none">Partida pausada</p>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {storageWarning && <p role="alert" className="text-sm text-red-300">{storageWarning}</p>}
      {(startStatus === 'idle' || startStatus === 'pending' || startStatus === 'retry') && (
        <div className="space-y-3">
          <p className="text-sm text-textSub">
            Toca la pizza o pulsa COLOCAR para apilar. Solo tienes un intento: se consume al empezar, aunque cierres o recargues.
          </p>
          <p className="text-xs text-textSub">Al terminar, el servidor valida y guarda tu puntuación en el ranking.</p>
          {(!startSupported || !finishSupported) && <p role="alert" className="text-sm text-red-300">El backend necesita la actualización de Fase 3 antes de empezar. Tu intento no se ha consumido.</p>}
          <button
            type="button"
            onClick={() => void start()}
            disabled={!startSupported || !finishSupported || status !== 'ready' || startStatus === 'pending'}
            className="w-full rounded-xl py-4 font-bold bg-primary/20 border border-primary/30 disabled:opacity-50"
          >
            {startStatus === 'pending' ? 'Confirmando intento...' : startStatus === 'retry' ? 'Reintentar confirmación' : 'EMPEZAR'}
          </button>
        </div>
      )}
      {playing && (
        <button
          type="button"
          onClick={place}
          disabled={!canPlace}
          className="w-full rounded-xl py-4 font-bold bg-primary/20 border border-primary/30 disabled:opacity-50"
        >
          {snapshot.state === 'PLACING' ? 'Colocando...' : 'COLOCAR'}
        </button>
      )}
      {startStatus === 'blocked' && !hasResult && (
        <p role="status" className="text-sm text-textSub">
          Tu intento no está disponible. Si ya empezó, recargar esta página no permite otra partida.
        </p>
      )}
      {hasResult && (
        <ScoreResultView
          title="Fin de la partida"
          displayName={assignment.displayName}
          profilePicUrl={assignment.profilePicUrl}
          rank={savedScore != null ? savedRank : null}
          notice={savedScore != null
            ? 'Resultado validado y guardado en el ranking. Tu único intento ya está consumido.'
            : 'Resultado local pendiente de confirmación del servidor. Tu único intento ya está consumido.'}
        >
          <div className="space-y-1">
            <p className="text-sm text-textSub">Pizzas apiladas</p>
            <p className="text-3xl font-bold tabular-nums">{savedScore ?? localScore}</p>
          </div>
          {finishStatus === 'pending' && <p role="status">Validando y guardando resultado...</p>}
          {finishError && <p role="alert" className="text-sm text-red-300">{finishError}</p>}
          {finishEvidence && !finishSupported && savedScore == null && (
            <p role="alert">El backend necesita actualizarse para guardar este resultado. No se iniciará otra partida.</p>
          )}
          {finishStatus === 'retry' && finishEvidence && (
            <button
              type="button"
              onClick={() => void submitFinish(finishEvidence)}
              className="w-full rounded-xl py-3 font-bold bg-primary/20 border border-primary/30"
            >
              Reintentar guardado
            </button>
          )}
        </ScoreResultView>
      )}
    </section>
  )
}
