import { useEffect, useState } from 'react'
import type { StackPrizePromotion } from '../../api/stackPrizes'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'
import PrizeSticker from '../../core/widgets/PrizeSticker'
import { stackPrizePromotions } from '../../core/widgets/stackPrizePromotions'

function ClosingCountdown({ closesAt, label }: { closesAt: number; label: string }) {
  const remaining = () => Math.max(0, Math.ceil(closesAt - Date.now() / 1000))
  const [seconds, setSeconds] = useState(remaining)
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.ceil(closesAt - Date.now() / 1000)))
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [closesAt])
  const values = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
  return <p role="timer" aria-label={label} aria-live="off" className="truncate text-[10px] tabular-nums text-textSub">
    {label} {values.map(value => String(value).padStart(2, '0')).join(':')}
  </p>
}

export default function StackPrizePromo({ rules, closesAt, state = 'open' }: {
  rules: StackPrizePromotion[]
  closesAt?: number
  state?: 'open' | 'closing' | 'closed'
}) {
  const { t, language } = useParticipantLanguage()
  const items = stackPrizePromotions(rules, (es, en) => language === 'en' && en ? en : es, undefined, true)
  if (items.length === 0) return null
  return <div aria-label={t('Premios en juego')} className="relative z-10 flex min-w-0 max-w-full pl-4 pr-24 -mb-8">
    <PrizeSticker items={items} current={0} compact inline nextLabel={t('Siguiente premio')} pauseLabel={t('Pausar premios')} resumeLabel={t('Reanudar premios')}
      itemDetail={item => item.condition !== 'top_final' ? null : state !== 'open'
        ? <p role="status" className="text-[10px] text-textSub">{t(state === 'closed' ? 'Cerrado' : 'Cerrando')}</p>
        : closesAt !== undefined ? <ClosingCountdown closesAt={closesAt} label={t('Cierra en')} /> : null} />
  </div>
}
