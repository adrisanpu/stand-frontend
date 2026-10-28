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

  return (
    <div
      className={`relative z-10 ${inline ? 'self-start' : 'self-end'} flex shrink-0 items-center gap-2 max-w-full min-w-0 rounded-full border-2 border-primary bg-[var(--color-background,#0B0A12)] bg-[linear-gradient(var(--color-surface),var(--color-surface))] shadow-lg pr-4 ${items ? 'w-72 overflow-hidden' : ''} ${compact ? 'h-16' : 'h-20'} ${inline ? '' : compact ? '-mb-8' : '-mb-10'}`}
    >
      {prize?.imageUrl && (
        <div key={`${item?.id ?? 'prize'}-image`} className={`shrink-0 rounded-full bg-primary flex items-center justify-center p-1 h-full aspect-square ${items && items.length > 1 ? 'prize-catalog-slide' : ''}`}>
          <PrizeImage prize={prize} className="h-full w-full object-contain" />
        </div>
      )}
      <div key={item?.id ?? 'label'} className={`min-w-0 py-1 ${prize?.imageUrl ? '' : 'pl-4'} ${items && items.length > 1 ? 'prize-catalog-slide' : ''}`}>
        <p title={label} className={`font-bold text-textMain break-words [overflow-wrap:anywhere] line-clamp-2 ${HOME_BODY_TEXT}`}>
          {items
            ? <>{heading && `${heading}: `}{label}</>
            : <>{heading ?? (topX != null ? `${t('PREMIO TOP', 'TOP PRIZE')} ${topX}` : t('PREMIO', 'PRIZE'))}: {label}</>}
        </p>
        {max !== undefined && (
          <p className={`font-semibold text-textMain tabular-nums ${HOME_BODY_TEXT}`}>
            {current}/{max}
          </p>
        )}
      </div>
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
