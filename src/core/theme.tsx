import { useEffect, createContext, useContext, ReactNode } from 'react'
import type { GameDefinition } from './types'

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

interface ThemeContextType {
  game: GameDefinition | null
}

const ThemeContext = createContext<ThemeContextType>({ game: null })

export function ThemeProvider({ 
  game, 
  children 
}: { 
  game: GameDefinition | null
  children: ReactNode 
}) {
  useEffect(() => {
    // Always apply theme - if no game, use default gray theme
    const themeToApply = game || {
      id: 'default',
      name: 'Stand',
      colors: {
        primary: '#9CA3AF',  // gray-400 - nice medium gray
        accent: '#D1D5DB',   // gray-300 - lighter gray for accent
        background: '#0B0A12',
        surface: 'rgba(255,255,255,0.04)',
        textMain: '#EAEAF2',
        textSub: '#9AA0A6',
      },
      GameScreen: () => null,
    }

    const root = document.documentElement
    const { colors } = themeToApply

    // Apply CSS variables
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--color-background', colors.background)
    root.style.setProperty('--color-surface', colors.surface)
    root.style.setProperty('--color-text-main', colors.textMain)
    root.style.setProperty('--color-text-sub', colors.textSub)
    
    // Extract RGB values for gradient backgrounds
    const primaryRgb = hexToRgb(colors.primary) || { r: 176, g: 38, b: 255 }
    const accentRgb = hexToRgb(colors.accent) || { r: 34, g: 211, b: 238 }
    
    // Apply RGB values for use in CSS rgba() functions
    root.style.setProperty('--color-primary-rgb', `${primaryRgb.r},${primaryRgb.g},${primaryRgb.b}`)
    root.style.setProperty('--color-accent-rgb', `${accentRgb.r},${accentRgb.g},${accentRgb.b}`)
    
    // Apply pre-computed rgba values for gradients (for better browser compatibility)
    root.style.setProperty('--color-primary-gradient-1', `rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.18)`)
    root.style.setProperty('--color-primary-gradient-2', `rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.10)`)
    root.style.setProperty('--color-accent-gradient', `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.16)`)
    root.style.setProperty('--color-border-gradient-1', `rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.65)`)
    root.style.setProperty('--color-border-gradient-2', `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.65)`)
  }, [game])

  return (
    <ThemeContext.Provider value={{ game }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

