import { useEffect, useRef, useState } from 'react'
import { useOperatorLanguage } from '../../core/shell/operatorLanguage'
import type { Rulet4PanelConfig } from './GameConfig'
import type { Rulet4SceneController } from './rulet4Scene'

export type WheelSpin = { id: number; index: number }

type Props = {
  segments: Rulet4PanelConfig[]
  spin: WheelSpin | null
  completed: boolean
  dimmed: boolean
  onReadyChange: (ready: boolean) => void
  onComplete: (id: number) => void
}

export default function Rulet4Wheel({ segments, spin, completed, dimmed, onReadyChange, onComplete }: Props) {
  const { t } = useOperatorLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Rulet4SceneController | null>(null)
  const propsRef = useRef({ spin, onReadyChange, onComplete })
  propsRef.current = { spin, onReadyChange, onComplete }
  const activeRef = useRef<WheelSpin | null>(null)
  const completedRef = useRef<number | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'lost' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    let cancelled = false
    let controller: Rulet4SceneController | undefined
    setStatus('loading')
    propsRef.current.onReadyChange(false)
    activeRef.current = null
    const initialize = async () => {
      try {
        // Do not load a scene for an effect already replaced during mounting.
        await Promise.resolve()
        if (cancelled) return
        const { createRulet4Scene } = await import('./rulet4Scene')
        if (cancelled || !canvasRef.current) return
        const accent = getComputedStyle(canvasRef.current).getPropertyValue('--color-primary').trim() || '#FACC15'
        controller = createRulet4Scene(canvasRef.current, {
          segments,
          accent,
          reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
          onStatus: (next) => {
            if (cancelled) return
            setStatus(next)
            propsRef.current.onReadyChange(next === 'ready')
          },
          onComplete: () => {
            const active = activeRef.current
            if (cancelled || !active || propsRef.current.spin?.id !== active.id || completedRef.current === active.id) return
            completedRef.current = active.id
            propsRef.current.onComplete(active.id)
          },
          onError: (cause) => {
            if (cancelled) return
            console.error('RULET4 scene failed:', cause)
            setStatus('error')
            propsRef.current.onReadyChange(false)
          },
        })
        sceneRef.current = controller
        setGeneration((value) => value + 1)
      } catch (cause) {
        if (cancelled) return
        console.error('RULET4 scene initialization failed:', cause)
        setStatus('error')
        propsRef.current.onReadyChange(false)
      }
    }
    void initialize()
    return () => {
      cancelled = true
      propsRef.current.onReadyChange(false)
      sceneRef.current = null
      activeRef.current = null
      controller?.dispose()
    }
  }, [segments, retry])

  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (!spin) {
      activeRef.current = null
      completedRef.current = null
      scene.reset()
    } else if (completed) {
      activeRef.current = spin
      completedRef.current = spin.id
      scene.showResult(spin.index)
    } else if (activeRef.current?.id !== spin.id) {
      activeRef.current = spin
      scene.spin(spin.index)
    }
  }, [spin, completed, generation])

  return (
    <div className="relative h-full w-full min-h-0">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={t('Ruleta de premios 3D', '3D prize wheel')}
        className="h-full w-full"
        style={{ opacity: dimmed ? 0.5 : 1 }}
      />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/75 p-4 text-center">
          {status === 'loading' ? (
            <p role="status">{t('Cargando ruleta 3D...', 'Loading 3D wheel...')}</p>
          ) : (
            <>
              <p role="alert">
                {status === 'lost'
                  ? t('Se ha perdido la conexión con la escena 3D. El giro se reanudará al recuperarla.', 'The 3D context was lost. The spin will resume when it recovers.')
                  : t('No se pudo mostrar la ruleta 3D. Este juego necesita WebGL 2. Tu premio pendiente se conserva.', 'The 3D wheel could not be displayed. This game requires WebGL 2. Any pending prize is preserved.')}
              </p>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="rounded-lg border border-primary/30 bg-primary/20 px-4 py-2 hover:bg-primary/30"
              >
                {t('Reintentar 3D', 'Retry 3D')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
