import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { saveAccountProfile, uploadProfilePhoto } from './accountProfile'

vi.mock('./api', () => ({ api: { post: vi.fn(), put: vi.fn() } }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})
afterEach(() => { vi.unstubAllGlobals() })

it('uploads binary using the signed URL and returns the persistent key', async () => {
  vi.mocked(api.post).mockResolvedValue({ uploadUrls: [{ url: 'https://upload', key: 'photo-key' }] })
  const file = new File(['photo'], 'photo.png', { type: 'image/png' })
  expect(await uploadProfilePhoto(file)).toBe('photo-key')
  expect(api.post).toHaveBeenCalledWith('/v1/user/media?action=upload-url', {
    files: [{ kind: 'profile-photo', fileName: 'photo.png', contentType: 'image/png', sizeBytes: 5 }],
  })
  expect(fetch).toHaveBeenCalledWith('https://upload', {
    method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: file,
  })
})

it('does not return a key after a failed upload', async () => {
  vi.mocked(api.post).mockResolvedValue({ uploadUrls: [{ url: 'https://upload', key: 'photo-key' }] })
  vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response)
  await expect(uploadProfilePhoto(new File(['x'], 'p.png', { type: 'image/png' }))).rejects.toThrow('403')
})

it('rejects invalid files without requesting an upload', async () => {
  await expect(uploadProfilePhoto(new File(['x'], 'p.svg', { type: 'image/svg+xml' }))).rejects.toThrow()
  expect(api.post).not.toHaveBeenCalled()
})

it('saves only profile fields and returns the saved user', async () => {
  const user = { userId: 'u', name: 'Ana', plan: 'FREE' }
  vi.mocked(api.put).mockResolvedValue({ user })
  expect(await saveAccountProfile('Ana', null)).toEqual(user)
  expect(api.put).toHaveBeenCalledWith('/v1/user/me', { name: 'Ana', profilePhotoKey: null })
})
