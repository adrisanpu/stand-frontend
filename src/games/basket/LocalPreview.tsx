import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import { basketShotFromGesture, DEFAULT_BASKET_CONFIG, replayBasketShots, simulateBasketShotDetailed, validateBasketShots } from './basketLogic'
import type { BasketShot } from './basketLogic'
import { BasketSceneController } from './basketScene'
import './basket.css'

type Gesture = { pointerId: number; x: number; y: number; at: number; rect: DOMRect }

const timeLabel = (elapsed: number) =>
  `00:${String(Math.max(0, Math.ceil((DEFAULT_BASKET_CONFIG.durationMs - elapsed) / 1_000))).padStart(2, '0')}`

export default function BasketLocalPreview() {
  const { language } = useOperatorLanguage()
  const t = (spanish: string, english?: string) => language === 'en' ? english ?? spanish : spanish
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<BasketSceneController | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const startedAt = useRef(0)
  const shotsRef = useRef<BasketShot[]>([])
  const elapsedRef = useRef(0)
  const [phase, setPhase] = useState<'ready' | 'playing' | 'finished'>('ready')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [shots, setShots] = useState<BasketShot[]>([])
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const shotResults = useMemo(() => shots.map(shot => ({ shot, result: simulateBasketShotDetailed(shot) })), [shots])
  const score = shotResults.filter(({ shot, result }) =>
    result.scoredAtMs !== null && elapsedMs >= shot.atMs + result.scoredAtMs).length

  useEffect(() => {
    let scene: BasketSceneController | null = null
    try {
      if (canvasRef.current) {
        scene = new BasketSceneController(canvasRef.current, {
          onContextLost: () => setError(t('Se perdió la cancha 3D. El reloj continúa.', 'The 3D court was lost. The clock continues.')),
          onContextRestored: () => setError(''),
        })
        sceneRef.current = scene
      }
    } catch {
      setError(t('No se pudo mostrar la cancha 3D.', 'The 3D court could not be displayed.'))
    }
    return () => {
      scene?.dispose()
      if (sceneRef.current === scene) sceneRef.current = null
    }
  }, [language])

  useEffect(() => {
    if (phase !== 'playing') return
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - startedAt.current
      elapsedRef.current = elapsed
      setElapsedMs(elapsed)
      sceneRef.current?.setElapsedMs(elapsed)
      const technicalEndMs = replayBasketShots(shotsRef.current).technicalEndMs
      if (elapsed >= technicalEndMs) setPhase('finished')
    }, 50)
    return () => window.clearInterval(timer)
  }, [phase])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    scene.setElapsedMs(elapsedMs)
    const flying = [...shots].reverse().find(shot =>
      elapsedMs >= shot.atMs && elapsedMs < shot.atMs + DEFAULT_BASKET_CONFIG.flightMs)
    if (flying) scene.setActiveShot(flying, elapsedMs - flying.atMs)
    else scene.clearShot()
  }, [elapsedMs, shots])

  const start = () => {
    shotsRef.current = []
    setShots([])
    setElapsedMs(0)
    elapsedRef.current = 0
    startedAt.current = performance.now()
    setFeedback('')
    setPhase('playing')
  }

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'playing' || error || gestureRef.current || event.isPrimary === false) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    if (Math.abs(x - rect.width / 2) > rect.width * 0.32) {
      setFeedback(t('Desliza desde el balón, en el centro.', 'Swipe from the ball in the center.'))
      return
    }
    const now = performance.now() - startedAt.current
    const previous = shotsRef.current[shotsRef.current.length - 1]
    if (now >= DEFAULT_BASKET_CONFIG.durationMs
      || (previous && now < previous.atMs + DEFAULT_BASKET_CONFIG.cooldownMs)) {
      setFeedback(t('Espera a que el balón vuelva.', 'Wait for the ball to return.'))
      return
    }
    gestureRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), rect }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* The pointer may already have left the surface. */ }
    setFeedback('')
  }

  const pointerUp = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    if (cancelled) {
      setFeedback(t('Lanzamiento cancelado.', 'Shot cancelled.'))
      return
    }
    const now = performance.now() - startedAt.current
    if (phase !== 'playing' || error || now >= DEFAULT_BASKET_CONFIG.durationMs) return
    const shot = basketShotFromGesture({
      deltaX: event.clientX - gesture.x,
      upwardPixels: gesture.y - event.clientY,
      width: gesture.rect.width,
      height: gesture.rect.height,
      durationMs: performance.now() - gesture.at,
      atMs: Math.floor(now),
    })
    if (!shot) {
      setFeedback(t('Desliza hacia arriba desde el balón.', 'Swipe upward from the ball.'))
      return
    }
    const next = [...shotsRef.current, shot]
    if (!validateBasketShots(next)) {
      setFeedback(t('Este lanzamiento no está disponible ahora.', 'This shot is not available now.'))
      return
    }
    shotsRef.current = next
    setShots(next)
    setElapsedMs(now)
    setFeedback('')
  }

  const lastShotEnd = replayBasketShots(shots).technicalEndMs
  const waitingForLastShot = phase === 'playing' && elapsedMs >= DEFAULT_BASKET_CONFIG.durationMs
    && elapsedMs < lastShotEnd

  return <section className="basket-play mx-auto w-full max-w-md space-y-3 pb-5">
    <header className="flex items-center justify-between gap-2 px-1">
      <div>
        <h1 className="text-xl font-extrabold tracking-wide">BASKET</h1>
        <p className="text-sm text-textSub">{t('Prueba local, sin ranking ni premios.', 'Local preview, no ranking or prizes.')}</p>
      </div>
      <div className="flex gap-2">
        <div className="basket-hud-value"><span>{t('Puntos', 'Score')}</span><strong>{score}</strong></div>
        <div className="basket-hud-value"><span>{t('Tiempo', 'Time')}</span><strong>{timeLabel(elapsedMs)}</strong></div>
      </div>
    </header>
    <div className="basket-court-frame relative overflow-hidden rounded-3xl border border-white/15 bg-[#10151a]">
      <canvas ref={canvasRef} className="basket-canvas block h-[min(48dvh,26rem)] min-h-[18rem] w-full"
        aria-label={t('Cancha 3D de baloncesto', '3D basketball court')} />
      {phase === 'playing' && elapsedMs < DEFAULT_BASKET_CONFIG.durationMs && <div
        className="basket-shot-area absolute inset-x-0 bottom-0 z-10 h-[34%] touch-none"
        onPointerDown={pointerDown} onPointerUp={event => pointerUp(event)}
        onPointerCancel={event => pointerUp(event, true)} />}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/35 px-3 py-1 text-center text-xs text-white/90">
        {phase === 'playing' ? waitingForLastShot
          ? t('Resolviendo el último lanzamiento', 'Resolving your last shot')
          : t('Desliza desde el balón', 'Swipe from the ball')
          : t('El aro se mueve de lado a lado', 'The hoop moves side to side')}
      </div>
    </div>
    {feedback && <p role="status" className="min-h-5 text-center text-sm text-accent">{feedback}</p>}
    {error && <p role="alert" className="text-center text-sm text-red-200">{error}</p>}
    {phase === 'ready' && <div className="space-y-3">
      <p className="text-sm leading-relaxed">{t('Tienes 30 segundos. Desliza hacia arriba desde el balón; la dirección y la velocidad cambian el lanzamiento. Cada canasta vale un punto.',
        'You have 30 seconds. Swipe upward from the ball; direction and speed shape each shot. Every basket earns one point.')}</p>
      <button type="button" className="basket-primary-button w-full" disabled={!!error} onClick={start}>
        {t('Empezar prueba local', 'Start local preview')}
      </button>
    </div>}
    {phase === 'playing' && <p role="status" className="text-center text-sm text-textSub">
      {waitingForLastShot ? t('El tiempo terminó. Espera al último balón.', 'Time is up. Wait for the last ball.')
        : t('La prueba no envía puntuaciones ni usa APIs oficiales.', 'The preview does not submit scores or use official APIs.')}
    </p>}
    {phase === 'finished' && <div role="status" className="basket-result-card text-center">
      <p className="text-sm uppercase tracking-widest text-textSub">{t('Resultado simulado', 'Simulated result')}</p>
      <p className="mt-1 text-5xl font-black tabular-nums">{score}</p>
      <p className="mt-1 text-sm text-textSub">{t('canastas', 'baskets')}</p>
      <button className="basket-primary-button mt-4 w-full" onClick={start}>{t('Probar de nuevo', 'Try again')}</button>
    </div>}
  </section>
}
