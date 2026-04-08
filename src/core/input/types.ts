/** Entradas que los juegos pueden suscribir vía `useGameInput` (LG Swing: PageUp / PageDown / click). */
export type GameAction = 'up' | 'down' | 'click'

export type InputContextId = string

export type InputEventEnvelope = {
  action: GameAction
  source: 'keyboard' | 'remote' | 'pointer' | 'touch' | 'system'
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
