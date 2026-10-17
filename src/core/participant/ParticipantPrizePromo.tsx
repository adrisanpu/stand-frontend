import type { PrizeCatalog, PrizeSlot } from '../prizes'
import PrizePresentation from '../widgets/PrizePresentation'
import { useParticipantLanguage } from './participantLanguage'

const LABELS: Record<PrizeSlot, string> = {
  validation: 'Premio por pareja',
  ranking: 'Premio del ranking',
  raffle: 'Premio del sorteo',
}

export default function ParticipantPrizePromo({
  catalog,
  slots = ['validation', 'ranking'],
}: {
  catalog?: PrizeCatalog
  slots?: PrizeSlot[]
}) {
  const { t } = useParticipantLanguage()
  const available = slots.filter((slot) => {
    const prize = catalog?.[slot]
    return prize && prize.limit !== 0 && (prize.name || prize.imageUrl)
  })
  if (available.length === 0) return null
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
