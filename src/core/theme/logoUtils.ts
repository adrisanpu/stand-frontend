import { useState, useEffect } from 'react'
import { STORAGE_KEY_AVATARS_ENABLED, STORAGE_KEY_THEME_MODE } from '../storageKeys'

/**
 * Get the appropriate Stand logo based on theme mode
 */
export function getStandLogo(): string {
  const themeMode = localStorage.getItem(STORAGE_KEY_THEME_MODE)
  const isDarkMode = themeMode !== 'light'

  return isDarkMode
    ? '/images/logo_stand_letters_white.png'
    : '/images/logo_stand_letters_black.png'
}

/**
 * Hook to get Stand logo that updates when theme changes
 */
export function useStandLogo(): string {
  const [logo, setLogo] = useState<string>(getStandLogo())

  useEffect(() => {
    // Update logo when theme changes
    const updateLogo = () => {
      setLogo(getStandLogo())
    }

    // Check for theme changes periodically (simple approach for MVP)
    const interval = setInterval(updateLogo, 500)

    // Also listen to storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_THEME_MODE) {
        updateLogo()
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return logo
}

/** True when aspecto is oscuro (dark), false for claro (light). Updates when `STORAGE_KEY_THEME_MODE` changes. */
export function useAppThemeIsDark(): boolean {
  const [isDark, setIsDark] = useState(() => localStorage.getItem(STORAGE_KEY_THEME_MODE) !== 'light')

  useEffect(() => {
    const update = () => setIsDark(localStorage.getItem(STORAGE_KEY_THEME_MODE) !== 'light')
    const interval = setInterval(update, 500)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_THEME_MODE) update()
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return isDark
}

/** True when operator avatar videos should render on game screens (default: enabled). */
export function getAvatarsEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEY_AVATARS_ENABLED) !== 'false'
}

/** Updates when `STORAGE_KEY_AVATARS_ENABLED` changes. */
export function useAvatarsEnabled(): boolean {
  const [enabled, setEnabled] = useState(getAvatarsEnabled)

  useEffect(() => {
    const update = () => setEnabled(getAvatarsEnabled())
    const interval = setInterval(update, 500)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_AVATARS_ENABLED) update()
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return enabled
}
