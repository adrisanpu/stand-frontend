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

  return null
}

function readOrientation(automatic: boolean): boolean {
  const forced = readForcedPortraitPreference()
  if (forced !== null) return forced
  return !automatic || window.innerWidth < 1024 || window.innerHeight < 600 || window.innerWidth <= window.innerHeight
}

/** Presentation screens default to portrait; automatic layouts opt in without overriding explicit preferences. */
export function useOrientation(automatic = false): boolean {
  const [isPortrait, setIsPortrait] = useState(() => {
    if (typeof window === 'undefined') return true
    return readOrientation(automatic)
  })

  useEffect(() => {
    const sync = () => setIsPortrait(readOrientation(automatic))
    const mql = window.matchMedia('(orientation: portrait)')
    sync()
    mql.addEventListener('change', sync)
    window.addEventListener('storage', sync)
    window.addEventListener('resize', sync)
    return () => {
      mql.removeEventListener('change', sync)
      window.removeEventListener('storage', sync)
      window.removeEventListener('resize', sync)
    }
  }, [automatic])

  useEffect(() => {
    document.documentElement.classList.toggle('force-portrait', isPortrait)
    document.documentElement.classList.toggle('force-landscape', !isPortrait)
  }, [isPortrait])

  return isPortrait
}
