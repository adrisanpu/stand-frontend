import type { GamePrize } from '../prizes'
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
}

export default function PrizeSticker({ prize, label, current, max, compact = false, topX, inline = false, heading }: PrizeStickerProps) {
  const { t } = useOperatorLanguage()
  if (!label && !prize?.imageUrl) return null

  return (
    <div
      className={`relative z-10 ${inline ? 'self-start' : 'self-end'} flex shrink-0 items-center gap-2 max-w-full min-w-0 rounded-full border-2 border-primary bg-[var(--color-background,#0B0A12)] bg-[linear-gradient(var(--color-surface),var(--color-surface))] shadow-lg pr-4 ${compact ? 'h-16' : 'h-20'} ${inline ? '' : compact ? '-mb-8' : '-mb-10'}`}
    >
      {prize?.imageUrl && (
        <div className="shrink-0 rounded-full bg-primary flex items-center justify-center p-1 h-full aspect-square">
          <PrizeImage prize={prize} className="h-full w-full object-contain" />
        </div>
      )}
      <div className={`min-w-0 py-1 ${prize?.imageUrl ? '' : 'pl-4'}`}>
        <p title={label} className={`font-bold text-textMain break-words [overflow-wrap:anywhere] line-clamp-2 ${HOME_BODY_TEXT}`}>
          {heading ?? (topX != null ? `${t('PREMIO TOP', 'TOP PRIZE')} ${topX}` : t('PREMIO', 'PRIZE'))}: {label}
        </p>
        {max !== undefined && (
          <p className={`font-semibold text-textMain tabular-nums ${HOME_BODY_TEXT}`}>
            {current}/{max}
          </p>
        )}
      </div>
    </div>
  )
}
