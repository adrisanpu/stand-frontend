import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { getHomeCanvas, saveHomeCanvas } from './homeCanvas'
import { HOME_STYLE_FIELDS, initialHomeCanvas } from '../core/home/canvasModel'

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
it('confirms every canvas style field in both orientations instead of accepting lost settings', async () => {
  const requested = initialHomeCanvas(true, true)
  requested.landscape = { ...requested.landscape, backgroundColor: '#123456', color: '#ffffff', accentColor: '#abcdef', fontSize: 96, bold: true }
  requested.portrait = { ...requested.portrait, backgroundColor: '#654321', color: '#eeeeee', accentColor: '#fedcba', fontSize: 24, bold: false }
  vi.mocked(api.put).mockResolvedValue({ ...response(), homeCanvas: structuredClone(requested) })
  expect((await saveHomeCanvas('EVENT', requested, 'previous')).homeCanvas).toEqual(requested)
  for (const orientation of ['landscape', 'portrait'] as const) for (const key of HOME_STYLE_FIELDS) {
    const returned = structuredClone(requested)
    delete returned[orientation][key]
    vi.mocked(api.put).mockResolvedValue({ ...response(), homeCanvas: returned })
    await expect(saveHomeCanvas('EVENT', requested, 'previous')).rejects.toThrow('not confirmed')
  }
})
