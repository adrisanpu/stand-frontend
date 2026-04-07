import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type DebugState = {
  type: string
  key: string
  code: string
  keyCode: number
  click: boolean
  touch: boolean
  t: number
}

/** Por defecto activo (incl. GameScreen). Desactivar: VITE_INPUT_DEBUG=false o ?inputDebug=0 */
function inputDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    if (/\binputDebug=0\b/.test(window.location.search)) return false
    if (/\binputDebug=1\b/.test(window.location.search)) return true
  }
  const env = import.meta.env.VITE_INPUT_DEBUG as string | undefined
  if (env === 'false') return false
  if (env === 'true') return true
  return true
}

const OVERLAY_Z = 2147483000

/**
 * Overlay para validar en TV (SRS23CW): última tecla, code, keyCode y flags click/touch.
 * Activo por defecto; portal a document.body para que no quede detrás de juegos/modales.
 */
export default function InputDebugOverlay() {
  const [s, setS] = useState<DebugState | null>(null)
  const enabled = inputDebugEnabled()

  useEffect(() => {
    if (!enabled) return

    const patch = (partial: Partial<DebugState>) => {
      setS((prev) => ({
        type: partial.type ?? prev?.type ?? '',
        key: partial.key ?? prev?.key ?? '',
        code: partial.code ?? prev?.code ?? '',
        keyCode: partial.keyCode ?? prev?.keyCode ?? 0,
        click: partial.click ?? prev?.click ?? false,
        touch: partial.touch ?? prev?.touch ?? false,
        t: Date.now(),
      }))
    }

    const onKeyDown = (e: KeyboardEvent) => {
      patch({
        type: 'keydown',
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        click: false,
        touch: false,
      })
    }

    const onClick = () => {
      patch({ type: 'click', click: true })
    }

    const onTouchStart = () => {
      patch({ type: 'touchstart', touch: true })
    }

    const onTouchEnd = () => {
      patch({ type: 'touchend', touch: true })
    }

    const onPointerDown = (e: PointerEvent) => {
      patch({ type: `pointerdown:${e.pointerType}`, click: true })
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('click', onClick, true)
    window.addEventListener('touchstart', onTouchStart, true)
    window.addEventListener('touchend', onTouchEnd, true)
    window.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('touchstart', onTouchStart, true)
      window.removeEventListener('touchend', onTouchEnd, true)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [enabled])

  if (!enabled) return null

  const panelClass =
    'fixed bottom-2 left-2 max-w-[min(100vw-1rem,420px)] rounded-lg border border-white/20 bg-black/85 px-3 py-2 font-mono text-[11px] leading-snug pointer-events-none shadow-lg'

  const node = !s ? (
    <div className={`${panelClass} text-amber-200/90`} style={{ zIndex: OVERLAY_Z }} aria-hidden>
      Input debug activo — esperando eventos…
    </div>
  ) : (
    <div className={`${panelClass} text-green-300`} style={{ zIndex: OVERLAY_Z }} aria-hidden>
      <div className="text-white/60 text-[10px] uppercase tracking-wide mb-1">Input debug</div>
      <div>evt: {s.type}</div>
      <div>key: {s.key || '—'}</div>
      <div>code: {s.code || '—'}</div>
      <div>keyCode: {s.keyCode}</div>
      <div>
        click: {s.click ? 'yes' : 'no'} · touch: {s.touch ? 'yes' : 'no'}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
