import type { GamePrize } from '../prizes'

export function PrizeImage({ prize, compact = false }: { prize?: GamePrize; compact?: boolean }) {
  if (!prize?.imageUrl) return null
  return (
    <img
      src={prize.imageUrl}
      alt={prize.name}
      className={compact
        ? 'h-14 w-14 shrink-0 rounded-lg object-contain'
        : 'mx-auto h-32 w-full max-w-48 rounded-xl object-contain'}
    />
  )
}

export default function PrizePresentation({ prize, label }: { prize?: GamePrize; label?: string }) {
  if (!prize || (!prize.name && !prize.imageUrl)) return null
  return (
    <div className="space-y-2 text-center">
      {label && <p className="text-sm text-textSub">{label}</p>}
      <PrizeImage prize={prize} />
      {prize.name && <p className="font-semibold break-words">{prize.name}</p>}
    </div>
  )
}
