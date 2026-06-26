/** @deprecated Portrait join moved to AppShell (`GamePortraitHeaderJoin`). Kept until infocards carousel migration is confirmed unused. */
import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getInstagramDmUrl } from '../lib/instagram'
import { GamePanelFooter } from './GamePanelFooter'
import { GAME_PORTRAIT_JOIN_PANEL } from '../ui/gameScreenLayout'

type GamePortraitJoinPanelProps = {
  gameId: string
  qrSize: number
  qrMargin?: number
  qrClassName?: string
  containerClassName?: string
  children: ReactNode
}

export default function GamePortraitJoinPanel({
  gameId,
  qrSize,
  qrMargin = 8,
  qrClassName = '!border-0 !bg-transparent',
  containerClassName,
  children,
}: GamePortraitJoinPanelProps) {
  return (
    <div className={GAME_PORTRAIT_JOIN_PANEL}>
      <div className="flex justify-center items-center min-w-0 w-full">
        <QRCode
          data={getInstagramDmUrl(gameId)}
          size={qrSize}
          margin={qrMargin}
          alt="QR Code para Instagram DM"
          className={qrClassName}
          containerClassName={containerClassName}
        />
      </div>
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-300/90 text-center">
        Escanea para jugar
      </p>
      <GamePanelFooter>{children}</GamePanelFooter>
    </div>
  )
}
