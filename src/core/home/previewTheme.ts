import type { CSSProperties } from 'react'
import type { GameDefinition } from '../types'
import type { ParticipantAppearance } from '../theme/appearance'

export function homePreviewTheme(game: GameDefinition | undefined, appearance: ParticipantAppearance | null): CSSProperties {
  const light = appearance?.themeMode === 'light'
  const primary = appearance?.colors?.primary ?? game?.colors.primary ?? '#9CA3AF'
  const accent = appearance?.colors?.accent ?? game?.colors.accent ?? '#D1D5DB'
  const rgb = (hex: string) => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(',')
  return {
    '--color-primary': primary,
    '--color-accent': accent,
    '--color-primary-rgb': rgb(primary),
    '--color-accent-rgb': rgb(accent),
    '--color-background': light ? '#F5F5F7' : game?.colors.background ?? '#0B0A12',
    '--color-surface': light ? '#FFFFFF' : game?.colors.surface ?? 'rgba(255,255,255,0.04)',
    '--color-text-main': light ? '#0F172A' : game?.colors.textMain ?? '#EAEAF2',
    '--color-text-sub': light ? '#475569' : game?.colors.textSub ?? '#9AA0A6',
    '--color-border-gradient-1': `rgba(${rgb(primary)},0.65)`,
    '--color-border-gradient-2': `rgba(${rgb(accent)},0.65)`,
    color: 'var(--color-text-main)',
  } as CSSProperties
}
