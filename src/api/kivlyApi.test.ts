import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { kivlyApi } from './kivlyApi'

vi.mock('./api', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks() })

describe('Kivly account location', () => {
  it('connects and saves club details through the account contract', async () => {
    vi.mocked(api.put).mockResolvedValue({ ok: true })
    expect(await kivlyApi.connectAccount('client-id', 'client-secret')).toBe(false)
    expect(api.put).toHaveBeenCalledWith('/v1/kivly', { clientId: 'client-id', clientSecret: 'client-secret' })
    const clubSettings = { clubName: 'Club', privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms' }
    await kivlyApi.saveClubSettings(clubSettings)
    expect(api.put).toHaveBeenLastCalledWith('/v1/kivly', { clubSettings })
  })

  it('disconnects and exposes credential cleanup warnings', async () => {
    vi.mocked(api.delete).mockResolvedValue({ ok: true, warning: 'KivlySecretCleanupRequired' })
    expect(await kivlyApi.disconnectAccount()).toBe(true)
    expect(api.delete).toHaveBeenCalledWith('/v1/kivly')
  })

  it('does not accept unconfirmed connection or club changes', async () => {
    vi.mocked(api.put).mockResolvedValue({ ok: false })
    await expect(kivlyApi.connectAccount('id', 'secret')).rejects.toThrow('Kivly connection not confirmed')
    await expect(kivlyApi.saveClubSettings({ clubName: '', privacyUrl: '', termsUrl: '' }))
      .rejects.toThrow('Kivly club settings not confirmed')
  })

  it('returns the authorized location and saved ID', async () => {
    const connection = {
      connected: true,
      locationId: 'location-1', locations: [{ id: 'location-1', name: 'Club' }],
    }
    vi.mocked(api.get).mockResolvedValue({ ok: true, connection })
    expect(await kivlyApi.getAccountConnection()).toEqual(connection)
  })

  it.each([
    { connected: true },
    { connected: true, locationId: 'other', locations: [{ id: 'location-1', name: 'Club' }] },
    { connected: false, locationId: 'location-1', locations: [] },
  ])('rejects an invalid or inconsistent location response', async (connection) => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, connection })
    await expect(kivlyApi.getAccountConnection()).rejects.toThrow('Invalid Kivly connection response')
  })

  it('accepts disconnected accounts without a saved location', async () => {
    const connection = { connected: false, locationId: null, locations: [] }
    vi.mocked(api.get).mockResolvedValue({ ok: true, connection })
    expect(await kivlyApi.getAccountConnection()).toEqual(connection)
  })

})
