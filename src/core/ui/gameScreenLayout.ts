/**
 * Layout tokens for GameScreen (landscape/portrait). Reference: t1mer.
 * See docs/operator-game-ui.md (layout + spacing).
 */

/** Three columns: info + QR | main game | sidebar (ranking, players, …). */
export const GAME_LANDSCAPE_THREE_COL_GRID =
  'grid grid-cols-[25%_40%_25%] gap-4 items-stretch h-full min-h-0'

/** Central card in landscape; append game-specific utilities (e.g. items-center, justify-center). */
export const GAME_LANDSCAPE_CENTER_CARD =
  'card flex flex-col p-6 sm:p-8 overflow-hidden min-h-0 min-w-0 space-y-6'

/** Portrait: QR block + instructions row (matches t1mer). */
export const GAME_PORTRAIT_QR_INSTRUCTIONS_GRID =
  'flex-shrink-0 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4'

/** Landscape: main + narrow sidebar only (e.g. infocards). Same gutter as three-col grid. */
export const GAME_LANDSCAPE_TWO_COL_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(180px,260px)] gap-4 items-stretch h-full min-h-0 w-full'
