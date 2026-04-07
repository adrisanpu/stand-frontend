import { useEffect, useMemo } from 'react'
import { inputManager } from './inputManager'
import type { GameAction, InputContextId, InputEventEnvelope } from './types'

type HandlerMap = Partial<Record<GameAction, (event: InputEventEnvelope) => void>>

/**
 * Suscripción al bus de acciones del `inputManager` (mando SRS23CW / teclado).
 *
 * Usa `InputAction.SELECT`, `InputAction.UP`, etc. como claves si prefieres:
 * `handlers={{ [InputAction.SELECT]: () => ... }}`
 *
 * BACK global lo gestionan `AppShell` + `SettingsMenu` vía `registerBackInterceptor`;
 * en gameplay suele no hacer falta suscribirse a `back` salvo casos especiales.
 */
export function useGameInput(contextId: InputContextId, handlers: HandlerMap) {
  const entries = useMemo(() => Object.entries(handlers) as Array<[GameAction, (event: InputEventEnvelope) => void]>, [handlers])

  useEffect(() => {
    inputManager.setContext(contextId)
    const unsubscribers = entries.map(([action, handler]) => inputManager.subscribe(action, handler))
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      inputManager.setContext(null)
    }
  }, [contextId, entries])
}

