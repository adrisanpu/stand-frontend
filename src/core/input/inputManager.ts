import type { ActionHandler, GameAction, InputContextId, InputEventEnvelope } from './types'

type InputSource = InputEventEnvelope['source']

function isWebOSUA(): boolean {
  return typeof navigator !== 'undefined' && /web0s|webos|smarttv/i.test(navigator.userAgent || '')
}

/** Tecla atrás del SO / mando (no es acción de juego; solo dispara interceptores). */
function isSystemBackKeyboardEvent(event: KeyboardEvent): boolean {
  if (event.code === 'BrowserBack' || event.code === 'GoBack') return true
  return event.keyCode === 461 || event.keyCode === 10009
}

function mapPageKeyToGameAction(event: KeyboardEvent): 'up' | 'down' | null {
  if (event.keyCode === 33 || event.key === 'PageUp') return 'up'
  if (event.keyCode === 34 || event.key === 'PageDown') return 'down'
  if (event.code === 'PageUp') return 'up'
  if (event.code === 'PageDown') return 'down'
  return null
}

export type InputManagerOptions = {
  disableBackHistoryAPI?: boolean
  enablePointerEvents?: boolean
}

type BackInterceptor = (event: KeyboardEvent) => boolean

class InputManager {
  private handlers = new Map<GameAction, Set<ActionHandler>>()
  private backInterceptors: BackInterceptor[] = []
  private started = false
  private enabled = true
  private contextId: InputContextId | null = null
  private options: Required<Pick<InputManagerOptions, 'disableBackHistoryAPI' | 'enablePointerEvents'>> = {
    disableBackHistoryAPI: false,
    enablePointerEvents: true,
  }
  private lastEmittedClickAt = 0
  private lastEmittedClickKey = ''

  start(options?: InputManagerOptions) {
    if (this.started) return
    this.options = { ...this.options, ...(options || {}) }
    this.started = true
    window.addEventListener('keydown', this.onKeyDown, { capture: true })
    if (this.options.enablePointerEvents) {
      window.addEventListener('click', this.onClick, { capture: true })
    }
  }

  stop() {
    if (!this.started) return
    this.started = false
    window.removeEventListener('keydown', this.onKeyDown, { capture: true } as EventListenerOptions)
    window.removeEventListener('click', this.onClick, { capture: true } as EventListenerOptions)
  }

  registerBackInterceptor(handler: BackInterceptor): () => void {
    this.backInterceptors.push(handler)
    return () => {
      const i = this.backInterceptors.indexOf(handler)
      if (i >= 0) this.backInterceptors.splice(i, 1)
    }
  }

  subscribe(action: GameAction, handler: ActionHandler): () => void {
    const set = this.handlers.get(action) || new Set<ActionHandler>()
    set.add(handler)
    this.handlers.set(action, set)
    return () => {
      set.delete(handler)
      if (set.size === 0) this.handlers.delete(action)
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  setContext(contextId: InputContextId | null) {
    this.contextId = contextId
  }

  private keyboardSource(): InputSource {
    return isWebOSUA() ? 'remote' : 'keyboard'
  }

  private emit(action: GameAction, source: InputSource, nativeEvent: Event, partial?: Partial<InputEventEnvelope>) {
    if (!this.enabled) return
    const payload: InputEventEnvelope = {
      action,
      source,
      timestamp: Date.now(),
      contextId: this.contextId,
      key: partial?.key,
      code: partial?.code,
      keyCode: partial?.keyCode,
      pointerType: partial?.pointerType,
      target: partial?.target ?? nativeEvent.target,
      nativeEvent,
    }
    const actionHandlers = this.handlers.get(action)
    if (!actionHandlers) return
    actionHandlers.forEach((handler) => handler(payload))
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    const isEditableTarget =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)

    if (isSystemBackKeyboardEvent(event)) {
      if (isEditableTarget) return
      for (let i = this.backInterceptors.length - 1; i >= 0; i--) {
        if (this.backInterceptors[i](event)) {
          event.preventDefault()
          return
        }
      }
      if (this.options.disableBackHistoryAPI && event.keyCode === 461) {
        event.preventDefault()
      }
      return
    }

    const action = mapPageKeyToGameAction(event)
    if (!action) return
    if (isEditableTarget) return

    event.preventDefault()
    this.emit(action, this.keyboardSource(), event, {
      key: event.key,
      code: event.code,
      keyCode: event.keyCode,
    })
  }

  private clickDedupeKey(ev: MouseEvent): string {
    const t = ev.target as Node | null
    return `${t?.nodeName || ''}:${ev.clientX}:${ev.clientY}`
  }

  private onClick = (event: MouseEvent) => {
    if (!this.options.enablePointerEvents) return
    const now = Date.now()
    const key = this.clickDedupeKey(event)
    if (now - this.lastEmittedClickAt < 400 && key === this.lastEmittedClickKey) return
    this.lastEmittedClickAt = now
    this.lastEmittedClickKey = key
    const pointerType = event.detail === 0 ? 'touch-synthetic' : 'mouse'
    this.emit('click', 'pointer', event, { pointerType })
  }
}

export const inputManager = new InputManager()
