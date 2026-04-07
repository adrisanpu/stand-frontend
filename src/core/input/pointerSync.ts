/**
 * Emite pointer/mouse en el centro del elemento (coordenadas de viewport).
 * En algunos navegadores de TV el puntero mágico o el hover siguen la última posición lógica;
 * en escritorio no mueve el cursor real (limitación del navegador).
 */
export function syncPointerToElement(el: HTMLElement | null): void {
  if (!el || typeof window === 'undefined') return
  const r = el.getBoundingClientRect()
  if (r.width <= 0 && r.height <= 0) return
  const cx = Math.round(r.left + r.width / 2)
  const cy = Math.round(r.top + r.height / 2)
  const base = { clientX: cx, clientY: cy, bubbles: true, cancelable: true, view: window }

  try {
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        ...base,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      })
    )
  } catch {
    /* PointerEvent opcional en motores antiguos */
  }

  try {
    window.dispatchEvent(new MouseEvent('mousemove', base))
    window.dispatchEvent(new MouseEvent('mouseover', base))
  } catch {
    /* ignore */
  }
}
