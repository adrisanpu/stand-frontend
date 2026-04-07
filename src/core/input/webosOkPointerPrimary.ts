/**
 * En webOS, el OK del Magic Remote en modo puntero genera pointerdown:mouse en las coordenadas
 * del cursor en pantalla (no en el elemento con foco). No hay API web para reposicionar el cursor;
 * redirigimos esos clics “en vacío” al control principal del paso actual.
 */

export function isWebOSBrowser(): boolean {
  return typeof navigator !== 'undefined' && /web0s|webos|smarttv/i.test(navigator.userAgent || '')
}

/** ¿Este pointerdown debería tratarse como clic en `primary` en lugar del target real? */
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

/**
 * Último recurso: redirigir pointerdown aislados al CTA del juego.
 * Por defecto desactivado; activar con VITE_WEBOS_OK_HIJACK=true o ?webosOkHijack=1
 */
export function webosOkHijackEnabled(): boolean {
  if (typeof window !== 'undefined') {
    if (/\bwebosOkHijack=0\b/.test(window.location.search)) return false
    if (/\bwebosOkHijack=1\b/.test(window.location.search)) return true
  }
  return import.meta.env.VITE_WEBOS_OK_HIJACK === 'true'
}
