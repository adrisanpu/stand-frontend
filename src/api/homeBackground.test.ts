import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { uploadHomeBackground } from './userMedia'

vi.mock('./api', () => ({ api: { post: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }))) })
afterEach(() => { vi.unstubAllGlobals() })
const file = (size: number, type = 'video/mp4') => {
  const value = new File([], 'background.mp4', { type })
  Object.defineProperty(value, 'size', { value: size })
  return value
}
it('accepts exactly 100 MB, uploads and registers as background without selecting a logo', async () => {
  const meta = { id: 'bg', kind: 'home-background', key: 'users/owner/home-backgrounds/bg.mp4' }
  vi.mocked(api.post).mockResolvedValueOnce({ uploadUrls: [{ kind: 'home-background', url: 'https://storage.test/upload', meta }] })
  await uploadHomeBackground(file(100 * 1024 * 1024))
  expect(api.post).toHaveBeenNthCalledWith(1, '/v1/user/media?action=upload-url', { files: [expect.objectContaining({ kind: 'home-background', sizeBytes: 100 * 1024 * 1024 })] })
  expect(api.post).toHaveBeenNthCalledWith(2, '/v1/user/media', { items: [meta] })
  expect(api.post).toHaveBeenCalledTimes(2)
})
it.each([file(100 * 1024 * 1024 + 1), file(0), file(5 * 1024 * 1024 + 1, 'image/png'), file(1, 'text/html')])(
  'rejects invalid background media before requesting upload', async value => {
    await expect(uploadHomeBackground(value)).rejects.toThrow()
    expect(api.post).not.toHaveBeenCalled()
  },
)
