export type GameAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'pause'
  | 'click'

/**
 * Nombres abstractos → mismas cadenas que GameAction.
 * SRS23CW + táctil: el mando usa keydown → up/down/…/select/back; el táctil activa botones vía click nativo.
 * POINTER_CLICK (`click`) es opt-in (ratón/dev), no requisito en TV.
 */
export const InputAction = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  SELECT: 'select',
  BACK: 'back',
  PAUSE: 'pause',
  POINTER_CLICK: 'click',
} as const satisfies Record<string, GameAction>

export type InputSource =
  | 'keyboard'
  | 'remote'
  | 'pointer'
  | 'touch'
  | 'system'

export type BackMode = 'history' | 'manual'
export type TouchMode = 'none' | 'full' | 'virtual'

export type InputContextId = string

export type InputEventEnvelope = {
  action: GameAction
  source: InputSource
  timestamp: number
  contextId: InputContextId | null
  key?: string
  code?: string
  keyCode?: number
  pointerType?: string
  target: EventTarget | null
  nativeEvent: Event
}

export type ActionHandler = (payload: InputEventEnvelope) => void

export type KeyMap = Partial<Record<string, GameAction>>
export type CodeMap = Partial<Record<string, GameAction>>
export type KeyCodeMap = Partial<Record<number, GameAction>>

export type InputManagerOptions = {
  preferExistingInputs?: boolean
  supportTouchMode?: TouchMode
  disableBackHistoryAPI?: boolean
  /** Ratón/puntero: en webOS suele ir en false (solo mando + táctil). */
  enablePointerEvents?: boolean
  keyMap?: KeyMap
  codeMap?: CodeMap
  keyCodeMap?: KeyCodeMap
}
