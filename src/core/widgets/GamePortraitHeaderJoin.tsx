import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getJoinUrl } from '../lib/joinUrl'
import { GamePanelFooter } from './GamePanelFooter'
import { GameIdHint } from './GameJoinHints'
import { GAME_PORTRAIT_HEADER_JOIN } from '../ui/gameScreenLayout'

type GamePortraitHeaderJoinProps = {
  gameId: string
  logoElement: ReactNode
  footerChildren?: ReactNode
  qrSize?: number
  joinChannel?: string | null
}

export default function GamePortraitHeaderJoin({
  gameId,
  logoElement,
  footerChildren,
  qrSize = 128,
  joinChannel,
}: GamePortraitHeaderJoinProps) {
  return (
    <div className={`${GAME_PORTRAIT_HEADER_JOIN} flex-shrink-0 w-full min-w-0`}>
      <div className="flex flex-row items-center gap-3 sm:gap-4 w-full min-w-0">
        <div className="flex-shrink-0 flex items-center justify-start min-w-0 max-w-[42%] [&_img]:max-h-20 sm:[&_img]:max-h-24 [&_img]:w-auto [&_img]:object-contain">
          {logoElement}
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1">
          <QRCode
            data={getJoinUrl(gameId, joinChannel)}
            size={qrSize}
            margin={6}
            containerClassName="w-full max-w-[min(100%,128px)] sm:max-w-[140px] aspect-square"
            alt="QR Code para Instagram DM"
            className="!border-0 !bg-white !p-2 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          />
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-300/90 text-center">
            Escanea para jugar
          </p>
          <GameIdHint gameId={gameId} />
        </div>
      </div>
      {footerChildren ? <GamePanelFooter>{footerChildren}</GamePanelFooter> : null}
    </div>
  )
}
