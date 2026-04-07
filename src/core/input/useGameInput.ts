import { useEffect, useMemo } from 'react'
import { inputManager } from './inputManager'
import type { GameAction, InputContextId, InputEventEnvelope } from './types'

type HandlerMap = Partial<Record<GameAction, (event: InputEventEnvelope) => void>>

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

