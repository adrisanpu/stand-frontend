import React from 'react'
import type { GameAccess } from './settings/gameAccess'

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

/**
 * Save contract used by the shared "Configurar juego" footer.
 * `validate` runs before anything is persisted and returns an error message (or null).
 * `save` persists the game-specific rules and must reject with an Error on failure.
 */
export type GameConfigSaveRegistration = {
  validate?: () => string | null
  save: () => Promise<void>
}

export type GameConfigProps = {
  gameId: string | null
  gameName: string
  // generic configuration state for a given game instance
  settings: any
  /** The admin host already fetched this instance's settings from the server. */
  settingsLoaded?: boolean
  readOnly?: boolean
  onBusyChange?: (busy: boolean) => void
  onDirtyChange?: (dirty: boolean) => void
  onChange: (newSettings: any) => void
  /** Unsaved mechanics, emitted after load and on edits. Null means loading or unavailable. */
  onDraftChange?: (draft: Record<string, unknown> | null) => void
  /** Saved access, or the unsaved access draft when embedded in the shared config modal. */
  access?: GameAccess
  /**
   * When provided, the host owns the single save button: the component must not render its own
   * save button and must register its save handler instead (pass null on unmount).
   */
  registerSave?: (registration: GameConfigSaveRegistration | null) => void
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
  showRanking?: boolean // Whether this game should display the ranking component
  // NEW: optional per-game config component
  GameConfigComponent?: React.ComponentType<GameConfigProps>
}
