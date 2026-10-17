import type { ThemeColors } from '../types'

export type ParticipantAppearance = {
  colors: Pick<ThemeColors, 'primary' | 'accent'> | null
  themeMode: 'dark' | 'light'
}
