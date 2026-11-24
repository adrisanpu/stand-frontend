import { api } from './api'
import type { BackendUser } from '../auth/useCurrentUser'

export const PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024

export async function uploadProfilePhoto(file: File): Promise<string> {
  if (!PROFILE_PHOTO_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_PROFILE_PHOTO_SIZE) {
    throw new Error('Invalid profile photo type or size')
  }
  const response = await api.post<{ uploadUrls: { url: string; key: string }[] }>(
    '/v1/user/media?action=upload-url',
    { files: [{ kind: 'profile-photo', fileName: file.name, contentType: file.type, sizeBytes: file.size }] },
  )
  const entry = response.uploadUrls[0]
  if (!entry?.url || !entry.key) throw new Error('No upload URL received for profile photo')
  const uploaded = await fetch(entry.url, {
    method: 'PUT', headers: { 'Content-Type': file.type }, body: file,
  })
  if (!uploaded.ok) throw new Error(`Profile photo upload failed (${uploaded.status})`)
  return entry.key
}

export async function saveAccountProfile(name: string, profilePhotoKey: string | null): Promise<BackendUser> {
  const response = await api.put<{ user: BackendUser }>('/v1/user/me', { name, profilePhotoKey })
  if (!response.user?.userId) throw new Error('Invalid account profile response')
  return response.user
}
