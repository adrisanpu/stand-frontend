import { expect, it } from 'vitest'
import { stackPrizePromotions } from './stackPrizePromotions'
import type { StackPrizePromotion } from '../../api/stackPrizes'

const rules: StackPrizePromotion[] = [
  { condition: 'completed', names: ['Pizza'], prizes: [{ id: 'pizza', name: 'Pizza', imageUrl: '/pizza.png' }] },
  { condition: 'top_finish', topX: 3, names: ['Pizza', 'Bebida'], prizes: [{ id: 'pizza', name: 'Pizza' }, { id: 'drink', name: 'Bebida' }] },
  { condition: 'top_final', topX: 1, names: ['Copa'] },
  { condition: 'score', scoreOperator: 'between', scoreValue: 10, scoreMaxValue: 20, names: ['Medalla'] },
  { condition: 'raffle', names: ['Sorpresa'] },
]
const t = (spanish: string) => spanish
it('deduplicates all promotional prizes for play without repeating an OR/AND selection', () => {
  const prizes = stackPrizePromotions(rules, t)
  expect(prizes.map((prize) => prize.name)).toEqual(['Pizza', 'Bebida', 'Copa', 'Medalla', 'Sorpresa'])
  expect(prizes[3].heading).toBe('Puntuación entre 10 y 20')
  expect(prizes[0].imageUrl).toBe('/pizza.png')
  expect(prizes.slice(0, 3).every((prize) => prize.heading === '')).toBe(true)
  expect(prizes[4].heading).toBe('')
})
it('maps each widget to its own conditions and preserves distinct ranking labels', () => {
  expect(stackPrizePromotions(rules, t, ['completed']).map((prize) => prize.name)).toEqual(['Pizza'])
  expect(stackPrizePromotions(rules, t, ['raffle']).map((prize) => prize.name)).toEqual(['Sorpresa'])
  const ranking = stackPrizePromotions(rules, t, ['top_finish', 'top_final'])
  expect(ranking.map((prize) => prize.heading)).toEqual(['TOP 3', 'TOP 3', 'TOP FINAL 1'])
})
