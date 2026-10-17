import { useEffect, useRef } from 'react'
import type { GameConfigSaveRegistration } from '../types'

export function saveErrorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

/**
 * Registers a game config save handler with the host modal (if any). The registration is stable;
 * calls always reach the latest render's validate/save closures.
 */
export function useGameConfigSaveRegistration(
  registerSave: ((registration: GameConfigSaveRegistration | null) => void) | undefined,
  registration: GameConfigSaveRegistration,
): boolean {
  const latest = useRef(registration)
  latest.current = registration
  useEffect(() => {
    if (!registerSave) return
    registerSave({
      validate: () => latest.current.validate?.() ?? null,
      save: () => latest.current.save(),
    })
    return () => registerSave(null)
  }, [registerSave])
  return Boolean(registerSave)
}
