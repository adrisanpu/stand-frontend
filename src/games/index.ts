import type { GameDefinition } from '../core/types'
import { empareja2Definition } from './empareja2/config'
import { t1merDefinition } from './t1mer/config'

export const games: GameDefinition[] = [empareja2Definition, t1merDefinition]

export function getGameById(id: string): GameDefinition | undefined {
  return games.find(g => g.id === id)
}

