import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { publicApi, PublicApiError, type BasketAssignment, type BasketStartResponse } from '../../api/publicApi'
import type { PrizeCatalog } from '../../core/prizes'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'
import {
  basketAttemptStorageKey,
  clearBasketAttemptRecord,
  persistBasketAttemptRecord,
  readBasketAttemptRecord,
} from './basketAttemptStorage'
import type { BasketAttemptRecord } from './basketAttemptStorage'
import { BasketSceneController } from './basketScene'
import {
  basketShotFromGesture,
  DEFAULT_BASKET_CONFIG,
  replayBasketShots,
  simulateBasketShotDetailed,
  validateBasketShots,
} from './basketLogic'
import type { BasketConfig, BasketShot } from './basketLogic'
import './basket.css'

type Props = {
  gameId: string
  playerToken: string
  config?: BasketConfig
  assignment: BasketAssignment
  startSupported?: boolean
  finishSupported?: boolean
  prizeCatalog?: PrizeCatalog
  prizeState?: 'open' | 'closing' | 'closed'
  canStart?: boolean
  recoveryLatencyMs?: number
}

type Phase = 'loading' | 'ready' | 'starting' | 'start-retry' | 'playing' | 'sending' | 'finish-error'
  | 'finished' | 'expired' | 'blocked'
type ClockOrigin = { elapsedMs: number; performanceAt: number }
type Gesture = { pointerId: number; x: number; y: number; at: number; rect: DOMRect }

const fixedConfig = (value: BasketConfig | undefined) => Boolean(value
  && value.configVersion === DEFAULT_BASKET_CONFIG.configVersion
  && value.durationMs === DEFAULT_BASKET_CONFIG.durationMs
  && value.flightMs === DEFAULT_BASKET_CONFIG.flightMs
  && value.cooldownMs === DEFAULT_BASKET_CONFIG.cooldownMs)
const attemptId = () => globalThis.crypto?.randomUUID?.()
  ?? `basket-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
const timeLabel = (elapsed: number) => {
  const left = Math.max(0, Math.ceil((DEFAULT_BASKET_CONFIG.durationMs - elapsed) / 1_000))
  return `00:${String(left).padStart(2, '0')}`
}

function validClock(startedAt: string, serverNow: string, expiresAt: string): boolean {
  const start = Date.parse(startedAt)
  const now = Date.parse(serverNow)
  const end = Date.parse(expiresAt)
  return Number.isFinite(start) && Number.isFinite(now) && Number.isFinite(end)
    && now >= start && end - start === DEFAULT_BASKET_CONFIG.durationMs
}

function isValidStartResponse(response: BasketStartResponse, gameId: string, id: string, playerId: number): boolean {
  return response?.ok === true && response.gameId === gameId && response.attemptId === id
    && response.playerId === playerId
    && response.status === 'started' && response.configVersion === '1'
    && fixedConfig(response.configSnapshot)
    && validClock(response.startedAt, response.serverNow, response.expiresAt)
}

export default function BasketParticipantPlay({
  gameId, playerToken, config, assignment, startSupported = false, finishSupported = false,
  prizeState = 'open', canStart = true, recoveryLatencyMs = 0,
}: Props) {
  const { language } = useParticipantLanguage()
  const t = useCallback((spanish: string, english?: string) => language === 'en' ? english ?? spanish : spanish, [language])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BasketSceneController | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const finishLock = useRef(false)
  const clockOrigin = useRef<ClockOrigin | null>(null)
  const elapsedRef = useRef(0)
  const recordRef = useRef<BasketAttemptRecord | null>(null)
  const storageKey = useMemo(() => basketAttemptStorageKey(gameId, assignment.playerId), [gameId, assignment.playerId])
  const [phase, setPhase] = useState<Phase>('loading')
  const [record, setRecord] = useState<BasketAttemptRecord | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [score, setScore] = useState(assignment.score ?? 0)
  const [rank, setRank] = useState<number | null>(assignment.rank ?? null)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [sceneError, setSceneError] = useState('')

  const setAttemptRecord = useCallback((next: BasketAttemptRecord) => {
    recordRef.current = next
    setRecord(next)
  }, [])

  const setClock = useCallback((serverElapsedMs: number) => {
    const origin = { elapsedMs: Math.max(0, serverElapsedMs), performanceAt: performance.now() }
    clockOrigin.current = origin
    elapsedRef.current = origin.elapsedMs
    setElapsedMs(origin.elapsedMs)
  }, [])

  const freshElapsed = useCallback(() => {
    const origin = clockOrigin.current
    return origin ? origin.elapsedMs + Math.max(0, performance.now() - origin.performanceAt) : elapsedRef.current
  }, [])
  const shotResults = useMemo(() => (record?.shots ?? []).map(shot => ({
    shot, result: simulateBasketShotDetailed(shot),
  })), [record])
  const displayedScore = phase === 'finished' ? score : shotResults.filter(({ shot, result }) =>
    result.scoredAtMs !== null && elapsedMs >= shot.atMs + result.scoredAtMs).length

  useEffect(() => {
    let controller: BasketSceneController | null = null
    try {
      if (!canvasRef.current) return
      controller = new BasketSceneController(canvasRef.current, {
        onContextLost: () => setSceneError(t('Se perdió la cancha 3D. El reloj continúa.', 'The 3D court was lost. The clock continues.')),
        onContextRestored: () => setSceneError(''),
      })
      sceneRef.current = controller
    } catch {
      setSceneError(t('Este dispositivo no puede mostrar la cancha 3D. Actualiza el navegador o prueba otro dispositivo.',
        'This device cannot display the 3D court. Update your browser or try another device.'))
    }
    return () => {
      controller?.dispose()
      if (sceneRef.current === controller) sceneRef.current = null
    }
  }, [language])

  useEffect(() => {
    const serverAttempt = assignment.attempt
    if (serverAttempt?.status === 'finished' || serverAttempt?.status === 'expired') {
      if (serverAttempt.status === 'finished') {
        setScore(assignment.score ?? 0)
        setRank(assignment.rank ?? null)
        if (!clearBasketAttemptRecord(storageKey)) {
          setError(t('Resultado confirmado; no se pudo limpiar el registro local.', 'Result confirmed; the local record could not be cleared.'))
        }
      }
      setPhase(serverAttempt.status)
      return
    }
    const stored = readBasketAttemptRecord(storageKey, gameId, assignment.playerId)
    if (stored.kind === 'unavailable') {
      setError(t('No se puede acceder al almacenamiento seguro de este navegador. No se iniciará un intento.',
        'This browser storage is unavailable. An attempt will not be started.'))
      setPhase('blocked')
      return
    }
    if (stored.kind === 'invalid') {
      setError(t('El registro local está dañado. No iniciaremos otro intento para evitar perder tu partida.',
        'The local record is damaged. We will not start another attempt and risk losing your game.'))
      setPhase('blocked')
      return
    }
    const local = stored.kind === 'ok' ? stored.record : null
    if (serverAttempt?.status === 'started') {
      if (!fixedConfig(serverAttempt.configSnapshot)
        || !validClock(serverAttempt.startedAt, serverAttempt.serverNow, serverAttempt.expiresAt)) {
        setError(t('Las reglas guardadas no son compatibles con esta versión.', 'The saved rules are not compatible with this version.'))
        setPhase('blocked')
        return
      }
      if (!local || local.attemptId !== serverAttempt.attemptId) {
        setError(t('No encontramos la evidencia local de este intento. No se puede iniciar otro intento en este dispositivo.',
          'The local evidence for this attempt is missing. A new attempt cannot be started on this device.'))
        setPhase('blocked')
        return
      }
      const restored: BasketAttemptRecord = {
        ...local,
        phase: 'started',
        startedAt: serverAttempt.startedAt,
        serverNow: serverAttempt.serverNow,
        expiresAt: serverAttempt.expiresAt,
        configVersion: serverAttempt.configVersion,
      }
      if (!persistBasketAttemptRecord(storageKey, restored)) {
        setError(t('No se pudo guardar la recuperación del intento. Libera espacio y vuelve a cargar la página.',
          'Could not save this recovery record. Free some space and reload the page.'))
        setPhase('blocked')
        return
      }
      setAttemptRecord(restored)
      setClock(Date.parse(serverAttempt.serverNow) - Date.parse(serverAttempt.startedAt) + recoveryLatencyMs)
      setPhase('playing')
      return
    }
    if (local) {
      setAttemptRecord(local)
      setPhase(local.phase === 'pending' ? 'start-retry' : 'blocked')
      if (local.phase === 'started') {
        setError(t('El servidor no devolvió el intento guardado. No se iniciará un intento nuevo.',
          'The server did not return the saved attempt. A new attempt will not be started.'))
      }
      return
    }
    setPhase('ready')
  }, [assignment, gameId, recoveryLatencyMs, setAttemptRecord, setClock, storageKey, t])

  useEffect(() => {
    if (phase !== 'playing' || !clockOrigin.current) return
    const update = () => {
      const origin = clockOrigin.current
      if (!origin) return
      const next = origin.elapsedMs + Math.max(0, performance.now() - origin.performanceAt)
      elapsedRef.current = next
      setElapsedMs(next)
    }
    update()
    const timer = window.setInterval(update, 100)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setElapsedMs(elapsedMs)
    const shots = record?.shots ?? []
    let flying: BasketShot | undefined
    for (let i = shots.length - 1; i >= 0; i--) {
      const candidate = shots[i]
      if (elapsedMs >= candidate.atMs && elapsedMs < candidate.atMs + DEFAULT_BASKET_CONFIG.flightMs) {
        flying = candidate
        break
      }
    }
    if (flying) scene.setActiveShot(flying, elapsedMs - flying.atMs)
    else scene.clearShot()
  }, [elapsedMs, record])

  const finish = useCallback(async () => {
    const current = recordRef.current
    if (!current || finishLock.current || !finishSupported || !validateBasketShots(current.shots)) return
    const { technicalEndMs } = replayBasketShots(current.shots)
    if (freshElapsed() < technicalEndMs) return
    finishLock.current = true
    setPhase('sending')
    setError('')
    try {
      const response = await publicApi.finishBasketAttempt({
        gameId, playerToken, attemptId: current.attemptId, shots: current.shots,
      })
      if (response?.ok !== true || response.gameId !== gameId || response.attemptId !== current.attemptId
        || response.playerId !== assignment.playerId || response.status !== 'finished' || response.configVersion !== '1'
        || !Number.isInteger(response.score) || response.score < 0 || response.score > current.shots.length
        || !(response.rank === null || (Number.isInteger(response.rank) && response.rank > 0))
        || !Number.isFinite(Date.parse(response.finishedAt)) || !Number.isFinite(Date.parse(response.scoreUpdatedAt))) {
        throw new Error(t('No se confirmó el resultado.', 'The result was not confirmed.'))
      }
      setScore(response.score)
      setRank(response.rank)
      if (!clearBasketAttemptRecord(storageKey)) {
        setError(t('Resultado confirmado; no se pudo limpiar el registro local.', 'Result confirmed; the local record could not be cleared.'))
      }
      setPhase('finished')
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : t('No se pudo enviar el resultado. Conservamos tus lanzamientos para reintentar.', 'Could not send the result. Your shots are saved for a retry.'))
      setPhase(cause instanceof PublicApiError && cause.code === 'AttemptExpired' ? 'expired' : 'finish-error')
    } finally {
      finishLock.current = false
    }
  }, [assignment.playerId, finishSupported, freshElapsed, gameId, playerToken, storageKey, t])

  useEffect(() => {
    if (phase !== 'playing' || !record) return
    const { technicalEndMs } = replayBasketShots(record.shots)
    if (elapsedMs >= technicalEndMs) void finish()
  }, [elapsedMs, finish, phase, record])

  const start = async () => {
    if (!startSupported || !finishSupported || !canStart || !fixedConfig(config)) {
      setError(t('La configuración de juego no está disponible. Pide al equipo del evento que revise el enlace.',
        'The game configuration is unavailable. Ask the event team to check the link.'))
      return
    }
    let current = recordRef.current
    if (!current) {
      current = {
        schemaVersion: 1,
        gameId,
        playerId: assignment.playerId,
        attemptId: attemptId(),
        phase: 'pending',
        configVersion: '1',
        shots: [],
      }
      if (!persistBasketAttemptRecord(storageKey, current)) {
        setError(t('No se pudo guardar este intento en el dispositivo. Activa el almacenamiento e inténtalo de nuevo.',
          'This attempt could not be saved on the device. Enable storage and try again.'))
        setPhase('blocked')
        return
      }
      setAttemptRecord(current)
    }
    const requestStartedAt = performance.now()
    setPhase('starting')
    setError('')
    try {
      const response = await publicApi.startBasketAttempt({
        gameId, playerToken, attemptId: current.attemptId,
      })
      if (!isValidStartResponse(response, gameId, current.attemptId, assignment.playerId)) {
        throw new Error(t('La respuesta de inicio no coincide con las reglas de BASKET.',
          'The start response does not match the BASKET rules.'))
      }
      const started: BasketAttemptRecord = {
        ...current,
        phase: 'started',
        startedAt: response.startedAt,
        serverNow: response.serverNow,
        expiresAt: response.expiresAt,
        configVersion: response.configVersion,
      }
      if (!persistBasketAttemptRecord(storageKey, started)) {
        setError(t('El intento empezó, pero no se pudo actualizar su recuperación local. No cierres esta página.',
          'The attempt started, but its local recovery record could not be updated. Keep this page open.'))
        setAttemptRecord(current)
        setPhase('blocked')
        return
      }
      setAttemptRecord(started)
      const serverElapsed = Date.parse(response.serverNow) - Date.parse(response.startedAt)
      const requestElapsed = performance.now() - requestStartedAt
      setClock(Math.max(0, serverElapsed) + Math.max(0, requestElapsed))
      setPhase('playing')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message
        : t('No se pudo confirmar el inicio. Reintenta con el mismo intento.', 'Start was not confirmed. Retry the same attempt.'))
      setPhase('start-retry')
    }
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'playing' || sceneError || gestureRef.current || event.isPrimary === false) return
    const now = freshElapsed()
    const shots = recordRef.current?.shots ?? []
    const last = shots[shots.length - 1]
    if (now >= DEFAULT_BASKET_CONFIG.durationMs || (last && now < last.atMs + DEFAULT_BASKET_CONFIG.cooldownMs)
      || (last && now < last.atMs + DEFAULT_BASKET_CONFIG.flightMs)) {
      setFeedback(t('Espera a que el balón vuelva.', 'Wait for the ball to return.'))
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    if (Math.abs(event.clientX - rect.left - rect.width / 2) > rect.width * 0.32) {
      setFeedback(t('Desliza desde el balón, en el centro.', 'Swipe from the ball in the center.'))
      return
    }
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), rect }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer may have left the active surface */ }
    setFeedback('')
  }

  const finishGesture = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (cancelled) {
      setFeedback(t('Lanzamiento cancelado. Desliza desde el balón.', 'Shot cancelled. Swipe from the ball.'))
      return
    }
    const now = freshElapsed()
    if (phase !== 'playing' || sceneError || now >= DEFAULT_BASKET_CONFIG.durationMs) {
      setFeedback(t('El tiempo de lanzamiento ha terminado.', 'The shooting time has ended.'))
      return
    }
    const durationMs = performance.now() - gesture.at
    const dx = event.clientX - gesture.x
    const dy = gesture.y - event.clientY
    const shot = basketShotFromGesture({
      deltaX: dx,
      upwardPixels: dy,
      width: gesture.rect.width,
      height: gesture.rect.height,
      durationMs,
      atMs: Math.floor(now),
    })
    if (!shot) {
      setFeedback(t('Desliza hacia arriba desde el balón para lanzar.', 'Swipe upward from the ball to shoot.'))
      return
    }
    const previous = recordRef.current
    if (!previous || previous.phase !== 'started') {
      setFeedback(t('No se pudo recuperar el intento. El lanzamiento no se ha aceptado.',
        'The attempt could not be recovered. The shot was not accepted.'))
      return
    }
    const nextShots = [...previous.shots, shot]
    if (!validateBasketShots(nextShots)) {
      setFeedback(t('Este lanzamiento no está disponible ahora.', 'This shot is not available now.'))
      return
    }
    const next = { ...previous, shots: nextShots }
    if (!persistBasketAttemptRecord(storageKey, next)) {
      setFeedback(t('No se pudo guardar el lanzamiento. No se ha aceptado; libera espacio y vuelve a intentarlo.',
        'The shot could not be saved. It was not accepted; free storage and try again.'))
      return
    }
    setAttemptRecord(next)
    setElapsedMs(now)
    setFeedback('')
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => finishGesture(event, false)
  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => finishGesture(event, true)
  const remainingMs = Math.max(0, DEFAULT_BASKET_CONFIG.durationMs - elapsedMs)
  const currentShots = record?.shots ?? []
  const waitingForLastShot = phase === 'playing' && elapsedMs >= DEFAULT_BASKET_CONFIG.durationMs
    && elapsedMs < replayBasketShots(currentShots).technicalEndMs

  return <section className="basket-play mx-auto w-full max-w-md space-y-3 pb-5">
    <header className="flex items-center justify-between gap-3 px-1">
      <div>
        <h1 className="text-xl font-extrabold tracking-wide">{t('BASKET', 'BASKET')}</h1>
        <p className="text-sm text-textSub">{t('Una canasta suma un punto', 'One basket earns one point')}</p>
      </div>
      <div className="flex gap-2">
        <div className="basket-hud-value" aria-label={`${t('Puntuación', 'Score')}: ${displayedScore}`}>
          <span>{t('Puntos', 'Score')}</span><strong>{displayedScore}</strong>
        </div>
        <div className={`basket-hud-value ${remainingMs <= 5_000 && phase === 'playing' ? 'is-urgent' : ''}`}
          role="timer" aria-label={`${t('Tiempo restante', 'Time remaining')}: ${timeLabel(elapsedMs)}`}>
          <span>{t('Tiempo', 'Time')}</span><strong>{timeLabel(elapsedMs)}</strong>
        </div>
      </div>
    </header>

    <div className="basket-court-frame relative overflow-hidden rounded-3xl border border-white/15 bg-[#10151a]">
      <canvas ref={canvasRef} className="basket-canvas block h-[min(60dvh,34rem)] min-h-[24rem] w-full" aria-label={t('Cancha 3D de baloncesto', '3D basketball court')} />
      {phase === 'playing' && elapsedMs < DEFAULT_BASKET_CONFIG.durationMs && (
        <div className="basket-shot-area absolute inset-x-0 bottom-0 z-10 h-[33%] touch-none"
          onPointerDown={handlePointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
          <span className="sr-only">{t('Desliza hacia arriba desde el balón para lanzar', 'Swipe upward from the ball to shoot')}</span>
        </div>
      )}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-center text-xs text-white/90">
        {phase === 'playing'
          ? waitingForLastShot ? t('Resolviendo el último lanzamiento', 'Resolving your last shot')
            : t('Desliza desde el balón', 'Swipe from the ball')
          : t('El aro se mueve de lado a lado', 'The hoop moves side to side')}
      </div>
    </div>

    {feedback && <p role="status" className="min-h-5 text-center text-sm text-accent">{feedback}</p>}
    {sceneError && <p role="alert" className="rounded-xl border border-red-300/30 p-3 text-sm text-red-200">{sceneError}</p>}
    {error && <p role={phase === 'finish-error' || phase === 'start-retry' ? 'alert' : 'status'}
      className="rounded-xl border border-amber-300/30 p-3 text-sm text-amber-100">{error}</p>}

    {phase === 'loading' && <p role="status" className="text-center text-textSub">{t('Recuperando tu intento…', 'Recovering your attempt…')}</p>}
    {(phase === 'ready' || phase === 'start-retry') && <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed">
        <p>{t('Tienes 30 segundos. Desliza hacia arriba desde el balón; la dirección y la velocidad cambian el lanzamiento.',
          'You have 30 seconds. Swipe upward from the ball; direction and speed shape the shot.')}</p>
        <p className="mt-1 text-textSub">{t('El aro se mueve. Cada canasta vale un punto y solo puedes tener un balón en vuelo.',
          'The hoop moves. Each basket is one point, and only one ball can be in flight.')}</p>
      </div>
      {sceneError ? <p className="text-center text-sm text-textSub">{t('No se puede empezar hasta que la cancha 3D esté disponible.',
        'You cannot start until the 3D court is available.')}</p> : <button type="button" className="basket-primary-button w-full"
        disabled={!canStart || !startSupported || !finishSupported}
        onClick={() => void start()}>
        {phase === 'start-retry' ? t('Reintentar el mismo intento', 'Retry the same attempt') : t('Empezar partida', 'Start game')}
      </button>}
      {prizeState !== 'open' && <p className="text-center text-sm text-textSub">
        {t('El evento se está cerrando: no se pueden iniciar nuevos intentos.', 'The event is closing: new attempts are unavailable.')}
      </p>}
    </div>}
    {phase === 'starting' && <p role="status" className="text-center text-textSub">{t('Iniciando partida…', 'Starting game…')}</p>}
    {phase === 'playing' && <div className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm text-textSub">
      {waitingForLastShot
        ? t('El tiempo terminó. Espera a que se resuelva el último balón.', 'Time is up. Wait for the last ball to resolve.')
        : elapsedMs >= DEFAULT_BASKET_CONFIG.durationMs
          ? t('Enviando el resultado seguro…', 'Submitting your saved result…')
          : t('El reloj sigue aunque cambies de pestaña o recargues.', 'The clock keeps running if you switch tabs or reload.')}
    </div>}
    {phase === 'sending' && <p role="status" className="text-center text-textSub">{t('Confirmando puntuación…', 'Confirming score…')}</p>}
    {phase === 'finish-error' && <button type="button" className="basket-primary-button w-full" onClick={() => void finish()}>
      {t('Reintentar envío', 'Retry submission')}
    </button>}
    {phase === 'blocked' && <p role="alert" className="text-center text-sm text-red-200">
      {t('No se iniciará otro intento. Conserva esta página abierta y contacta al equipo del evento.',
        'A new attempt will not be started. Keep this page open and contact the event team.')}
    </p>}
    {phase === 'finished' && <div role="status" className="basket-result-card text-center">
      <p className="text-sm uppercase tracking-widest text-textSub">{t('Resultado confirmado', 'Result confirmed')}</p>
      <p className="mt-1 text-5xl font-black tabular-nums">{score}</p>
      <p className="mt-1 text-sm text-textSub">{t('canastas', 'baskets')}</p>
      {rank != null && <p className="mt-3 font-semibold">{t('Posición', 'Rank')}: #{rank}</p>}
      <p className="mt-3 text-xs text-textSub">{t('Tu puntuación está guardada en el ranking del evento.',
        'Your score is saved to the event leaderboard.')}</p>
    </div>}
    {phase === 'expired' && <p role="status" className="rounded-xl border border-amber-300/30 p-3 text-center text-sm text-amber-100">
      {t('El plazo de envío terminó. Este intento no cuenta para el ranking ni para premios.',
        'The submission window ended. This attempt does not count toward rankings or prizes.')}
    </p>}
    {phase === 'ready' && !canStart && <p role="status" className="text-center text-sm text-textSub">
      {t('El evento ya no admite intentos nuevos.', 'The event no longer accepts new attempts.')}
    </p>}
  </section>
}
