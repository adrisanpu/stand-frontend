import type { StackPrizeCondition, StackPrizePromotion } from '../../api/stackPrizes'
import type { GamePrize } from '../prizes'

export type StickerPrize = GamePrize & { id: string; heading: string }

export function stackPrizePromotions(
  rules: StackPrizePromotion[],
  t: (spanish: string, english?: string) => string,
  conditions?: StackPrizeCondition[],
): StickerPrize[] {
  const result = new Map<string, StickerPrize>()
  for (const rule of rules) {
    if (conditions && !conditions.includes(rule.condition)) continue
    const heading = !conditions ? ''
      : rule.condition === 'top_final' ? `${t('TOP FINAL', 'FINAL TOP')} ${rule.topX ?? ''}`.trim()
        : rule.condition === 'top_finish' ? `TOP ${rule.topX ?? ''}`.trim()
          : ''
    const prizes = rule.prizes ?? rule.names.map((name) => ({ id: name, name }))
    for (const prize of prizes) {
      const key = conditions ? `${rule.condition}:${rule.topX ?? ''}:${prize.id}` : prize.id
      if (!result.has(key)) result.set(key, { ...prize, id: key, limit: null, heading })
    }
  }
  return [...result.values()]
}
