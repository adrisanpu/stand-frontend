import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getJoinUrl } from '../lib/joinUrl'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import QRCode from '../widgets/QRCode'
import { HOME_GRID, HOME_UNIT, type HomeComposition, type HomeItem, type HomeOrientation, type HomeStyle } from './canvasModel'
import './homeCanvas.css'

export type HomeCanvasProps = {
  composition: HomeComposition
  orientation: HomeOrientation
  gameId: string
  gameName: string
  logoSrc?: string | null
  backgroundUrl?: string | null
  players?: ReactNode
  ranking?: ReactNode
  raffle?: ReactNode
  prizes?: ReactNode
  preview?: boolean
  fit?: boolean
  /** Stretch the grid to the real container size (live Home); otherwise fit keeps the aspect ratio. */
  stretch?: boolean
  overlay?: (item: HomeItem) => ReactNode
}

function styleVariables(style: HomeStyle): CSSProperties {
  const variables: Record<string, string> = {}
  if (style.bold !== undefined) variables['--home-font-weight'] = style.bold ? '700' : '400'
  if (style.backgroundColor !== undefined) variables.backgroundColor = style.backgroundColor
  if (style.color) {
    variables['--color-text-main'] = style.color
    variables['--color-text-sub'] = style.color
    variables.color = style.color
  }
  const accent = style.accentColor
  if (accent) {
    const rgb = [1, 3, 5].map(start => parseInt(accent.slice(start, start + 2), 16)).join(',')
    for (const name of ['primary', 'accent']) {
      variables[`--color-${name}`] = accent
      variables[`--color-${name}-rgb`] = rgb
    }
    variables['--color-border-gradient-1'] = `rgba(${rgb},0.65)`
    variables['--color-border-gradient-2'] = `rgba(${rgb},0.65)`
  }
  return variables
}

function VideoBackground({ src, preview, controls }: { src: string; preview: boolean; controls: HTMLDivElement | null }) {
  const { t } = useOperatorLanguage()
  const video = useRef<HTMLVideoElement>(null)
  const time = useRef(0)
  const [blocked, setBlocked] = useState(false)
  const [failed, setFailed] = useState(false)
  const [muted, setMuted] = useState(() => preview || sessionStorage.getItem('stand.home.sound') === 'off')
  useEffect(() => {
    const element = video.current
    if (!element) return
    let active = true
    setFailed(false)
    const play = async () => {
      try {
        await element.play()
        if (active) setBlocked(false)
      } catch (reason) {
        if (!active || (reason instanceof DOMException && reason.name === 'AbortError')) return
        if (reason instanceof DOMException && reason.name === 'NotAllowedError') {
          setBlocked(true)
          element.muted = true
          setMuted(true)
          try { await element.play() } catch (error) {
            if (active && !(error instanceof DOMException && error.name === 'NotAllowedError')) setFailed(true)
          }
        } else setFailed(true)
      }
    }
    void play()
    return () => { active = false }
  }, [src])
  const toggleSound = () => {
    const element = video.current
    if (!element) return
    const next = blocked ? false : !muted
    element.muted = next
    setMuted(next)
    sessionStorage.setItem('stand.home.sound', next ? 'off' : 'on')
    void element.play().then(() => setBlocked(false)).catch(() => setFailed(true))
  }
  return <>
    <video ref={video} src={src} loop playsInline muted={muted} autoPlay
      className="absolute inset-0 h-full w-full object-cover" aria-hidden="true"
      onTimeUpdate={() => { if (video.current && video.current.currentTime > 0) time.current = video.current.currentTime }}
      onLoadedMetadata={() => {
        if (video.current && Number.isFinite(video.current.duration) && time.current < video.current.duration) {
          video.current.currentTime = time.current
        }
      }}
      onError={() => setFailed(true)} />
    {!preview && controls && createPortal(<button type="button" className="home-sound-control" onClick={toggleSound}>
      {blocked || muted ? t('Activar sonido', 'Enable sound') : t('Silenciar fondo', 'Mute background')}
    </button>, controls)}
    {failed && (controls ? createPortal(<p role="alert" className="home-playback-error">
      {t('No se puede reproducir el vídeo de fondo. Comprueba el archivo y su formato.', 'Background video cannot be played. Check the file and its format.')}
    </p>, controls) : <p role="alert" className="home-media-error">{t('No se puede reproducir el vídeo de fondo.', 'Background video cannot be played.')}</p>)}
  </>
}

export default function HomeCanvas({
  composition, orientation, gameId, gameName, logoSrc, backgroundUrl, players, ranking, raffle, prizes,
  preview = false, fit = false, stretch = false, overlay,
}: HomeCanvasProps) {
  const { t } = useOperatorLanguage()
  const container = useRef<HTMLDivElement>(null)
  const { cols, rows } = HOME_GRID[orientation]
  const width = cols * HOME_UNIT, height = rows * HOME_UNIT
  const [scale, setScale] = useState(0)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [controls, setControls] = useState<HTMLDivElement | null>(null)
  const showControls = composition.background?.type === 'video' && !preview && !overlay
  // In fit mode the grid stretches to the real viewport, so each axis gets its own unit.
  const unitX = stretch ? size.width / cols : HOME_UNIT
  const unitY = stretch ? size.height / rows : HOME_UNIT
  useEffect(() => {
    const element = container.current
    if (!element) return
    const resize = () => {
      setScale(Math.max(0, Math.min(element.clientWidth / width, element.clientHeight / height)))
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width, height, showControls])
  const [imageError, setImageError] = useState(false)
  useEffect(() => setImageError(false), [backgroundUrl])
  const content = (item: HomeItem): ReactNode => {
    switch (item.type) {
      case 'qr':
        return <QRCode data={getJoinUrl(gameId, 'web')} size={1000} themed
          containerClassName="home-canvas-qr h-full w-full" className="!h-full !bg-black !border-0 !p-0 !rounded-none"
          alt={t('Escanea para unirte al juego', 'Scan to join the game')} />
      case 'logo':
        return <div className="card h-full flex items-center justify-center p-5">
          {logoSrc ? <img src={logoSrc} alt={t('Logo del evento', 'Event logo')} className="h-full w-full object-contain" />
            : <h1 className="text-5xl font-bold text-center break-words">{gameName}</h1>}
        </div>
      case 'players': return players
      case 'ranking': return ranking
      case 'raffle': return raffle
      case 'prizes': return prizes
      case 'text':
        return <div className="home-canvas-text"
          style={{ fontSize: 'calc(48px * var(--home-text-scale))', color: 'var(--color-text-main)', textAlign: item.align ?? 'center' }}>
          <div className="w-full whitespace-pre-wrap break-words">{item.text}</div>
        </div>
    }
  }
  return <div className={`home-canvas-frame ${fit || stretch ? 'h-full w-full' : 'w-full'}`}
    style={fit || stretch ? undefined : { aspectRatio: `${width} / ${height}` }}
    aria-label={t('Lienzo del Home', 'Home canvas')}>
    <div ref={container} className="home-canvas-viewport">
    <div className={`home-canvas-stage ${overlay ? 'home-canvas-editing' : ''}`} data-home-stage
      style={{ ...styleVariables(composition), ...(stretch ? { width: size.width, height: size.height } : { width, height, transform: `scale(${scale})` }) }}>
      {composition.background && backgroundUrl && (composition.background.type === 'video'
        ? <VideoBackground key={composition.background.key} src={backgroundUrl} preview={preview || !!overlay} controls={controls} />
        : <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setImageError(true)} />)}
      {imageError && <p role="alert" className="home-media-error">{t('No se puede cargar la imagen de fondo.', 'Background image could not be loaded.')}</p>}
      {composition.items.map(item => <div key={item.id} className="home-canvas-item"
        data-home-item={item.id} style={{ left: item.x * unitX, top: item.y * unitY, width: item.w * unitX, height: item.h * unitY }}>
        <div className={`home-canvas-widget home-widget-${item.type} ${(item.bold ?? composition.bold) !== undefined ? 'home-widget-font-weight' : ''} ${item.backgroundColor !== undefined ? 'home-widget-background' : ''} ${overlay ? 'pointer-events-none' : ''}`}
          style={{
            ...styleVariables(item),
            '--home-text-scale': Math.min(
              Math.max(1, item.w * unitX - 20) / 340,
              Math.max(1, item.h * unitY - 20) / (item.type === 'text' ? 100 : 220),
            ) * ((item.fontSize ?? composition.fontSize ?? 48) / 48),
          } as CSSProperties}>{content(item)}</div>
        {overlay?.(item)}
      </div>)}
      {overlay && !composition.items.length && <p className="home-canvas-empty">
        {t('Tu lienzo está vacío. Añade un componente para empezar.', 'Your canvas is empty. Add a component to get started.')}
      </p>}
    </div>
    </div>
    {showControls && <div ref={setControls} className="home-playback-controls" />}
  </div>
}
