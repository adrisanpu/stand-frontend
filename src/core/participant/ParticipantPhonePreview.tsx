import type { CSSProperties, ReactNode } from 'react'
import { getGameById } from '../../games'
import { normalizeGameType } from '../gameTypeMap'
import type { PrizeCatalog } from '../prizes'
import type { ParticipantAppearance } from '../theme/appearance'
import { resolveParticipantPalette } from '../theme/theme'
import ParticipantPrizePromo from './ParticipantPrizePromo'
import { ParticipantLanguageProvider, ParticipantLanguageSelector, useParticipantLanguage } from './participantLanguage'
import './participant.css'

export type ParticipantPhoneFrame = {
  appearance?: ParticipantAppearance | null
  logoUrl?: string | null
  bannerUrl?: string | null
  prizeCatalog?: PrizeCatalog
}

export type ParticipantPhonePreviewProps = ParticipantPhoneFrame & {
  gameType: string
  /** `form` mirrors the join/quiz steps (the form renders its own header); `play` mirrors the game steps. */
  screen: 'form' | 'play'
  language?: 'es' | 'en'
  label?: string
  className?: string
  children: ReactNode
}

/** Renders children inside the same shell, card and theme a participant sees on their phone, scoped to this frame. */
export default function ParticipantPhonePreview({ gameType, screen, language = 'es', label, className = '', children, ...frame }: ParticipantPhonePreviewProps) {
  const game = getGameById(normalizeGameType(gameType))
  const palette = resolveParticipantPalette(game ?? null, frame.appearance ?? undefined)
  return <div role="group" aria-label={label} data-participant-theme={palette.dark ? 'dark' : 'light'}
    className={`participant-preview mx-auto w-full max-w-md overflow-hidden rounded-xl ${className}`}
    style={palette.variables as CSSProperties}>
    <ParticipantLanguageProvider key={language} initialLanguage={language}>
      <PhoneShell gameType={gameType} screen={screen} {...frame}>{children}</PhoneShell>
    </ParticipantLanguageProvider>
  </div>
}

function PhoneShell({ gameType, screen, logoUrl, bannerUrl, prizeCatalog, children }: ParticipantPhoneFrame & {
  gameType: string
  screen: 'form' | 'play'
  children: ReactNode
}) {
  const { language, t } = useParticipantLanguage()
  const game = getGameById(normalizeGameType(gameType))
  const logo = logoUrl || game?.assets?.logo
  const showLogo = !!logo && !(screen === 'form' && (logoUrl || bannerUrl))
  return <div lang={language} className="play-shell bg-club text-textMain font-sans">
    <div className="relative mx-auto max-w-md w-full flex flex-col">
      <ParticipantPrizePromo catalog={prizeCatalog} stickers />
      <div className="relative w-full">
        <ParticipantLanguageSelector />
        <div className="play-card card relative w-full">
          {screen === 'play' && bannerUrl && <img src={bannerUrl} alt="" className="max-h-44 w-full rounded-xl object-cover" />}
          {showLogo && <img src={logo} alt={logoUrl ? t('Logo del cliente') : game?.name}
            className="play-logo mx-auto w-auto max-w-full object-contain" />}
          {children}
        </div>
      </div>
    </div>
  </div>
}
