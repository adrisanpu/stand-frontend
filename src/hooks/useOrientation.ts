import { useEffect, useState } from 'react'

function readForcedPortraitPreference(): boolean | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  const forcedParam = params.get('portrait') ?? params.get('forcePortrait')
  if (forcedParam === '0' || forcedParam === 'false' || forcedParam === 'off') {
    localStorage.setItem('stand.forcePortrait', '0')
    return false
  }
  if (forcedParam === '1' || forcedParam === 'true' || forcedParam === 'on' || forcedParam === 'portrait') {
    localStorage.setItem('stand.forcePortrait', '1')
    return true
  }

  const stored = localStorage.getItem('stand.forcePortrait')
  if (stored === '0') return false
  if (stored === '1') return true

  return true
}

/**
 * Default to portrait for display devices used in presentation mode. This keeps the Stand UI
 * consistent on vertical screens even when the physical monitor is connected in landscape.
 */
export function useOrientation(): boolean {
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return true
    return readForcedPortraitPreference() ?? true
  })

  useEffect(() => {
    const sync = () => setIsPortrait(readForcedPortraitPreference() ?? true)
    const mql = window.matchMedia('(orientation: portrait)')
    sync()
    mql.addEventListener('change', sync)
    window.addEventListener('storage', sync)
    return () => {
      mql.removeEventListener('change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('force-portrait', isPortrait)
    document.documentElement.classList.toggle('force-landscape', !isPortrait)
  }, [isPortrait])

  return isPortrait
}
