import { expect, it } from 'vitest'
import { games } from '../../games'
import { IDEAL_FOR_LABELS } from '../types'
import { catalogEnglish } from './operatorCatalogText'

it('provides English descriptions and venue tags for every catalog game', () => {
  for (const game of games) {
    for (const description of [game.description, game.descriptionLong]) {
      if (description) expect(catalogEnglish[description], `${game.id}: ${description}`).toBeTruthy()
    }
    for (const venue of game.tags?.idealFor ?? []) {
      expect(catalogEnglish[IDEAL_FOR_LABELS[venue]]).toBeTruthy()
    }
  }
})
