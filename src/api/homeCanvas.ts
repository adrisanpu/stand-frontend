import { api } from './api'
import { validateHomeCanvas, type HomeCanvasConfig, type HomeBackgroundUrls } from '../core/home/canvasModel'

export type HomeCanvasResponse = {
  ok: true
  gameId: string
  gameType: string
  homeCanvas: HomeCanvasConfig
  homeRevision: string
  homeBackgroundUrls: HomeBackgroundUrls
  readOnly: boolean
  showRaffleOnHome?: boolean
}
function confirmed(value: HomeCanvasResponse, gameId: string): HomeCanvasResponse {
  if (value?.ok !== true || value.gameId !== gameId || typeof value.gameType !== 'string'
    || !validateHomeCanvas(value.homeCanvas) || !value.homeRevision || typeof value.readOnly !== 'boolean'
    || !value.homeBackgroundUrls || !(['landscape', 'portrait'] as const).every(orientation =>
      value.homeBackgroundUrls[orientation] === null || typeof value.homeBackgroundUrls[orientation] === 'string')) {
    throw new Error('Invalid home canvas response')
  }
  return value
}
export async function getHomeCanvas(gameId: string): Promise<HomeCanvasResponse> {
  return confirmed(await api.get(`/v1/game?gameId=${encodeURIComponent(gameId)}&home=true`), gameId)
}
export async function saveHomeCanvas(gameId: string, homeCanvas: HomeCanvasConfig, expectedHomeRevision: string): Promise<HomeCanvasResponse> {
  if (!validateHomeCanvas(homeCanvas)) throw new Error('Invalid home canvas')
  const result = confirmed(await api.put('/v1/game', { gameId, homeCanvas, expectedHomeRevision }), gameId)
  if ((['landscape', 'portrait'] as const).some(orientation => {
    const saved = result.homeCanvas[orientation], requested = homeCanvas[orientation]
    return saved.background?.key !== requested.background?.key || saved.background?.type !== requested.background?.type
      || saved.items.length !== requested.items.length
      || saved.items.some((item, index) => {
        const previous = requested.items[index]
        return (Object.keys({ ...item, ...previous }) as (keyof typeof item)[]).some(key => item[key] !== previous[key])
      })
  })) {
    throw new Error('Home canvas saving was not confirmed')
  }
  return result
}
