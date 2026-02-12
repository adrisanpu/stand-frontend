import React from 'react'

export interface GameScreenProps {
  gameId: string
  gameName: string
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
export interface GameTags {
  /** solo = individual, multi = multijugador */
  playerMode?: GamePlayerMode
  /** Implica socializar / conocer gente */
  social?: boolean
  /** Competitivo (ranking, puntuación) vs casual */
  competitive?: boolean
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

