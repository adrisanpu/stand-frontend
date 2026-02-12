import { useState, useEffect } from 'react'

/**
 * Get the appropriate Stand logo based on theme mode
 */
export function getStandLogo(): string {
  const themeMode = localStorage.getItem('app_theme_mode')
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
      if (e.key === 'app_theme_mode') {
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

