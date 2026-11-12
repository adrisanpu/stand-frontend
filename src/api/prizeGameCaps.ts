import { fetchPrizeGame, savePrizeCatalog } from './prizeMedia'
import { stackPrizeApi } from './stackPrizes'

const slots = ['validation', 'ranking', 'raffle'] as const

/** Sets the per-event cap of a shared prize, wherever that event stores it (prize slots or Stack catalog). */
export async function saveGamePrizeCap(gameId: string, prizeId: string, limit: number | null) {
  const game = await fetchPrizeGame(gameId)
  if (!game.ok) throw new Error('Could not load event')
  const catalog = { ...(game.prizeCatalog ?? {}) }
  const linked = slots.filter(slot => catalog[slot]?.sharedPrizeId === prizeId)
  if (linked.length) {
    for (const slot of linked) catalog[slot] = { ...catalog[slot]!, limit }
    await savePrizeCatalog(gameId, catalog)
    return
  }
  const stack = await stackPrizeApi.get(gameId)
  const program = stack.program
  const matches = (item: (typeof program.catalog)[number]) =>
    item.sharedPrizeId === prizeId || item.id === prizeId || item.rewardId === prizeId
  if (!program?.catalog?.some(matches)) throw new Error('Prize not linked to this event')
  await stackPrizeApi.save(gameId, {
    ...program, catalog: program.catalog.map(item => matches(item) ? { ...item, stockTotal: limit } : item),
  })
}
