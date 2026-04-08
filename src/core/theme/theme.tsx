import { useEffect, createContext, useContext, ReactNode } from 'react'
import type { GameDefinition, ThemeColors } from '../types'
import { STORAGE_KEY_COLORS, STORAGE_KEY_THEME_MODE } from '../storageKeys'

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

// Default Stand palette (used when no game is selected)
const DEFAULT_STAND_PALETTE: ThemeColors = {
  primary: '#9CA3AF',
  accent: '#D1D5DB',
  background: '#0B0A12',
  surface: 'rgba(255,255,255,0.04)',
  textMain: '#EAEAF2',
  textSub: '#9AA0A6',
}

export function ThemeProvider({
  game,
  children
}: {
  game: GameDefinition | null
  children: ReactNode
}) {
  useEffect(() => {
    // Check for custom color palette in localStorage
    let customColors: ThemeColors | null = null
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLORS)
      if (saved) {
        customColors = JSON.parse(saved) as ThemeColors
      }
    } catch {
      // Invalid saved data, ignore
    }

    // Check for theme mode (dark/light)
    const savedThemeMode = localStorage.getItem(STORAGE_KEY_THEME_MODE)
    const isDarkMode = savedThemeMode !== 'light'

    // Always apply theme - if no game, use default gray theme
    // But prioritize custom colors if they exist
    const defaultTheme = {
      id: 'default',
      name: 'Stand',
      colors: DEFAULT_STAND_PALETTE,
      GameScreen: () => null,
    }

    const themeToApply = game || defaultTheme
    let colors = customColors || themeToApply.colors

    // If using default palette (not custom), adjust background colors based on theme mode
    if (!customColors && !isDarkMode) {
      // Apply light mode colors to default palette
      colors = {
        ...colors,
        background: '#F5F5F7',
        surface: '#FFFFFF', // Solid white for better card visibility
        textMain: '#0F172A', // Darker for better readability (slate-900)
        textSub: '#475569', // Darker gray for better contrast (slate-600)
      }
    }

    // If using custom colors in light mode, ensure surface is visible and text is dark
    if (customColors && !isDarkMode) {
      // Check if surface is transparent (dark mode style)
      if (colors.surface === 'rgba(255,255,255,0.04)' || colors.surface === 'rgba(0,0,0,0.04)') {
        colors = {
          ...colors,
          surface: '#FFFFFF', // Override transparent surface with solid white
        }
      }
      // Ensure text colors are dark enough for light mode
      if (colors.textMain === '#EAEAF2' || colors.textMain === '#1D1D1F') {
        colors = {
          ...colors,
          textMain: '#0F172A', // Very dark for better readability
          textSub: '#475569', // Dark gray for good contrast
        }
      }
    }

    const root = document.documentElement

    // Apply CSS variables
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-accent', colors.accent)
    root.style.setProperty('--color-background', colors.background)
    root.style.setProperty('--color-surface', colors.surface)
    root.style.setProperty('--color-text-main', colors.textMain)
    root.style.setProperty('--color-text-sub', colors.textSub)

    // Apply theme mode class to html element
    if (isDarkMode) {
      document.documentElement.classList.remove('light-mode')
      document.documentElement.classList.add('dark-mode')
    } else {
      document.documentElement.classList.remove('dark-mode')
      document.documentElement.classList.add('light-mode')
    }

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
