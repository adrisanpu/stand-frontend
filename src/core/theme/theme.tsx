import { useEffect, useState, createContext, useContext, ReactNode } from 'react'
import type { GameDefinition, ThemeColors } from '../types'
import { STORAGE_KEY_COLORS, STORAGE_KEY_THEME_MODE } from '../storageKeys'
import type { ParticipantAppearance } from './appearance'

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

export type ParticipantPalette = { dark: boolean; variables: Record<string, string> }

/** Resolves the participant theme exactly as ThemeProvider applies it, without touching the document. */
export function resolveParticipantPalette(game: Pick<GameDefinition, 'colors'> | null, appearance?: ParticipantAppearance | null,
  saved: { colors?: ThemeColors | null; themeMode?: string | null } = {}): ParticipantPalette {
  const isDarkMode = (appearance?.themeMode ?? saved.themeMode) !== 'light'
  const customColors = appearance ? null : saved.colors ?? null
  let colors = customColors || (game ?? { colors: DEFAULT_STAND_PALETTE }).colors

  if (!customColors && !isDarkMode) {
    colors = {
      ...colors,
      background: '#F5F5F7',
      surface: '#FFFFFF',
      textMain: '#0F172A',
      textSub: '#475569',
    }
  }

  if (customColors && !isDarkMode) {
    if (colors.surface === 'rgba(255,255,255,0.04)' || colors.surface === 'rgba(0,0,0,0.04)') {
      colors = { ...colors, surface: '#FFFFFF' }
    }
    if (colors.textMain === '#EAEAF2' || colors.textMain === '#1D1D1F') {
      colors = { ...colors, textMain: '#0F172A', textSub: '#475569' }
    }
  }

  if (appearance?.colors) colors = { ...colors, ...appearance.colors }

  const primaryRgb = hexToRgb(colors.primary) || { r: 176, g: 38, b: 255 }
  const accentRgb = hexToRgb(colors.accent) || { r: 34, g: 211, b: 238 }
  const primary = `${primaryRgb.r},${primaryRgb.g},${primaryRgb.b}`
  const accent = `${accentRgb.r},${accentRgb.g},${accentRgb.b}`
  return {
    dark: isDarkMode,
    variables: {
      '--color-primary': colors.primary,
      '--color-accent': colors.accent,
      '--color-background': colors.background,
      '--color-surface': colors.surface,
      '--color-text-main': colors.textMain,
      '--color-text-sub': colors.textSub,
      '--color-primary-rgb': primary,
      '--color-accent-rgb': accent,
      '--color-primary-gradient-1': `rgba(${primary},0.18)`,
      '--color-primary-gradient-2': `rgba(${primary},0.10)`,
      '--color-accent-gradient': `rgba(${accent},0.16)`,
      '--color-border-gradient-1': `rgba(${primary},0.65)`,
      '--color-border-gradient-2': `rgba(${accent},0.65)`,
    },
  }
}

export function ThemeProvider({
  game,
  appearance,
  children
}: {
  game: GameDefinition | null
  appearance?: ParticipantAppearance
  children: ReactNode
}) {
  const [themeRevision, setThemeRevision] = useState(0)

  useEffect(() => {
    const updateTheme = () => setThemeRevision(revision => revision + 1)
    window.addEventListener('app-theme-mode-changed', updateTheme)
    return () => window.removeEventListener('app-theme-mode-changed', updateTheme)
  }, [])

  useEffect(() => {
    let customColors: ThemeColors | null = null
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLORS)
      if (saved) customColors = JSON.parse(saved) as ThemeColors
    } catch {
      // Invalid saved data, ignore
    }
    const palette = resolveParticipantPalette(game, appearance,
      { colors: customColors, themeMode: localStorage.getItem(STORAGE_KEY_THEME_MODE) })
    const root = document.documentElement
    for (const [name, value] of Object.entries(palette.variables)) root.style.setProperty(name, value)
    root.classList.toggle('light-mode', !palette.dark)
    root.classList.toggle('dark-mode', palette.dark)
  }, [game, appearance, themeRevision])

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
