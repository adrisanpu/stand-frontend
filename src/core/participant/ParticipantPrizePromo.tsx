import type { PrizeCatalog, PrizeSlot } from '../prizes'
import PrizePresentation from '../widgets/PrizePresentation'
import PrizeSticker from '../widgets/PrizeSticker'
import { useParticipantLanguage } from './participantLanguage'

const LABELS: Record<PrizeSlot, string> = {
  validation: 'Premio por pareja',
  ranking: 'Premio del ranking',
  raffle: 'Premio del sorteo',
}

export default function ParticipantPrizePromo({
  catalog,
  slots = ['validation', 'ranking'],
  stickers = false,
}: {
  catalog?: PrizeCatalog
  slots?: PrizeSlot[]
  stickers?: boolean
}) {
  const { t } = useParticipantLanguage()
  const available = slots.filter((slot) => {
    const prize = catalog?.[slot]
    return prize && prize.limit !== 0 && (prize.name || prize.imageUrl)
  })
  if (available.length === 0) return null
  if (stickers) return (
    <div aria-label={t('Premios en juego')} className="relative z-10 flex flex-col items-start gap-2 pl-4 pr-24 -mb-8 min-w-0 max-w-full">
      {available.map((slot) => (
        <PrizeSticker
          key={slot}
          prize={catalog?.[slot]}
          label={catalog?.[slot]?.name}
          heading={slot === 'ranking' && catalog?.ranking?.topX != null
            ? `${t('PREMIO TOP')} ${catalog.ranking.topX}`
            : t('PREMIO')}
          current={0}
          compact
          inline
        />
      ))}
    </div>
  )
  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <h2 className="text-center text-lg font-bold">{t('Premios en juego')}</h2>
      {available.map((slot) => (
        <PrizePresentation key={slot} prize={catalog?.[slot]} label={
          slot === 'ranking' && catalog?.ranking?.topX != null
            ? `${t('Premio del ranking')} · Top ${catalog.ranking.topX}`
            : t(LABELS[slot])
        } />
      ))}
    </div>
  )
}
