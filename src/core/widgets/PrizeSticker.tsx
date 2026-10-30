import { useEffect, useState } from 'react'
import type { GamePrize } from '../prizes'
import type { StickerPrize } from './stackPrizePromotions'
import { useOperatorLanguage } from '../shell/operatorLanguage'
import { PrizeImage } from './PrizePresentation'
import { HOME_BODY_TEXT } from '../ui/homeTypography'

interface PrizeStickerProps {
  prize?: GamePrize
  label?: string
  current: number
  max?: number
  compact?: boolean
  topX?: number
  inline?: boolean
  heading?: string
  items?: StickerPrize[]
  nextLabel?: string
  pauseLabel?: string
  resumeLabel?: string
}

export default function PrizeSticker({ prize, label, current, max, compact = false, topX, inline = false, heading, items, nextLabel, pauseLabel, resumeLabel }: PrizeStickerProps) {
  const { t } = useOperatorLanguage()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const itemKey = items?.map((item) => item.id).join('|')
  const count = items?.length ?? 0
  useEffect(() => {
    setIndex(0)
  }, [itemKey])
  useEffect(() => {
    if (count < 2 || paused) return
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let timer: ReturnType<typeof setInterval> | undefined
    const update = () => {
      if (timer) clearInterval(timer)
      if (!media?.matches) timer = setInterval(() => setIndex((previous) => (previous + 1) % count), 4000)
    }
    update()
    media?.addEventListener?.('change', update)
    return () => { if (timer) clearInterval(timer); media?.removeEventListener?.('change', update) }
  }, [count, paused])
  const item = items?.[index % Math.max(items.length, 1)]
  if (items) {
    if (!item) return null
    prize = item
    label = item.name
    heading = item.heading
    max = undefined
  }
  if (!label && !prize?.imageUrl) return null
  const sliding = Boolean(items && items.length > 1)
  const badge = items
    ? heading
    : heading ?? (topX != null ? `${t('PREMIO TOP', 'TOP PRIZE')} ${topX}` : t('PREMIO', 'PRIZE'))

  return (
    <div
      data-testid="prize-sticker"
      className={`relative z-10 ${inline ? 'self-start' : 'self-end'} flex w-72 shrink-0 items-center gap-3 max-w-full min-w-0 overflow-hidden rounded-full border-2 border-primary bg-[var(--color-background,#0B0A12)] bg-[linear-gradient(var(--color-surface),var(--color-surface))] shadow-lg p-1 pr-4 ${compact ? 'h-16' : 'h-20'} ${inline ? '' : compact ? '-mb-8' : '-mb-10'}`}
    >
      <div key={`${item?.id ?? 'prize'}-image`} data-testid="prize-sticker-art" className={`shrink-0 overflow-hidden rounded-full bg-primary flex items-center justify-center p-1 h-full aspect-square ${sliding ? 'prize-catalog-slide' : ''}`}>
        {prize?.imageUrl
          ? <PrizeImage prize={prize} className="h-full w-full object-contain" />
          : <svg aria-hidden="true" className="h-1/2 w-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112-2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>}
      </div>
      <div key={item?.id ?? 'label'} className={`min-w-0 flex-1 ${sliding ? 'prize-catalog-slide' : ''}`}>
        {label
          ? <p title={label} className={`font-bold leading-tight text-textMain break-words [overflow-wrap:anywhere] line-clamp-2 ${HOME_BODY_TEXT}`}>
              {badge && <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-primary">{badge}<span className="sr-only">: </span></span>}
              <span className={badge ? 'line-clamp-1' : 'line-clamp-2'}>{label}</span>
            </p>
          : badge && <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-primary">{badge}</p>}
        {sliding && <div aria-hidden="true" className="mt-1 flex gap-1">
          {items!.map((entry, position) => <span key={entry.id}
            className={`h-1 rounded-full transition-all ${position === index % items!.length ? 'w-3 bg-primary' : 'w-1 bg-white/30'}`} />)}
        </div>}
      </div>
      {max !== undefined && (
        <p className={`shrink-0 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 font-semibold text-textMain tabular-nums ${HOME_BODY_TEXT}`}>
          {current}/{max}
        </p>
      )}
      {items && items.length > 1 && <div className="sr-only focus-within:not-sr-only shrink-0 ml-auto flex">
        <button type="button" className="rounded-full p-1 text-xs hover:bg-primary/20" aria-pressed={paused}
          aria-label={paused ? resumeLabel ?? t('Reanudar premios', 'Resume prizes') : pauseLabel ?? t('Pausar premios', 'Pause prizes')}
          onClick={() => setPaused((previous) => !previous)}>{paused ? resumeLabel ?? t('Reanudar premios', 'Resume prizes') : pauseLabel ?? t('Pausar premios', 'Pause prizes')}</button>
        <button type="button" className="rounded-full p-1 text-xs hover:bg-primary/20"
          aria-label={nextLabel ?? t('Siguiente premio', 'Next prize')} onClick={() => setIndex((previous) => (previous + 1) % items.length)}>{nextLabel ?? t('Siguiente premio', 'Next prize')}</button>
      </div>}
    </div>
  )
}
