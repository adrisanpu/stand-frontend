import { expect, it } from 'vitest'
import { stackPrizePromotions } from './stackPrizePromotions'
import type { StackPrizePromotion } from '../../api/stackPrizes'

const rules: StackPrizePromotion[] = [
  { condition: 'completed', names: ['Pizza'], prizes: [{ id: 'pizza', name: 'Pizza', imageUrl: '/pizza.png' }] },
  { condition: 'top_finish', topX: 3, names: ['Pizza', 'Bebida'], prizes: [{ id: 'pizza', name: 'Pizza' }, { id: 'drink', name: 'Bebida' }] },
  { condition: 'top_final', topX: 1, names: ['Copa'] },
  { condition: 'raffle', names: ['Sorpresa'] },
]
const t = (spanish: string) => spanish
it('deduplicates all promotional prizes for play without repeating an OR/AND selection', () => {
  const prizes = stackPrizePromotions(rules, t)
  expect(prizes.map((prize) => prize.name)).toEqual(['Pizza', 'Bebida', 'Copa', 'Sorpresa'])
  expect(prizes[0].imageUrl).toBe('/pizza.png')
  expect(prizes.every((prize) => prize.heading === '')).toBe(true)
})
it('maps each widget to its own conditions and preserves distinct ranking labels', () => {
  expect(stackPrizePromotions(rules, t, ['completed']).map((prize) => prize.name)).toEqual(['Pizza'])
  expect(stackPrizePromotions(rules, t, ['raffle']).map((prize) => prize.name)).toEqual(['Sorpresa'])
  const ranking = stackPrizePromotions(rules, t, ['top_finish', 'top_final'])
  expect(ranking.map((prize) => prize.heading)).toEqual(['TOP 3', 'TOP 3', 'TOP FINAL 1'])
})
