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

export interface GameDefinition {
  id: string
  name: string
  description?: string
  colors: ThemeColors
  assets?: GameAssets
  GameScreen: React.ComponentType<GameScreenProps>
  showRanking?: boolean // Whether this game should display the ranking component
}

