import { isWebOSBrowser } from './webosOkPointerPrimary'

let started = false

/**
 * Magic Remote: al pasar el puntero sobre controles, alinear foco DOM (recomendación LG).
 * No roba foco si el usuario está escribiendo en input/textarea/select salvo que el hover sea dentro de ese control.
 * Desactivar: VITE_WEBOS_POINTER_FOCUS_SYNC=false
 */
export function startWebOSPointerFocusSync(): void {
  if (started) return
  if (!isWebOSBrowser()) return
  if (import.meta.env.VITE_WEBOS_POINTER_FOCUS_SYNC === 'false') return

  started = true

  const onMouseOver = (e: MouseEvent) => {
    const t = e.target
    if (!(t instanceof Node)) return

    const active = document.activeElement
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement
    ) {
      if (!active.contains(t) && t !== active) return
    }

    const el = t instanceof Element ? t : t.parentElement
    if (!el) return

    const focusable = el.closest<HTMLElement>(
      'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable) return
    if (focusable.hasAttribute('disabled')) return
    if (focusable === active) return

    try {
      focusable.focus({ preventScroll: true })
    } catch {
      focusable.focus()
    }
  }

  document.addEventListener('mouseover', onMouseOver, true)
}
