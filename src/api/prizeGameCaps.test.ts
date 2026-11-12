import { beforeEach, expect, it, vi } from 'vitest'
import { fetchPrizeGame, savePrizeCatalog } from './prizeMedia'
import { stackPrizeApi } from './stackPrizes'
import { saveGamePrizeCap } from './prizeGameCaps'

vi.mock('./prizeMedia', () => ({ fetchPrizeGame: vi.fn(), savePrizeCatalog: vi.fn() }))
vi.mock('./stackPrizes', () => ({ stackPrizeApi: { get: vi.fn(), save: vi.fn() } }))

beforeEach(() => { vi.resetAllMocks() })

it('updates every prize slot linked to the shared prize', async () => {
  vi.mocked(fetchPrizeGame).mockResolvedValue({ ok: true, prizeCatalog: {
    validation: { name: 'Gift', limit: 2, sharedPrizeId: 'gift' },
    ranking: { name: 'Cup', limit: 1, sharedPrizeId: 'cup', topX: 3 },
  } })
  await saveGamePrizeCap('event', 'gift', null)
  expect(savePrizeCatalog).toHaveBeenCalledWith('event', {
    validation: { name: 'Gift', limit: null, sharedPrizeId: 'gift' },
    ranking: { name: 'Cup', limit: 1, sharedPrizeId: 'cup', topX: 3 },
  })
  expect(stackPrizeApi.get).not.toHaveBeenCalled()
})

it('falls back to the Stack catalog and rejects unlinked prizes', async () => {
  vi.mocked(fetchPrizeGame).mockResolvedValue({ ok: true, prizeCatalog: null })
  const program = { version: 3 as const, rules: [], storefrontUrl: '', catalog: [
    { id: 'a', source: 'stand' as const, name: 'Gift', sharedPrizeId: 'gift', stockTotal: 5 },
    { id: 'b', source: 'stand' as const, name: 'Other', stockTotal: 1 },
  ] }
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ program } as never)
  await saveGamePrizeCap('stack', 'gift', 8)
  expect(stackPrizeApi.save).toHaveBeenCalledWith('stack', { ...program, catalog: [
    { ...program.catalog[0], stockTotal: 8 }, program.catalog[1],
  ] })
  await expect(saveGamePrizeCap('stack', 'missing', 1)).rejects.toThrow('Prize not linked')
})
