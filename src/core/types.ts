import React from 'react'
import type { GameAccess, PlayMode } from './settings/gameAccess'
import type { PrizeCatalog } from './prizes'

export interface GameScreenProps {
  gameId: string
  /** When 'landscape', the game may render a 3-column layout (logo+code+QR | validation+animation | sidebar) */
  orientation?: 'portrait' | 'landscape'
  /** For landscape: node to place in column 1 (e.g. logo) */
  logoElement?: React.ReactNode
  /** For landscape: node to place in column 1 below the info panel (e.g. Players) */
  playersElement?: React.ReactNode
  /** For landscape: node to place in column 3 (Ranking, RaffleData, avatar fallback) */
  sidebarElement?: React.ReactNode
  /** Optional: top X positions that get a prize (e.g. 3); used to show "Premio por top X" in result screen */
  topX?: number
  /** Optional: label for the prize (e.g. "Merchandising"); shown when player ranks in top X */
  prizeLabel?: string
  prizeCatalog?: PrizeCatalog
  /** When the in-game counter/timer is running, call with true to pause API polling (score, ranking, game) and avoid lag */
  onCounterActiveChange?: (active: boolean) => void
  /** Optional: report current avatar state so shell widgets can render synced animations */
  onAvatarStateChange?: (state: string) => void
  /** Optional: presigned avatar video URLs per state (used by games that embed GameStateAvatar) */
  avatarMediaUrls?: Partial<Record<'idle' | 'win' | 'lose', string | null>>
  /** Participant registration channel, independent of where gameplay runs. */
  joinChannel?: string | null
  playMode?: PlayMode
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
  onChange: (newSettings: any) => void
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
  GameScreen: React.ComponentType<GameScreenProps>
  showRanking?: boolean // Whether this game should display the ranking component
  // NEW: optional per-game config component
  GameConfigComponent?: React.ComponentType<GameConfigProps>
}
