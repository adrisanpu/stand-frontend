import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { getHomeCanvas, saveHomeCanvas } from './homeCanvas'
import { initialHomeCanvas } from '../core/home/canvasModel'

vi.mock('./api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
const homeCanvas = initialHomeCanvas(true, true)
const response = () => ({
  ok: true, gameId: 'EVENT', gameType: 'T1MER', homeCanvas, homeRevision: 'revision',
  homeBackgroundUrls: { landscape: null, portrait: null }, readOnly: false,
})
beforeEach(() => { vi.clearAllMocks() })
it('reads the dedicated contract and rejects malformed/foreign responses', async () => {
  vi.mocked(api.get).mockResolvedValue(response())
  expect((await getHomeCanvas('EVENT')).homeCanvas).toEqual(homeCanvas)
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=EVENT&home=true')
  vi.mocked(api.get).mockResolvedValue({ ...response(), gameId: 'OTHER' })
  await expect(getHomeCanvas('EVENT')).rejects.toThrow('Invalid')
})
it('sends independent expected revision and verifies actual saved content regardless of object key order', async () => {
  const reversed = JSON.parse(JSON.stringify(response(), (_key, value) =>
    value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).reverse()) : value))
  vi.mocked(api.put).mockResolvedValue(reversed)
  await saveHomeCanvas('EVENT', homeCanvas, 'previous')
  expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'EVENT', homeCanvas, expectedHomeRevision: 'previous' })
  vi.mocked(api.put).mockResolvedValue({ ...response(), homeCanvas: initialHomeCanvas(false, false) })
  await expect(saveHomeCanvas('EVENT', homeCanvas, 'previous')).rejects.toThrow('not confirmed')
})
