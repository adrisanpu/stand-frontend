import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { getGameById } from '../../games'
import type { ParticipantAppearance } from '../theme/appearance'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import HomeCanvas from '../home/HomeCanvas'
import useHomeSamples from '../home/HomeSamples'
import { type HomeCanvasConfig, type HomeOrientation, type HomeBackgroundUrls } from '../home/canvasModel'
import GamePlayPreview from './GamePlayPreview'

export default function GameHomePreview({ gameId, gameName, gameType, appearance, logoUrl, bannerUrl, homeCanvas, orientation = 'landscape', backgroundUrls }: {
  gameId: string
  gameName: string
  gameType: string
  appearance: ParticipantAppearance | null
  logoUrl?: string | null
  bannerUrl?: string | null
  homeCanvas?: HomeCanvasConfig
  orientation?: HomeOrientation
  backgroundUrls?: HomeBackgroundUrls
}) {
  const { t } = useOperatorLanguage()
  const [view, setView] = useState<'home' | 'play'>('home')
  const samples = useHomeSamples()
  const width = view === 'home' ? orientation === 'portrait' ? 540 : 960 : 390
  const height = view === 'home' ? orientation === 'portrait' ? 960 : 540 : 720
  const container = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  useEffect(() => {
    const element = container.current
    if (!element) return
    const resize = () => {
      if (element.clientWidth) setScale(element.clientWidth / width)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width])
  const game = getGameById(gameType)
  const light = appearance?.themeMode === 'light'
  const primary = appearance?.colors?.primary ?? game?.colors.primary ?? '#9CA3AF'
  const accent = appearance?.colors?.accent ?? game?.colors.accent ?? '#D1D5DB'
  const rgb = (hex: string) => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(',')
  const style = {
    '--color-primary': primary,
    '--color-accent': accent,
    '--color-primary-rgb': rgb(primary),
    '--color-accent-rgb': rgb(accent),
    '--color-background': light ? '#F5F5F7' : game?.colors.background ?? '#0B0A12',
    '--color-surface': light ? '#FFFFFF' : game?.colors.surface ?? 'rgba(255,255,255,0.04)',
    '--color-text-main': light ? '#0F172A' : game?.colors.textMain ?? '#EAEAF2',
    '--color-text-sub': light ? '#475569' : game?.colors.textSub ?? '#9AA0A6',
    '--color-border-gradient-1': `rgba(${rgb(primary)},0.65)`,
    '--color-border-gradient-2': `rgba(${rgb(accent)},0.65)`,
    background: 'var(--color-background)',
    color: 'var(--color-text-main)',
    width,
    height,
    padding: view === 'play' ? 24 : 0,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  } as CSSProperties
  return <aside className="space-y-3 lg:sticky lg:top-0" aria-label={t('Vista previa del home', 'Home preview')}>
    <h3 className="font-semibold">{t('Vista previa', 'Preview')}</h3>
    <div className="flex gap-2 text-sm" role="tablist" aria-label={t('Pantalla de vista previa', 'Preview screen')}>
      {(['home', 'play'] as const).map(value => <button key={value} type="button" role="tab"
        id={`appearance-preview-${value}`} aria-selected={view === value} aria-controls="appearance-preview-panel"
        className={`rounded-lg px-3 py-2 ${view === value ? 'bg-primary/20 font-semibold' : ''}`}
        onClick={() => setView(value)}>{value === 'home' ? 'Home' : t('Juego (/play)', 'Game (/play)')}</button>)}
    </div>
    <div ref={container} role="tabpanel" id="appearance-preview-panel" aria-labelledby={`appearance-preview-${view}`}
      className={`mx-auto w-full overflow-hidden rounded-xl border border-current/20 ${view === 'play' ? 'max-w-[320px]' : ''}`}
      style={{ aspectRatio: `${width} / ${height}` }}>
      <div style={style}>
        {view === 'play' ? <div className="space-y-5">
          {bannerUrl && <img src={bannerUrl} alt="" className="max-h-28 w-full rounded-xl object-cover" />}
          {(logoUrl || game?.assets?.logo) && <img src={logoUrl || game?.assets?.logo}
            alt={t('Logo del evento', 'Event logo')} className="mx-auto max-h-20 max-w-[70%] object-contain" />}
          <GamePlayPreview gameType={gameType} />
        </div> : <HomeCanvas gameId={gameId} gameName={gameName} orientation={orientation}
          composition={homeCanvas?.[orientation] ?? { background: null, items: [] }}
          backgroundUrl={backgroundUrls?.[orientation]} logoSrc={logoUrl || game?.assets?.logo} preview fit {...samples} />}
      </div>
    </div>
    <p className="text-xs text-textSub">{t('Representación del diseño con datos de ejemplo. No carga el motor del juego, guarda cambios ni ejecuta acciones de la partida.', 'Sample layout representation. Does not load the game engine, save changes or run event actions.')}</p>
  </aside>
}
