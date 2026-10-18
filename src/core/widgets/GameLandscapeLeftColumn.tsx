import type { ReactNode } from 'react'
import GameLandscapeInfoColumn from './GameLandscapeInfoColumn'

type GameLandscapeLeftColumnProps = {
  gameId: string
  logoElement: ReactNode
  children: ReactNode
  playersElement?: ReactNode
  joinChannel?: string | null
}

/** Landscape column 1: info panel (logo, QR, manual) + Players below. */
export default function GameLandscapeLeftColumn({
  gameId,
  logoElement,
  children,
  playersElement,
  joinChannel = 'web',
}: GameLandscapeLeftColumnProps) {
  return (
    <div className="flex flex-col gap-2 h-full min-h-0 min-w-0 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <GameLandscapeInfoColumn
          gameId={gameId}
          logoElement={logoElement}
          joinChannel={joinChannel}
        >
          {children}
        </GameLandscapeInfoColumn>
      </div>
      {playersElement ? (
        <div className="flex-shrink-0 w-full min-w-0">{playersElement}</div>
      ) : null}
    </div>
  )
}
