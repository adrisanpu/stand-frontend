import type { GameAction, KeyMap } from './types'

const DEFAULT_KEY_MAP: KeyMap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  NumpadEnter: 'select',
  Escape: 'back',
}

const BACK_KEY_CODES = new Set([461])
const PAUSE_KEY_CODES = new Set([19])
/** webOS / TV remotes often send Enter/OK as keyCode 13 with empty or Unidentified `key`. */
const SELECT_KEY_CODES = new Set([13])

export function mapKeyboardEventToAction(event: KeyboardEvent, customMap?: KeyMap): GameAction | null {
  const mergedMap: KeyMap = { ...DEFAULT_KEY_MAP, ...(customMap || {}) }

  if (BACK_KEY_CODES.has(event.keyCode)) {
    return 'back'
  }
  if (PAUSE_KEY_CODES.has(event.keyCode)) {
    return 'pause'
  }

  if (event.key in mergedMap) {
    return mergedMap[event.key] || null
  }

  if (SELECT_KEY_CODES.has(event.keyCode)) {
    return 'select'
  }

  return null
}

