// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { saveAppearance, uploadAvatar, uploadLogo } from './userMedia'

vi.mock('./api', () => ({
  api: { post: vi.fn(), put: vi.fn() },
}))

describe('user media uploads', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
  })

  it('persists the appearance through the authenticated media API and propagates failures', async () => {
    const appearance = { colors: { primary: '#ff0000', accent: '#00ff00' }, themeMode: 'light' as const }
    vi.mocked(api.put).mockResolvedValueOnce({ ok: true })
    await saveAppearance(appearance)
    expect(api.put).toHaveBeenCalledWith('/v1/user/media', { kind: 'appearance', appearance })
    vi.mocked(api.put).mockRejectedValueOnce(new Error('No se pudo guardar'))
    await expect(saveAppearance(appearance)).rejects.toThrow('No se pudo guardar')
  })

  it.each(['logo', 'avatar'] as const)('uploads %s with the presigned PUT contract before registering and selecting', async (kind) => {
    const file = new File(['media'], kind === 'logo' ? 'logo.png' : 'avatar.mp4', {
      type: kind === 'logo' ? 'image/png' : 'video/mp4',
    })
    const meta = {
      id: 'media-id', kind, key: 'users/user/media', name: 'media',
      fileName: file.name, contentType: file.type, sizeBytes: file.size,
      ...(kind === 'avatar' ? { state: 'win' } : {}),
    }
    vi.mocked(api.post).mockResolvedValueOnce({
      ok: true,
      uploadUrls: [{ id: meta.id, url: 'https://storage.example/upload', meta }],
    }).mockResolvedValueOnce({ ok: true })
    const fetch = vi.fn().mockImplementation(async () => {
      expect(api.post).toHaveBeenCalledTimes(1)
      expect(api.put).not.toHaveBeenCalled()
      return { ok: true }
    })
    vi.stubGlobal('fetch', fetch)

    if (kind === 'logo') await uploadLogo(file)
    else await uploadAvatar(file, 'win')

    expect(api.post).toHaveBeenNthCalledWith(1, '/v1/user/media?action=upload-url', {
      files: [{
        kind, fileName: file.name, contentType: file.type, sizeBytes: file.size,
        name: undefined, ...(kind === 'avatar' ? { state: 'win' } : {}),
      }],
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('https://storage.example/upload', {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    expect(api.post).toHaveBeenNthCalledWith(2, '/v1/user/media', { items: [meta] })
    expect(api.put).toHaveBeenCalledWith('/v1/user/media', {
      kind, mediaId: meta.id, ...(kind === 'avatar' ? { state: 'win' } : {}),
    })
  })

  it('does not register or select a logo when storage rejects the upload', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      ok: true,
      uploadUrls: [{ id: 'media-id', url: 'https://storage.example/upload', meta: {} }],
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))

    await expect(uploadLogo(new File(['logo'], 'logo.png', { type: 'image/png' })))
      .rejects.toThrow('Upload failed (403)')
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.put).not.toHaveBeenCalled()
  })
})
