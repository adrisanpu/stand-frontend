import type { StackPrizeCondition } from '../../api/stackPrizes'
import { useParticipantLanguage } from '../../core/participant/participantLanguage'

export default function StackPrizeSummary({ rules }: {
  rules: { condition: StackPrizeCondition; topX?: number; names: string[] }[]
}) {
  const { t } = useParticipantLanguage()
  const labels: Record<StackPrizeCondition, string> = {
    completed: t('Por completar la partida'),
    top_finish: t('Top al terminar tu partida'),
    top_final: t('Top al cerrar el juego'),
    raffle: t('Por ganar el sorteo'),
  }
  if (rules.length === 0) return null
  return <section aria-label={t('Premios en juego')} className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 text-sm">
    {rules.map((r, i) => <p key={i}><span className="font-semibold text-accent">{labels[r.condition]}{r.topX ? ` ${r.topX}` : ''}</span>
      <span className="text-textSub"> · {r.names.join(' + ')}</span></p>)}
  </section>
}
