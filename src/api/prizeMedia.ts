import { api } from './api'
import type { GamePrize, PrizeCatalog, PrizeSlot } from '../core/prizes'

export const MAX_PRIZE_IMAGE_BYTES = 5 * 1024 * 1024

export class PrizeImageError extends Error {
  constructor(public code: 'type' | 'size' | 'invalid') {
    super(code)
  }
}

export type PrizeGameResponse = {
  ok: boolean
  prizeCatalog?: PrizeCatalog | null
  settings?: { empareja2?: { maxValidations?: number } }
}

export function fetchPrizeGame(gameId: string): Promise<PrizeGameResponse> {
  return api.get(`/v1/game?gameId=${encodeURIComponent(gameId)}`)
}

function readBytes(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(new PrizeImageError('invalid'))
    reader.readAsArrayBuffer(file)
  })
}

/** Local signature and browser decoding checks; never uploads the selected file. */
export async function validatePrizeImage(file: File): Promise<void> {
  if (!/\.png$/i.test(file.name) || file.type !== 'image/png') throw new PrizeImageError('type')
  if (file.size > MAX_PRIZE_IMAGE_BYTES) throw new PrizeImageError('size')
  const bytes = new Uint8Array(await readBytes(file))
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!signature.every((byte, index) => bytes[index] === byte)) throw new PrizeImageError('invalid')
  const url = URL.createObjectURL(file)
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0
        ? resolve()
        : reject(new PrizeImageError('invalid'))
      image.onerror = () => reject(new PrizeImageError('invalid'))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadPrizeImage(gameId: string, slot: PrizeSlot, file: File): Promise<string> {
  const result = await api.post<{ ok: boolean; key: string; uploadUrl: string }>(
    '/v1/game/prizes?action=upload-url',
    { gameId, slot, fileName: file.name, contentType: 'image/png', sizeBytes: file.size },
  )
  if (!result.ok || !result.key || !result.uploadUrl) throw new Error('No upload URL received')
  const response = await fetch(result.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png', 'x-amz-tagging': 'staged=true' },
    body: file,
  })
  if (!response.ok) throw new Error(`Upload failed (${response.status})`)
  return result.key
}

export async function savePrizeCatalog(gameId: string, catalog: PrizeCatalog): Promise<void> {
  const prizeCatalog: PrizeCatalog = {}
  for (const slot of ['validation', 'ranking', 'raffle'] as const) {
    const prize = catalog[slot]
    if (!prize) continue
    const durable: GamePrize = { name: prize.name, limit: prize.limit }
    if (prize.topX !== undefined) durable.topX = prize.topX
    if (prize.imageKey !== undefined) durable.imageKey = prize.imageKey
    prizeCatalog[slot] = durable
  }
  const result = await api.put<{ ok?: boolean }>('/v1/game', { gameId, prizeCatalog })
  if (result?.ok === false) throw new Error('Server rejected prize settings')
}
