import React from 'react'

export interface GameScreenProps {
  gameId: string
  /** When 'landscape', the game may render a 3-column layout (logo+code+QR | validation+animation | sidebar) */
  orientation?: 'portrait' | 'landscape'
  /** For landscape: node to place in column 1 (e.g. logo) */
  logoElement?: React.ReactNode
  /** For landscape: node to place in column 3 (e.g. Players, Ranking, RaffleData) */
  sidebarElement?: React.ReactNode
  /** Optional: top X positions that get a prize (e.g. 3); used to show "Premio por top X" in result screen */
  topX?: number
  /** Optional: label for the prize (e.g. "Merchandising"); shown when player ranks in top X */
  prizeLabel?: string
  /** When the in-game counter/timer is running, call with true to pause API polling (score, ranking, game) and avoid lag */
  onCounterActiveChange?: (active: boolean) => void
}

export interface ThemeColors {
  primary: string
  accent: string
  background: string
  surface: string
  textMain: string
  textSub: string
}

export interface GameAssets {
  logo?: string
  clientLogo?: string
  standLogo?: string
  backgroundImage?: string
}

export type GameConfigProps = {
  gameId: string | null
  gameName: string
  // generic configuration state for a given game instance
  settings: any
  onChange: (newSettings: any) => void
}

/** Game display tags for catalog / create-join view */
export type GamePlayerMode = 'solo' | 'multi'

/** Context/venue the game is ideal for */
export type GameIdealFor = 'fiesta' | 'stand_feria' | 'evento_corporativo' | 'presentacion'

export const IDEAL_FOR_LABELS: Record<GameIdealFor, string> = {
  fiesta: 'Fiesta',
  stand_feria: 'Stand de feria',
  evento_corporativo: 'Evento corporativo',
  presentacion: 'Presentación / demo',
}

export interface GameTags {
  /** solo = individual, multi = multijugador */
  playerMode?: GamePlayerMode
  /** Implica socializar / conocer gente */
  social?: boolean
  /** Competitivo (ranking, puntuación) vs casual */
  competitive?: boolean
  /** Contexts/venues this game is ideal for */
  idealFor?: GameIdealFor[]
}

export interface GameDefinition {
  id: string
  name: string
  description?: string
  /** Extended description for create/join view */
  descriptionLong?: string
  /** Tags shown as icons in create/join view */
  tags?: GameTags
  /** If true, user cannot create a game (under development) */
  underDevelopment?: boolean
  colors: ThemeColors
  assets?: GameAssets
  GameScreen: React.ComponentType<GameScreenProps>
  showRanking?: boolean // Whether this game should display the ranking component
  // NEW: optional per-game config component
  GameConfigComponent?: React.ComponentType<GameConfigProps>
}

