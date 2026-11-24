import { useEffect, useRef } from 'react'
import type { GameConfigProps } from '../core/types'

/** Draft notifications never persist and must not feed back into the editor's saved settings. */
export function useMechanicsDraft(draft: Record<string, unknown> | null, onDraftChange: GameConfigProps['onDraftChange']) {
  const latest = useRef({ draft, onDraftChange })
  latest.current = { draft, onDraftChange }
  const signature = JSON.stringify(draft)
  useEffect(() => {
    latest.current.onDraftChange?.(latest.current.draft)
  }, [signature])
}
