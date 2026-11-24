export type PrizeSlot = 'validation' | 'ranking' | 'raffle'

export type GamePrize = {
  name: string
  limit: number | null
  sharedPrizeId?: string
  topX?: number
  imageKey?: string | null
  imageUrl?: string | null
}

export type PrizeCatalog = Partial<Record<PrizeSlot, GamePrize>>
