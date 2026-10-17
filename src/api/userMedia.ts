import { api } from './api'
import type { ParticipantAppearance } from '../core/theme/appearance'

export type AvatarState = 'idle' | 'win' | 'lose'
export type MediaKind = 'logo' | 'avatar'

export type UserMediaItem = {
  id: string
  kind: MediaKind
  name: string
  fileName: string
  contentType: string
  sizeBytes: number
  key: string
  createdAt?: string | null
  state?: AvatarState
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
  avatar: {
    items: UserMediaItem[]
    selectedByState: Record<AvatarState, string | null>
    selected: Record<AvatarState, UserMediaItem | null>
  }
}

type UploadRequest = {
  kind: MediaKind
  fileName: string
  contentType: string
  sizeBytes: number
  state?: AvatarState
  name?: string
}

type UploadUrlEntry = {
  id: string
  kind: MediaKind
  state?: AvatarState
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

export async function selectAvatar(mediaId: string, state: AvatarState): Promise<void> {
  await api.put('/v1/user/media', { kind: 'avatar', mediaId, state })
}

export async function deleteUserMedia(kind: MediaKind, mediaId: string): Promise<void> {
  await api.delete('/v1/user/media', { kind, mediaId })
}

export async function uploadLogo(file: File, name?: string): Promise<void> {
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
  await selectLogo(entry.id)
}

export async function uploadAvatar(file: File, state: AvatarState, name?: string): Promise<void> {
  const [entry] = await getUploadUrls([
    {
      kind: 'avatar',
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      state,
      name,
    },
  ])
  if (!entry) throw new Error('No upload URL received for avatar')
  await uploadBinaryToPresignedUrl(entry.url, file)
  await api.post('/v1/user/media', { items: [entry.meta] })
  await selectAvatar(entry.id, state)
}
