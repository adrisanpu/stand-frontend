import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { prizeInventoryApi } from './prizeInventory'

vi.mock('./api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks() })

it('encodes movement cursors and prize IDs, preserving null redemptions in summaries', async () => {
  const summary = { ok: true, mode: 'reservations', imports: {}, unresolved: 0, catalog: [{ canjeados: null }] }
  vi.mocked(api.get).mockResolvedValueOnce(summary).mockResolvedValueOnce({ ok: true, items: [], cursor: null })
  expect(await prizeInventoryApi.get()).toEqual(summary)
  await prizeInventoryApi.movements('gift & coffee', 'page+/=')
  expect(api.get).toHaveBeenLastCalledWith('/v1/prizes/inventory?prizeId=gift+%26+coffee&cursor=page%2B%2F%3D')
})

it('sends deletion payloads and opaque import cursors', async () => {
  vi.mocked(api.post).mockResolvedValueOnce({ ok: true, cursor: 'next', unresolved: 1 })
    .mockResolvedValueOnce({ ok: true })
  await prizeInventoryApi.importHistory('game', 'cursor')
  expect(api.post).toHaveBeenLastCalledWith('/v1/prizes/inventory', { action: 'import', gameId: 'game', cursor: 'cursor' })
  await prizeInventoryApi.removeKivlyPrize('coffee')
  expect(api.post).toHaveBeenLastCalledWith('/v1/prizes/inventory', { action: 'delete', prizeId: 'coffee' })
})

it('rejects unconfirmed writes and invalid page responses', async () => {
  vi.mocked(api.post).mockResolvedValue({ ok: false })
  vi.mocked(api.get).mockResolvedValue({ ok: true })
  await expect(prizeInventoryApi.removeKivlyPrize('coffee')).rejects.toThrow('not confirmed')
  await expect(prizeInventoryApi.importHistory('game')).rejects.toThrow('not confirmed')
  await expect(prizeInventoryApi.movements('gift')).rejects.toThrow('Invalid movements')
  await expect(prizeInventoryApi.get()).rejects.toThrow('Invalid prize inventory')
})
