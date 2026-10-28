import type { StackPrizePromotion } from '../../api/stackPrizes'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'
import PrizeSticker from '../../core/widgets/PrizeSticker'
import { stackPrizePromotions } from '../../core/widgets/stackPrizePromotions'

export default function StackPrizePromo({ rules }: {
  rules: StackPrizePromotion[]
}) {
  const { t } = useParticipantLanguage()
  const items = stackPrizePromotions(rules, t)
  if (items.length === 0) return null
  return <div aria-label={t('Premios en juego')} className="relative z-10 flex min-w-0 max-w-full pl-4 pr-24 -mb-8">
    <PrizeSticker items={items} current={0} compact inline nextLabel={t('Siguiente premio')} pauseLabel={t('Pausar premios')} resumeLabel={t('Reanudar premios')} />
  </div>
}
