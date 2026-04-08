/**
 * webOS Magic Remote en modo puntero: OK genera pointerdown en el cursor, no mueve el foco D-pad.
 * Si el usuario pulsa “en vacío”, podemos redirigir la acción al CTA principal del paso actual.
 */

export function isWebOSBrowser(): boolean {
  return typeof navigator !== 'undefined' && /web0s|webos|smarttv/i.test(navigator.userAgent || '')
}

/** Activo por defecto. Apagar: VITE_WEBOS_OK_HIJACK=false o ?webosOkHijack=0 */
export function webOsPointerPrimaryEnabled(): boolean {
  if (typeof window !== 'undefined' && /\bwebosOkHijack=0\b/.test(window.location.search)) {
    return false
  }
  return import.meta.env.VITE_WEBOS_OK_HIJACK !== 'false'
}

/** @deprecated use webOsPointerPrimaryEnabled */
export const webosOkHijackEnabled = webOsPointerPrimaryEnabled

export type WebOsPointerPrimaryTarget = {
  primary: HTMLElement
  activate: () => void
}

/**
 * true si debemos tratar el pointerdown como “confirmar CTA”: el hit no está ya en el primary
 * ni en otro control interactivo que deba recibir el evento.
 */
export function shouldRedirectWebOsPointerPrimary(
  target: EventTarget | null,
  primary: HTMLElement
): boolean {
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

/** @deprecated use shouldRedirectWebOsPointerPrimary */
export const shouldHijackOkPointerToPrimary = shouldRedirectWebOsPointerPrimary
