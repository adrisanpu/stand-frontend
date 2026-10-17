import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getJoinUrl } from '../lib/joinUrl'
import { GamePanelFooter } from './GamePanelFooter'
import { GameIdHint } from './GameJoinHints'
import { useOperatorLanguage } from '../shell/operatorLanguage'

type GameLandscapeInfoColumnProps = {
  gameId: string
  logoElement: ReactNode
  children: ReactNode
  avatarElement?: ReactNode
  joinChannel?: string | null
}

/** Una fila de instrucciones para la columna izquierda en landscape. */
export function LandscapeInfoInstruction({ children }: { children: ReactNode }) {
  return (
    <li className="min-w-0 text-[10px] sm:text-xs leading-snug text-gray-300">{children}</li>
  )
}

export default function GameLandscapeInfoColumn({ gameId, logoElement, children, avatarElement, joinChannel }: GameLandscapeInfoColumnProps) {
  const { t } = useOperatorLanguage()
  return (
    <div className="card flex flex-col gap-2 p-4 sm:p-5 overflow-hidden min-h-0 h-full">
      <div className="flex-shrink-0 flex justify-center items-center w-full min-w-0 px-0.5 [&_img]:max-h-20 sm:[&_img]:max-h-24 lg:[&_img]:max-h-28">
        {logoElement}
      </div>
      <div className="flex-1 min-h-0 relative flex flex-col justify-center items-center w-full min-w-0">
        {avatarElement ? (
          <div className="absolute inset-0 card rounded-xl sm:rounded-2xl shadow-neon overflow-hidden">
            <div className="absolute inset-0">{avatarElement}</div>
          </div>
        ) : null}
        <div className="relative z-10 flex flex-col items-center justify-center gap-1.5 w-full min-w-0 px-0.5">
          <QRCode
            data={getJoinUrl(gameId, joinChannel)}
            size={320}
            margin={8}
            containerClassName="w-full max-w-[min(100%,240px)] aspect-square mx-auto"
            alt={t('QR para unirse', 'QR code to join')}
            className="!border-0 !bg-white !p-2.5 sm:!p-3 rounded-2xl shadow-[0_0_24px_rgba(255,255,255,0.12)]"
          />
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-300/90 text-center">
            {t('Escanea para jugar', 'Scan to play')}
          </p>
          <GameIdHint gameId={gameId} joinChannel={joinChannel} />
        </div>
      </div>
      <GamePanelFooter>{children}</GamePanelFooter>
    </div>
  )
}
