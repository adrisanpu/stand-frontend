import { api } from './api'
import { MAX_PRIZE_IMAGE_BYTES } from './prizeMedia'

export type SharedPrize = {
  id: string
  name: string
  imageKey: string | null
  imageUrl?: string | null
}

export type SharedPrizeCatalog = {
  catalog: SharedPrize[]
  revision: number
}

export async function fetchSharedPrizeCatalog(): Promise<SharedPrizeCatalog> {
  const result = await api.get<{ ok: boolean; catalog: unknown; revision: number }>('/v1/prizes/catalog')
  if (result?.ok !== true || !Array.isArray(result.catalog) || !Number.isSafeInteger(result.revision)
    || !result.catalog.every((prize: unknown) => typeof prize === 'object' && prize !== null
      && 'id' in prize && typeof prize.id === 'string'
      && 'name' in prize && typeof prize.name === 'string'
      && 'imageKey' in prize && (typeof prize.imageKey === 'string' || prize.imageKey === null))) {
    throw new Error('Invalid shared prize catalog response')
  }
  return { catalog: result.catalog as SharedPrize[], revision: result.revision }
}

export async function saveSharedPrizeCatalog(catalog: SharedPrize[], expectedRevision: number): Promise<number> {
  const normalized = catalog.map(({ id, name, imageKey }) => ({ id, name, imageKey }))
  const result = await api.put<{ ok: boolean; revision: number }>('/v1/prizes/catalog', {
    catalog: normalized, expectedRevision,
  })
  if (result?.ok !== true || !Number.isSafeInteger(result.revision) || result.revision <= expectedRevision) {
    throw new Error('Shared prize catalog update not confirmed')
  }
  return result.revision
}

export async function uploadSharedPrizeImage(file: File): Promise<string> {
  if (file.type !== 'image/png' || !/\.png$/i.test(file.name)
    || file.size < 1 || file.size > MAX_PRIZE_IMAGE_BYTES) {
    throw new Error('Invalid prize image')
  }
  const result = await api.post<{ ok: boolean; key: string; uploadUrl: string }>('/v1/prizes/catalog', {
    action: 'upload-url', contentType: 'image/png', sizeBytes: file.size,
  })
  if (result?.ok !== true || !result.key || !result.uploadUrl) throw new Error('No upload URL received')
  const response = await fetch(result.uploadUrl, {
    method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: file,
  })
  if (!response.ok) throw new Error(`Upload failed (${response.status})`)
  return result.key
}
