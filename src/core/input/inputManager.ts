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

type BackInterceptor = (event: KeyboardEvent) => boolean

class InputManager {
  private handlers = new Map<GameAction, Set<ActionHandler>>()
  private backInterceptors: BackInterceptor[] = []
  private started = false
  private enabled = true
  private contextId: InputContextId | null = null
  private options: Required<
    Pick<InputManagerOptions, 'preferExistingInputs' | 'supportTouchMode' | 'disableBackHistoryAPI' | 'enablePointerEvents'>
  > &
    Pick<InputManagerOptions, 'keyMap' | 'codeMap' | 'keyCodeMap'> = {
    preferExistingInputs: true,
    supportTouchMode: 'none',
    disableBackHistoryAPI: false,
    enablePointerEvents: true,
    keyMap: undefined,
    codeMap: undefined,
    keyCodeMap: undefined,
  }
  private lastEmittedClickAt = 0
  private lastEmittedClickKey = ''

  start(options?: InputManagerOptions) {
    if (this.started) return
    this.options = {
      ...this.options,
      ...(options || {}),
    }
    this.started = true
    window.addEventListener('keydown', this.onKeyDown, { capture: true })
    if (this.options.enablePointerEvents) {
      window.addEventListener('click', this.onClick, { capture: true })
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
    window.removeEventListener('popstate', this.onPopState)
  }

  /**
   * LIFO: el último registrado se ejecuta primero (p. ej. SettingsMenu antes que AppShell).
   * Devuelve true si consumió el Back (no se hace emit a suscriptores `back`).
   */
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

  private keyboardSource(): InputSource {
    const caps = detectWebOSCapabilities(this.options.disableBackHistoryAPI, this.options.supportTouchMode)
    return caps.isWebOS ? 'remote' : 'keyboard'
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
    const action = mapKeyboardEventToAction(event, {
      keyMap: this.options.keyMap,
      codeMap: this.options.codeMap,
      keyCodeMap: this.options.keyCodeMap,
    })
    if (!action) return
    const target = event.target as HTMLElement | null
    const isEditableTarget =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)

    if (isEditableTarget && action !== 'back') {
      return
    }

    if (action === 'back') {
      for (let i = this.backInterceptors.length - 1; i >= 0; i--) {
        if (this.backInterceptors[i](event)) {
          event.preventDefault()
          return
        }
      }
      const capabilities = detectWebOSCapabilities(this.options.disableBackHistoryAPI, this.options.supportTouchMode)
      if (capabilities.backMode === 'manual' && event.keyCode === 461) {
        event.preventDefault()
      }
    } else if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      event.preventDefault()
    } else if (action === 'select') {
      const active = document.activeElement
      const allowNativeActivate =
        active instanceof HTMLButtonElement ||
        (active instanceof HTMLAnchorElement && active.hasAttribute('href'))
      if (!allowNativeActivate) {
        event.preventDefault()
      }
    }

    this.emit(action, this.keyboardSource(), event, {
      key: event.key,
      code: event.code,
      keyCode: event.keyCode,
    })
  }

  private clickDedupeKey(ev: MouseEvent): string {
    const t = ev.target as Node | null
    const x = ev.clientX
    const y = ev.clientY
    return `${t?.nodeName || ''}:${x}:${y}`
  }

  private onClick = (event: MouseEvent) => {
    if (!this.options.enablePointerEvents) return
    const now = Date.now()
    const key = this.clickDedupeKey(event)
    if (now - this.lastEmittedClickAt < 400 && key === this.lastEmittedClickKey) {
      return
    }
    this.lastEmittedClickAt = now
    this.lastEmittedClickKey = key
    const pointerType = event.detail === 0 ? 'touch-synthetic' : 'mouse'
    this.emit('click', 'pointer', event, { pointerType })
  }

  private onPopState = (event: PopStateEvent) => {
    this.emit('back', 'system', event)
  }
}

export const inputManager = new InputManager()
