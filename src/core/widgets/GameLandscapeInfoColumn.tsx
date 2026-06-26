import type { ReactNode } from 'react'

import QRCode from './QRCode'

import { getInstagramDmUrl } from '../lib/instagram'

import { GamePanelFooter } from './GamePanelFooter'



type GameLandscapeInfoColumnProps = {

  gameId: string

  logoElement: ReactNode

  children: ReactNode

  avatarElement?: ReactNode

}



/** Una fila de instrucciones para la columna izquierda en landscape. */

export function LandscapeInfoInstruction({ children }: { children: ReactNode }) {

  return (

    <li className="min-w-0 text-[10px] sm:text-xs leading-snug text-gray-300">{children}</li>

  )

}



function GameIdHint({ gameId }: { gameId: string }) {

  return (

    <div className="flex items-center justify-center gap-1 min-w-0 w-full">

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

  )

}



export default function GameLandscapeInfoColumn({ gameId, logoElement, children, avatarElement }: GameLandscapeInfoColumnProps) {

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
            data={getInstagramDmUrl(gameId)}
            size={320}
            margin={8}
            containerClassName="w-full max-w-[min(100%,240px)] aspect-square mx-auto"
            alt="QR Code para Instagram DM"
            className="!border-0 !bg-white !p-2.5 sm:!p-3 rounded-2xl shadow-[0_0_24px_rgba(255,255,255,0.12)]"
          />
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-300/90 text-center">
            Escanea para jugar
          </p>
          <GameIdHint gameId={gameId} />
        </div>
      </div>

      <GamePanelFooter>{children}</GamePanelFooter>

    </div>

  )

}


