import { useEffect, useState } from 'react'

/**
 * Returns true when the viewport is in portrait orientation (height > width).
 * Subscribes to orientation changes so the layout updates when the device is rotated.
 * Uses the standard (orientation: portrait) media query (works in modern browsers and WebOS).
 */
export function useOrientation(): boolean {
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(orientation: portrait)').matches
  })

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    const handler = () => setIsPortrait(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isPortrait
}
