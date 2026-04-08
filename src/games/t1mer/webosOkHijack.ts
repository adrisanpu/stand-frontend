/**
 * webOS Magic Remote (modo puntero): OK → pointerdown:mouse en el cursor, no en el foco.
 * Redirigimos clics “en vacío” al CTA del paso actual.
 */

export function isWebOSBrowser(): boolean {
  return typeof navigator !== 'undefined' && /web0s|webos|smarttv/i.test(navigator.userAgent || '')
}

export function shouldHijackOkPointerToPrimary(target: EventTarget | null, primary: HTMLElement): boolean {
  if (!target || !(target instanceof Node)) return false
  if (primary.contains(target)) return false
  const el = target instanceof Element ? target : target.parentElement
  if (!el) return true
  const other = el.closest(
    'button, a[href], input, textarea, select, [role="button"], [contenteditable="true"]'
  )
  if (other instanceof HTMLElement && !primary.contains(other)) return false
  return true
}

/** Activo por defecto. Apagar: VITE_WEBOS_OK_HIJACK=false o ?webosOkHijack=0 */
export function webosOkHijackEnabled(): boolean {
  if (typeof window !== 'undefined' && /\bwebosOkHijack=0\b/.test(window.location.search)) {
    return false
  }
  return import.meta.env.VITE_WEBOS_OK_HIJACK !== 'false'
}
