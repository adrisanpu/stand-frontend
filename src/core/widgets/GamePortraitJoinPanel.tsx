/** @deprecated Portrait join moved to AppShell (`GamePortraitHeaderJoin`). Kept until infocards carousel migration is confirmed unused. */
import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getWebPlayUrl } from '../lib/joinUrl'
import { GamePanelFooter } from './GamePanelFooter'
import { GAME_PORTRAIT_JOIN_PANEL } from '../ui/gameScreenLayout'
import { useOperatorLanguage } from '../shell/operatorLanguage'

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
  const { t } = useOperatorLanguage()
  return (
    <div className={GAME_PORTRAIT_JOIN_PANEL}>
      <div className="flex justify-center items-center min-w-0 w-full">
        <QRCode
          data={getWebPlayUrl(gameId)}
          size={qrSize}
          margin={qrMargin}
          alt={t('QR de participación web', 'Web participation QR code')}
          className={qrClassName}
          containerClassName={containerClassName}
        />
      </div>
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-300/90 text-center">
        {t('Escanea para jugar', 'Scan to play')}
      </p>
      <GamePanelFooter>{children}</GamePanelFooter>
    </div>
  )
}
