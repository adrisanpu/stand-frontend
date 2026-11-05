import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { prizeInventoryApi } from './prizeInventory'

vi.mock('./api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks() })

it('encodes movement cursors and prize IDs, preserving null redemptions in summaries', async () => {
  const summary = { ok: true, mode: 'active', imports: {}, unresolved: 0, catalog: [{ canjeados: null }] }
  vi.mocked(api.get).mockResolvedValueOnce(summary).mockResolvedValueOnce({ ok: true, items: [], cursor: null })
  expect(await prizeInventoryApi.get()).toEqual(summary)
  await prizeInventoryApi.movements('gift & coffee', 'page+/=')
  expect(api.get).toHaveBeenLastCalledWith('/v1/prizes/inventory?prizeId=gift+%26+coffee&cursor=page%2B%2F%3D')
})

it('sends the exact idempotent adjustment payload and import cursors', async () => {
  const balance = { available: 0, initialized: true, revision: 2 }
  vi.mocked(api.post).mockResolvedValueOnce({ ok: true, inventory: balance })
    .mockResolvedValueOnce({ ok: true, cursor: 'next', unresolved: 1 })
    .mockResolvedValueOnce({ ok: true })
  const payload = { action: 'adjust' as const, prizeId: 'gift', quantity: -1, reason: 'Count', requestId: 'stable', expectedRevision: 1 }
  expect(await prizeInventoryApi.change(payload)).toEqual(balance)
  expect(api.post).toHaveBeenLastCalledWith('/v1/prizes/inventory', payload)
  await prizeInventoryApi.importHistory('game', 'cursor')
  expect(api.post).toHaveBeenLastCalledWith('/v1/prizes/inventory', { action: 'import', gameId: 'game', cursor: 'cursor' })
  await prizeInventoryApi.activate()
  expect(api.post).toHaveBeenLastCalledWith('/v1/prizes/inventory', { action: 'activate' })
})

it('rejects unconfirmed writes and invalid page responses', async () => {
  vi.mocked(api.post).mockResolvedValue({ ok: false })
  vi.mocked(api.get).mockResolvedValue({ ok: true })
  await expect(prizeInventoryApi.activate()).rejects.toThrow('not confirmed')
  await expect(prizeInventoryApi.importHistory('game')).rejects.toThrow('not confirmed')
  await expect(prizeInventoryApi.movements('gift')).rejects.toThrow('Invalid movements')
  await expect(prizeInventoryApi.get()).rejects.toThrow('Invalid prize inventory')
})
