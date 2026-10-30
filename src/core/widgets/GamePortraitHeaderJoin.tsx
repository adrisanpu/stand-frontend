import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getJoinUrl } from '../lib/joinUrl'
import { GamePanelFooter } from './GamePanelFooter'
import { GameIdHint } from './GameJoinHints'
import { GAME_PORTRAIT_HEADER_JOIN } from '../ui/gameScreenLayout'
import { useOperatorLanguage } from '../shell/operatorLanguage'

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
  const { t } = useOperatorLanguage()
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
            alt={t('QR para unirse al juego', 'QR code to join the game')}
            className="!border-0 !bg-transparent !p-0"
            themed
          />
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-primary text-center">
            {t('Escanea para jugar', 'Scan to play')}
          </p>
          <GameIdHint gameId={gameId} joinChannel={joinChannel} />
        </div>
      </div>
      {footerChildren ? <GamePanelFooter>{footerChildren}</GamePanelFooter> : null}
    </div>
  )
}
