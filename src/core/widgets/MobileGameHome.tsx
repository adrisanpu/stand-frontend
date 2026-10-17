import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getJoinUrl } from '../lib/joinUrl'
import type { JoinChannel } from '../settings/gameAccess'

type Props = {
  gameId: string
  gameName: string
  joinChannel: JoinChannel
  portrait: boolean
  logoSrc?: string | null
  logoAlt: string
  players: ReactNode
  raffle?: ReactNode
  ranking?: ReactNode
}

export default function MobileGameHome({
  gameId, gameName, joinChannel, portrait, logoSrc, logoAlt, players, raffle, ranking,
}: Props) {
  return (
    <div
      aria-label="Pantalla del evento móvil"
      className={portrait
        ? 'flex flex-col gap-4 w-full min-w-0'
        : `grid ${ranking ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.2fr)]' : 'grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'} gap-4 h-full min-h-0 w-full`}
    >
      <div aria-label="Logo, jugadores y sorteo" className={portrait ? 'contents' : 'flex flex-col gap-3 min-w-0 h-full min-h-0'}>
        <div
          aria-label="Logo del evento"
          className={`card flex items-center justify-center overflow-hidden p-4 min-w-0 ${portrait ? 'order-1 h-[22dvh] shrink-0' : 'flex-1 min-h-0'}`}
        >
          {logoSrc ? (
            <img src={logoSrc} alt={logoAlt} className="h-full w-full object-contain" />
          ) : (
            <h1 className="text-3xl sm:text-5xl font-bold text-center break-words">{gameName}</h1>
          )}
        </div>
        <div aria-label="Jugadores del evento" className={`shrink-0 w-full min-w-0 ${portrait ? 'order-3' : ''}`}>{players}</div>
        {raffle && (
          <div
            aria-label="Sorteo del evento"
            className={portrait ? 'order-4 min-h-[240px] flex flex-col' : 'flex-1 min-h-[min(36dvh,300px)] flex flex-col'}
          >
            {raffle}
          </div>
        )}
      </div>
      <div
        aria-label="QR de acceso al juego"
        className={`card flex items-center justify-center min-w-0 p-4 sm:p-6 ${portrait ? 'order-2 min-h-[32dvh]' : 'h-full min-h-0 overflow-hidden'}`}
      >
        <QRCode
          data={getJoinUrl(gameId, joinChannel)}
          size={800}
          margin={24}
          alt="Escanea para unirte al juego"
          containerClassName={portrait
            ? 'w-full max-w-[min(100%,40dvh)] aspect-square'
            : 'w-full max-w-[min(100%,calc(80dvh-3rem))] aspect-square max-h-full'}
          className="!bg-white !border-0 !p-2 sm:!p-3"
        />
      </div>
      {ranking && (
        <div aria-label="Ranking del evento" className={`flex flex-col min-w-0 ${portrait ? 'order-5 min-h-[360px]' : 'h-full min-h-0 overflow-hidden'}`}>
          {ranking}
        </div>
      )}
    </div>
  )
}
