import type { StackPrizeCondition, StackPrizePromotion } from '../../api/stackPrizes'
import type { GamePrize } from '../prizes'

export type StickerPrize = GamePrize & { id: string; heading: string; condition?: StackPrizeCondition }

export function stackPrizePromotions(
  rules: StackPrizePromotion[],
  t: (spanish: string, english?: string) => string,
  conditions?: StackPrizeCondition[],
  participant = false,
): StickerPrize[] {
  const result = new Map<string, StickerPrize>()
  for (const rule of rules) {
    if (conditions && !conditions.includes(rule.condition)) continue
    const heading = rule.condition === 'score' && rule.scoreOperator
      ? rule.scoreOperator === 'between'
        ? t(`Puntuación entre ${rule.scoreValue} y ${rule.scoreMaxValue}`, `Score between ${rule.scoreValue} and ${rule.scoreMaxValue}`)
        : t(`Puntuación ${rule.scoreOperator} ${rule.scoreValue}`, `Score ${rule.scoreOperator} ${rule.scoreValue}`)
      : participant ? {
        completed: t('Completa la partida', 'Finish the game'),
        top_finish: t(`Top ${rule.topX} al terminar`, `Top ${rule.topX} at finish`),
        top_final: t(`Top ${rule.topX} al cerrar`, `Top ${rule.topX} at closing`),
        raffle: t('Gana un sorteo', 'Win a raffle'),
        score: '',
      }[rule.condition]
      : !conditions ? ''
        : rule.condition === 'top_final' ? `${t('TOP FINAL', 'FINAL TOP')} ${rule.topX ?? ''}`.trim()
        : rule.condition === 'top_finish' ? `TOP ${rule.topX ?? ''}`.trim()
          : ''
    const prizes = rule.prizes ?? rule.names.map((name) => ({ id: name, name }))
    for (const prize of prizes) {
      const key = conditions || participant
        ? `${rule.condition}:${rule.topX ?? ''}:${rule.scoreOperator ?? ''}:${rule.scoreValue ?? ''}:${rule.scoreMaxValue ?? ''}:${prize.id}`
        : rule.condition === 'score'
          ? `${rule.condition}:${rule.scoreOperator ?? ''}:${rule.scoreValue ?? ''}:${rule.scoreMaxValue ?? ''}:${prize.id}`
          : prize.id
      if (!result.has(key)) result.set(key, { ...prize, id: key, limit: null, heading, ...(participant && { condition: rule.condition }) })
    }
  }
  return [...result.values()]
}
