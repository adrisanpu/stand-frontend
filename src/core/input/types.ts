export type GameAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'pause'
  | 'click'

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
  keyCode?: number
  pointerType?: string
  target: EventTarget | null
  nativeEvent: Event
}

export type ActionHandler = (payload: InputEventEnvelope) => void

export type InputManagerOptions = {
  preferExistingInputs?: boolean
  supportTouchMode?: TouchMode
  disableBackHistoryAPI?: boolean
}

export type KeyMap = Partial<Record<string, GameAction>>

