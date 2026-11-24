import { useRef, useState } from 'react'
import { mobileActionClass, useMobilePlay, type MobilePlayProps } from '../../core/participant/useMobilePlay'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'

export default function InfocardsParticipantPlay(props: MobilePlayProps) {
  const runtime = useMobilePlay(props)
  let initialIndex = 0
  try { initialIndex = Math.max(0, Number(sessionStorage.getItem(`cards:${props.gameId}:${props.initialAssignment.playerId}`)) || 0) }
  catch { /* Storage is optional. */ }
  return <InfocardsPlayView runtime={runtime} initialIndex={initialIndex} onIndexChange={index => {
    try { sessionStorage.setItem(`cards:${props.gameId}:${runtime.assignment.playerId}`, String(index)) } catch { /* Storage is optional. */ }
  }} />
}

export function InfocardsPlayView({ runtime, initialIndex = 0, onIndexChange }: {
  runtime: ReturnType<typeof useMobilePlay>
  initialIndex?: number
  onIndexChange?: (index: number) => void
}) {
  const { t } = useParticipantLanguage()
  const { assignment, loaded, busy, error, refresh } = runtime
  const cards = assignment.cards ?? []
  const [mediaError, setMediaError] = useState(false)
  const [index, setIndex] = useState(initialIndex)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const current = cards.length ? Math.min(index, cards.length - 1) : 0
  const card = cards[current]
  const go = (delta: number) => {
    const next = Math.max(0, Math.min(cards.length - 1, current + delta))
    setMediaError(false)
    setIndex(next)
    onIndexChange?.(next)
  }
  return <section className="space-y-4" aria-label={t('Tarjetas informativas')}>
    {busy && <p role="status">{t('Cargando tarjetas…')}</p>}
    {error && <p role="alert" className="text-red-400">{t(error)}</p>}
    {(!loaded || error) && !busy && <button className={mobileActionClass} onClick={() => void refresh()}>{t('Reintentar carga')}</button>}
    {loaded && !cards.length && <p>{t('Todavía no hay tarjetas disponibles.')}</p>}
    {card && <>
      <article key={card.id} tabIndex={0} aria-roledescription={t('Tarjeta')}
        className="space-y-4 rounded-2xl border border-primary/30 p-4 outline-offset-4"
        onKeyDown={event => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); go(event.key === 'ArrowLeft' ? -1 : 1) }
        }}
        onTouchStart={event => {
          if (event.target instanceof Element && event.target.closest('video, button, a')) return
          const p = event.touches[0]
          touch.current = { x: p.clientX, y: p.clientY }
        }}
        onTouchEnd={event => {
          const start = touch.current
          touch.current = null
          const end = event.changedTouches[0]
          if (!start || !end) return
          const dx = end.clientX - start.x, dy = end.clientY - start.y
          if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
        }}>
        {card.videoUrl ? <video src={card.videoUrl} controls playsInline className="max-h-72 w-full rounded-xl" aria-label={card.title}
          onError={() => setMediaError(true)} />
          : card.imageUrl && <img src={card.imageUrl} alt={card.title} onError={() => setMediaError(true)} className="max-h-72 w-full rounded-xl object-cover"
            style={{ objectPosition: `${card.imagePositionX ?? 50}% ${card.imagePositionY ?? 50}%` }} />}
        {mediaError && <p role="alert">{t('No se pudo cargar el contenido multimedia. Puedes seguir leyendo las tarjetas.')}</p>}
        <h1 className="text-xl font-bold">{card.title}</h1>
        <p className="whitespace-pre-line break-words text-textSub">{card.body}</p>
      </article>
      <p role="status" aria-live="polite" className="text-center text-sm">{t('Tarjeta')} {current + 1} / {cards.length}</p>
      <nav className="flex gap-3" aria-label={t('Navegar tarjetas')}>
        <button className={mobileActionClass} disabled={current === 0} onClick={() => go(-1)}>{t('Anterior')}</button>
        <button className={mobileActionClass} disabled={current >= cards.length - 1} onClick={() => go(1)}>{t('Siguiente')}</button>
      </nav>
      <button className="min-h-12 w-full underline" disabled={busy} onClick={() => {
        setMediaError(false)
        void refresh()
      }}>{t('Actualizar tarjetas')}</button>
    </>}
  </section>
}
