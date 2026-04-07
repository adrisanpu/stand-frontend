import { mapKeyboardEventToAction } from './actionMapper'
import { detectWebOSCapabilities } from './webosCapabilities'
import type {
  ActionHandler,
  GameAction,
  InputContextId,
  InputEventEnvelope,
  InputManagerOptions,
  InputSource,
} from './types'

class InputManager {
  private handlers = new Map<GameAction, Set<ActionHandler>>()
  private started = false
  private enabled = true
  private contextId: InputContextId | null = null
  private options: Required<InputManagerOptions> = {
    preferExistingInputs: true,
    supportTouchMode: 'none',
    disableBackHistoryAPI: false,
  }
  private lastTouchTimestamp = 0

  start(options?: InputManagerOptions) {
    if (this.started) return
    this.options = {
      ...this.options,
      ...(options || {}),
    }
    this.started = true
    window.addEventListener('keydown', this.onKeyDown, { capture: true })
    window.addEventListener('click', this.onClick, { capture: true })
    window.addEventListener('pointerdown', this.onPointerDown, { capture: true })
    window.addEventListener('focus', this.onFocus)
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('cursorStateChange', this.onCursorStateChange as EventListener)
    window.addEventListener('keyboardStateChange', this.onKeyboardStateChange as EventListener)
    if (this.options.supportTouchMode === 'full') {
      window.addEventListener('touchstart', this.onTouchStart, { capture: true, passive: true })
      window.addEventListener('touchend', this.onTouchEnd, { capture: true })
    }
    if (!this.options.disableBackHistoryAPI) {
      window.addEventListener('popstate', this.onPopState)
    }
  }

  stop() {
    if (!this.started) return
    this.started = false
    window.removeEventListener('keydown', this.onKeyDown, { capture: true } as EventListenerOptions)
    window.removeEventListener('click', this.onClick, { capture: true } as EventListenerOptions)
    window.removeEventListener('pointerdown', this.onPointerDown, { capture: true } as EventListenerOptions)
    window.removeEventListener('focus', this.onFocus)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('cursorStateChange', this.onCursorStateChange as EventListener)
    window.removeEventListener('keyboardStateChange', this.onKeyboardStateChange as EventListener)
    window.removeEventListener('touchstart', this.onTouchStart, { capture: true } as EventListenerOptions)
    window.removeEventListener('touchend', this.onTouchEnd, { capture: true } as EventListenerOptions)
    window.removeEventListener('popstate', this.onPopState)
  }

  subscribe(action: GameAction, handler: ActionHandler): () => void {
    const set = this.handlers.get(action) || new Set<ActionHandler>()
    set.add(handler)
    this.handlers.set(action, set)
    return () => {
      set.delete(handler)
      if (set.size === 0) {
        this.handlers.delete(action)
      }
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  setContext(contextId: InputContextId | null) {
    this.contextId = contextId
  }

  private emit(action: GameAction, source: InputSource, nativeEvent: Event, partial?: Partial<InputEventEnvelope>) {
    if (!this.enabled) return
    const payload: InputEventEnvelope = {
      action,
      source,
      timestamp: Date.now(),
      contextId: this.contextId,
      key: partial?.key,
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
    const action = mapKeyboardEventToAction(event)
    if (!action) return
    const target = event.target as HTMLElement | null
    const isEditableTarget =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)

    if (isEditableTarget && action !== 'back') {
      return
    }

    if (action === 'back') {
      const capabilities = detectWebOSCapabilities(this.options.disableBackHistoryAPI, this.options.supportTouchMode)
      if (capabilities.backMode === 'manual' && event.keyCode === 461) {
        event.preventDefault()
      }
    } else if (action === 'up' || action === 'down' || action === 'left' || action === 'right' || action === 'select') {
      event.preventDefault()
    }

    this.emit(action, 'keyboard', event, { key: event.key, keyCode: event.keyCode })
  }

  private onClick = (event: MouseEvent) => {
    if (this.options.supportTouchMode === 'full' && Date.now() - this.lastTouchTimestamp < 500) {
      return
    }
    this.emit('click', 'pointer', event, { pointerType: 'mouse' })
  }

  private onPointerDown = (event: PointerEvent) => {
    this.emit('click', 'pointer', event, { pointerType: event.pointerType })
  }

  private onTouchStart = (event: TouchEvent) => {
    this.lastTouchTimestamp = Date.now()
    if (this.options.supportTouchMode !== 'full') return
    this.emit('click', 'touch', event, { pointerType: 'touch' })
  }

  private onTouchEnd = (event: TouchEvent) => {
    this.lastTouchTimestamp = Date.now()
    if (this.options.supportTouchMode !== 'full') return
    this.emit('select', 'touch', event, { pointerType: 'touch' })
  }

  private onPopState = (event: PopStateEvent) => {
    this.emit('back', 'system', event)
  }

  private onFocus = (event: FocusEvent) => {
    this.emit('pause', 'system', event)
  }

  private onBlur = (event: FocusEvent) => {
    this.emit('pause', 'system', event)
  }

  private onCursorStateChange = (event: Event) => {
    this.emit('pause', 'system', event)
  }

  private onKeyboardStateChange = (event: Event) => {
    this.emit('pause', 'system', event)
  }
}

export const inputManager = new InputManager()

