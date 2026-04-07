import type { GameAction, KeyMap, CodeMap, KeyCodeMap } from './types'

const DEFAULT_KEY_MAP: KeyMap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  NumpadEnter: 'select',
  Escape: 'back',
}

/** Flechas por `event.code` cuando `key` viene vacío o Unidentified (TV / webOS). */
const DEFAULT_CODE_MAP: CodeMap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  BrowserBack: 'back',
  GoBack: 'back',
}

const DEFAULT_KEY_CODE_MAP: KeyCodeMap = {
  461: 'back',
  19: 'pause',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
}

export type KeyboardMapOptions = {
  keyMap?: KeyMap
  codeMap?: CodeMap
  keyCodeMap?: KeyCodeMap
}

/**
 * Precedencia: keyCodeMap (461, pause, 37–40 + overrides) → key en keyMap → code en codeMap → keyCode 13 → select (OK webOS).
 */
export function mapKeyboardEventToAction(event: KeyboardEvent, opts?: KeyboardMapOptions): GameAction | null {
  const keyMap: KeyMap = { ...DEFAULT_KEY_MAP, ...(opts?.keyMap || {}) }
  const codeMap: CodeMap = { ...DEFAULT_CODE_MAP, ...(opts?.codeMap || {}) }
  const keyCodeMap: KeyCodeMap = { ...DEFAULT_KEY_CODE_MAP, ...(opts?.keyCodeMap || {}) }

  const fromKeyCode = keyCodeMap[event.keyCode]
  if (fromKeyCode) {
    return fromKeyCode
  }

  if (event.key in keyMap) {
    return keyMap[event.key] || null
  }

  if (event.code && event.code in codeMap) {
    return codeMap[event.code] || null
  }

  if (event.keyCode === 13) {
    return 'select'
  }

  return null
}
