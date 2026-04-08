import { useEffect, useRef } from 'react'
import {
  isWebOSBrowser,
  webOsPointerPrimaryEnabled,
  shouldRedirectWebOsPointerPrimary,
  type WebOsPointerPrimaryTarget,
} from './webosPointerPrimary'

export type WebOsPointerPrimaryResolver = () => WebOsPointerPrimaryTarget | null

/**
 * Registra un listener de captura en `pointerdown` (solo webOS, puntero tipo mouse).
 * Cada juego implementa `resolve` para devolver el CTA actual + acción, o `null` para no interceptar.
 */
export function useWebOsPointerPrimary(resolve: WebOsPointerPrimaryResolver): void {
  const resolveRef = useRef(resolve)
  resolveRef.current = resolve

  useEffect(() => {
    if (!isWebOSBrowser() || !webOsPointerPrimaryEnabled()) return

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      const r = resolveRef.current()
      if (!r) return
      if (!shouldRedirectWebOsPointerPrimary(e.target, r.primary)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      r.activate()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])
}
