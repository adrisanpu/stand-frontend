import { api } from './api'
import type { ParticipantAppearance } from '../core/theme/appearance'

export type MediaKind = 'logo' | 'home-background'

export type UserMediaItem = {
  id: string
  kind: MediaKind
  name: string
  fileName: string
  contentType: string
  sizeBytes: number
  key: string
  createdAt?: string | null
  url?: string | null
}

export type UserMediaResponse = {
  ok: boolean
  appearance?: ParticipantAppearance | null
  logo: {
    items: UserMediaItem[]
    selectedId: string | null
    selected: UserMediaItem | null
    /** Presigned URLs for platform defaults (oscuro → dark, claro → light). */
    defaults?: Partial<Record<'dark' | 'light', UserMediaItem | null>>
  }
  'home-background'?: { items: UserMediaItem[] }
}

type UploadRequest = {
  kind: MediaKind
  fileName: string
  contentType: string
  sizeBytes: number
  name?: string
}

type UploadUrlEntry = {
  id: string
  kind: MediaKind
  key: string
  url: string
  expiresIn: number
  meta: Omit<UserMediaItem, 'createdAt' | 'url'>
}

type UploadUrlResponse = {
  ok: boolean
  uploadUrls: UploadUrlEntry[]
}

async function uploadBinaryToPresignedUrl(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`)
  }
}

async function getUploadUrls(files: UploadRequest[]): Promise<UploadUrlEntry[]> {
  const response = await api.post<UploadUrlResponse>('/v1/user/media?action=upload-url', { files })
  return response.uploadUrls ?? []
}

export async function fetchUserMedia(): Promise<UserMediaResponse> {
  return api.get<UserMediaResponse>('/v1/user/media')
}

/** User-selected logo only (excludes platform default fallback). */
export function resolveUserSelectedLogoUrl(media: UserMediaResponse): string | null {
  if (!media.logo.selectedId) return null
  const fromSelected = media.logo.selected?.url
  if (fromSelected) return fromSelected
  return media.logo.items.find((it) => it.id === media.logo.selectedId)?.url ?? null
}

/** Logo shown when no user logo is selected: white letters on dark UI, black on light. */
export function resolveLogoDisplayUrl(media: UserMediaResponse, isDarkMode: boolean): string | null {
  const selected = resolveUserSelectedLogoUrl(media)
  if (selected) return selected
  const def = isDarkMode ? media.logo.defaults?.dark : media.logo.defaults?.light
  return def?.url ?? null
}

export async function selectLogo(mediaId: string): Promise<void> {
  await api.put('/v1/user/media', { kind: 'logo', mediaId })
}

export async function saveAppearance(appearance: ParticipantAppearance): Promise<void> {
  await api.put('/v1/user/media', { kind: 'appearance', appearance })
}

export async function deleteUserMedia(kind: MediaKind, mediaId: string): Promise<void> {
  await api.delete('/v1/user/media', { kind, mediaId })
}

/** Register an image in the library without changing the account's selected logo. */
export async function uploadLibraryImage(file: File, name?: string): Promise<UserMediaItem> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.type)) {
    throw new Error('Selecciona una imagen PNG, JPEG, WebP, GIF o SVG.')
  }
  const [entry] = await getUploadUrls([
    {
      kind: 'logo',
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      name,
    },
  ])
  if (!entry) throw new Error('No upload URL received for logo')
  await uploadBinaryToPresignedUrl(entry.url, file)
  await api.post('/v1/user/media', { items: [entry.meta] })
  return entry.meta
}

export async function uploadLogo(file: File, name?: string): Promise<void> {
  const entry = await uploadLibraryImage(file, name)
  await selectLogo(entry.id)
}

export async function uploadHomeBackground(file: File): Promise<UserMediaItem> {
  const image = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)
  const video = ['video/mp4', 'video/webm'].includes(file.type)
  if (!image && !video) throw new Error('Selecciona una imagen PNG, JPEG, WebP o SVG, o un vídeo MP4/WebM.')
  const limit = (video ? 100 : 5) * 1024 * 1024
  if (!file.size || file.size > limit) throw new Error(video ? 'El vídeo debe ocupar entre 1 byte y 100 MB.' : 'La imagen debe ocupar entre 1 byte y 5 MB.')
  const [entry] = await getUploadUrls([{ kind: 'home-background', fileName: file.name, contentType: file.type, sizeBytes: file.size }])
  if (!entry || entry.kind !== 'home-background') throw new Error('No upload URL received for home background')
  await uploadBinaryToPresignedUrl(entry.url, file)
  await api.post('/v1/user/media', { items: [entry.meta] })
  return entry.meta
}
