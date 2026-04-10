import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getInstagramDmUrl } from '../lib/instagram'

type GameLandscapeInfoColumnProps = {
  gameId: string
  logoElement: ReactNode
  children: ReactNode
}

/** Una fila de instrucciones para la columna izquierda en landscape: emoji como viñeta, texto alineado al lado (como la tarjeta virtual de infocards). */
export function LandscapeInfoInstruction({
  emoji,
  emojiLabel,
  children,
}: {
  emoji: string
  emojiLabel: string
  children: ReactNode
}) {
  return (
    <li className="flex gap-2.5 sm:gap-3 items-start">
      <span
        className="flex-shrink-0 text-lg sm:text-xl leading-none pt-0.5"
        role="img"
        aria-label={emojiLabel}
      >
        {emoji}
      </span>
      <span className="min-w-0 pt-0.5 text-[10px] sm:text-xs leading-snug text-gray-300">{children}</span>
    </li>
  )
}

export default function GameLandscapeInfoColumn({ gameId, logoElement, children }: GameLandscapeInfoColumnProps) {
  return (
    <div className="card flex flex-col gap-2 p-4 sm:p-5 overflow-hidden min-h-0 h-full">
      <div className="flex-shrink-0 flex justify-center items-start w-full min-w-0 px-0.5">
        {logoElement}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
        <ul className="m-0 list-none space-y-2.5 sm:space-y-3.5 p-0 min-h-0">{children}</ul>
      </div>
      <div className="flex-shrink-0 flex flex-row justify-between items-end gap-2 pt-1 w-full min-w-0">
        <div className="flex min-w-0 max-w-[55%] items-end gap-1 self-end">
          <span
            className="text-[10px] sm:text-xs font-mono text-textMain opacity-50 truncate min-w-0"
            title={gameId}
          >
            {gameId}
          </span>
          <span className="group relative inline-flex flex-shrink-0">
            <button
              type="button"
              aria-label="Cómo unirte si el QR no funciona"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/25 text-[10px] font-semibold text-gray-300/90"
            >
              i
            </button>
            <span className="pointer-events-none absolute left-1/2 top-0 z-20 hidden w-56 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-white/15 bg-[rgba(17,24,39,0.98)] p-2 text-left text-xs text-gray-200 shadow-lg group-hover:block sm:w-64">
              Si el QR no te une (por ejemplo, ya tenías el chat abierto), envía este código como mensaje en el mismo chat de
              Instagram con Stand.
            </span>
          </span>
        </div>
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
