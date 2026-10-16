import type { GameDefinition } from '../core/types'
import { empareja2Definition } from './empareja2/config'
import { t1merDefinition } from './t1mer/config'
import { rulet4Definition } from './rulet4/config'
import { l3trasDefinition } from './l3tras/config'
import { cupidoDefinition } from './cupido/config'
import { semaforoDefinition } from './semaforo/config'
import { infocardsDefinition } from './infocards/config'
import { impostorDefinition } from './impostor/config'
import { stackDefinition } from './stack/config'

export const games: GameDefinition[] = [empareja2Definition, t1merDefinition, rulet4Definition, l3trasDefinition, cupidoDefinition, semaforoDefinition, infocardsDefinition, impostorDefinition, stackDefinition]

export function getGameById(id: string): GameDefinition | undefined {
  const upper = id.toUpperCase()
  return games.find((g) => g.id === upper)
}
