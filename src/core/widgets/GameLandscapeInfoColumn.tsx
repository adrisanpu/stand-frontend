import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getInstagramDmUrl } from '../lib/instagram'

type GameLandscapeInfoColumnProps = {
  gameId: string
  logoElement: ReactNode
  children: ReactNode
}

export default function GameLandscapeInfoColumn({ gameId, logoElement, children }: GameLandscapeInfoColumnProps) {
  return (
    <div className="card flex flex-col gap-2 p-4 sm:p-5 overflow-hidden min-h-0 h-full">
      <div className="flex-shrink-0 flex justify-center items-start w-full min-w-0 px-0.5">
        {logoElement}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
        <div className="flex flex-col gap-1 text-[10px] sm:text-xs text-gray-300 leading-snug min-h-0">
          {children}
        </div>
      </div>
      <div className="flex-shrink-0 flex flex-row justify-between items-end gap-2 pt-1 w-full min-w-0">
        <span
          className="text-[10px] sm:text-xs font-mono text-textMain opacity-50 truncate min-w-0 max-w-[55%] self-end"
          title={gameId}
        >
          {gameId}
        </span>
        <div className="flex justify-end flex-shrink-0 min-w-0">
          <QRCode
            data={getInstagramDmUrl(gameId)}
            size={200}
            margin={6}
            containerClassName="max-h-[min(18vh,160px)] max-w-[160px] w-full"
            alt="QR Code para Instagram DM"
            className="!border-0 !bg-transparent !p-0"
          />
        </div>
      </div>
    </div>
  )
}
