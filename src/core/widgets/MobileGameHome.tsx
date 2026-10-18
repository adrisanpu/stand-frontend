import type { ReactNode } from 'react'
import QRCode from './QRCode'
import { getJoinUrl } from '../lib/joinUrl'
import type { JoinChannel } from '../settings/gameAccess'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import { HOME_BODY_TEXT } from '../ui/homeTypography'

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
  const { language, t } = useOperatorLanguage()
  return (
    <div
      aria-label={t('Pantalla del evento móvil', 'Mobile event screen')}
      className={portrait
        ? 'flex flex-col gap-4 w-full min-w-0'
        : `grid ${ranking ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.2fr)]' : 'grid-cols-[minmax(0,1fr)_minmax(0,2fr)]'} gap-4 h-full min-h-0 w-full`}
    >
      <div aria-label={t('Logo, jugadores y sorteo', 'Logo, players, and raffle')} className={portrait ? 'contents' : 'flex flex-col gap-3 min-w-0 h-full min-h-0'}>
        <div
          aria-label={t('Logo del evento', 'Event logo')}
          className={`card flex items-center justify-center overflow-hidden p-4 min-w-0 ${portrait ? 'order-1 h-[22dvh] shrink-0' : 'flex-1 min-h-0'}`}
        >
          {logoSrc ? (
            <img src={logoSrc} alt={logoAlt} className="h-full w-full object-contain" />
          ) : (
            <h1 className={`${HOME_BODY_TEXT} font-bold text-center break-words`}>{gameName}</h1>
          )}
        </div>
        <div aria-label={t('Jugadores del evento', 'Event players')} className={`shrink-0 w-full min-w-0 ${portrait ? 'order-3' : ''}`}>{players}</div>
        {raffle && (
          <div
            aria-label={t('Sorteo del evento', 'Event raffle')}
            className={portrait ? 'order-4 min-h-[240px] flex flex-col' : 'flex-1 min-h-[min(36dvh,300px)] flex flex-col'}
          >
            {raffle}
          </div>
        )}
      </div>
      <div
        aria-label={t('QR de acceso al juego', 'Game access QR code')}
        className={`card flex flex-col items-center justify-evenly gap-4 sm:gap-6 min-w-0 p-4 sm:p-6 ${portrait ? 'order-2 min-h-[32dvh]' : 'h-full min-h-0 overflow-hidden'}`}
      >
        <h2 lang={language} className="shrink-0 text-center text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-wide text-white">
          {language === 'es'
            ? <><span className="text-red-500">ESCANEA</span> PARA JUGAR.</>
            : <><span className="text-red-500">SCAN</span> TO PLAY.</>}
        </h2>
        <QRCode
          data={getJoinUrl(gameId, joinChannel)}
          size={800}
          margin={24}
          alt={t('Escanea para unirte al juego', 'Scan to join the game')}
          containerClassName={portrait
            ? 'w-full max-w-[min(100%,44dvh)] aspect-square'
            : 'w-full max-w-[min(100%,calc(80dvh-12rem))] aspect-square max-h-full'}
          className="!bg-white !border-0 !p-2 sm:!p-3"
        />
      </div>
      {ranking && (
        <div aria-label={t('Ranking del evento', 'Event leaderboard')} className={`flex flex-col min-w-0 ${portrait ? 'order-5 min-h-[360px]' : 'h-full min-h-0 overflow-hidden'}`}>
          {ranking}
        </div>
      )}
    </div>
  )
}
