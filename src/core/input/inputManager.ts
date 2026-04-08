import type { ActionHandler, GameAction, InputContextId, InputEventEnvelope } from './types'

type InputSource = InputEventEnvelope['source']

type KeyMap = Partial<Record<string, GameAction>>
type CodeMap = Partial<Record<string, GameAction>>
type KeyCodeMap = Partial<Record<number, GameAction>>

const DEFAULT_KEY_MAP: KeyMap = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'select',
  NumpadEnter: 'select',
  Escape: 'back',
}

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

function mapKeyboardEventToAction(
  event: KeyboardEvent,
  opts?: { keyMap?: KeyMap; codeMap?: CodeMap; keyCodeMap?: KeyCodeMap }
): GameAction | null {
  const keyMap = { ...DEFAULT_KEY_MAP, ...opts?.keyMap }
  const codeMap = { ...DEFAULT_CODE_MAP, ...opts?.codeMap }
  const keyCodeMap = { ...DEFAULT_KEY_CODE_MAP, ...opts?.keyCodeMap }

  const fromKeyCode = keyCodeMap[event.keyCode]
  if (fromKeyCode) return fromKeyCode
  if (event.key in keyMap) return keyMap[event.key] || null
  if (event.code && event.code in codeMap) return codeMap[event.code] || null
  if (event.keyCode === 13) return 'select'
  return null
}

function isWebOSUA(): boolean {
  return typeof navigator !== 'undefined' && /web0s|webos|smarttv/i.test(navigator.userAgent || '')
}

export type InputManagerOptions = {
  disableBackHistoryAPI?: boolean
  enablePointerEvents?: boolean
  keyMap?: KeyMap
  codeMap?: CodeMap
  keyCodeMap?: KeyCodeMap
}

type BackInterceptor = (event: KeyboardEvent) => boolean

class InputManager {
  private handlers = new Map<GameAction, Set<ActionHandler>>()
  private backInterceptors: BackInterceptor[] = []
  private started = false
  private enabled = true
  private contextId: InputContextId | null = null
  private options: Required<Pick<InputManagerOptions, 'disableBackHistoryAPI' | 'enablePointerEvents'>> &
    Pick<InputManagerOptions, 'keyMap' | 'codeMap' | 'keyCodeMap'> = {
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
    this.options = { ...this.options, ...(options || {}) }
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

    if (isEditableTarget && action !== 'back') return

    if (action === 'back') {
      for (let i = this.backInterceptors.length - 1; i >= 0; i--) {
        if (this.backInterceptors[i](event)) {
          event.preventDefault()
          return
        }
      }
      if (this.options.disableBackHistoryAPI && event.keyCode === 461) {
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

  private onPopState = (event: PopStateEvent) => {
    this.emit('back', 'system', event)
  }
}

export const inputManager = new InputManager()
