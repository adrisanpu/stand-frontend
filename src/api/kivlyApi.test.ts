import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'
import { kivlyApi } from './kivlyApi'

vi.mock('./api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks() })

describe('Kivly account location', () => {
  it('loads the game reward catalog and saves a selection through its dedicated contract', async () => {
    const rewards = [{ id: 'reward1', name: 'Coffee' }]
    vi.mocked(api.get).mockResolvedValue({ ok: true, rewards })
    expect(await kivlyApi.listRewards('GAME1')).toEqual(rewards)
    expect(api.get).toHaveBeenCalledWith('/v1/game/kivly/rewards?gameId=GAME1')
    vi.mocked(api.put).mockResolvedValue({ ok: true })
    await kivlyApi.saveReward('GAME1', 'reward1')
    expect(api.put).toHaveBeenCalledWith('/v1/game/kivly', { gameId: 'GAME1', rewardId: 'reward1' })
    await kivlyApi.saveReward('GAME1', null)
    expect(api.put).toHaveBeenLastCalledWith('/v1/game/kivly', { gameId: 'GAME1', rewardId: null })
  })

  it.each([undefined, {}, [{ id: 'reward1' }], [{ id: '', name: 'Coffee' }]])('rejects malformed catalogs: %j', async (rewards) => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, rewards })
    await expect(kivlyApi.listRewards('GAME1')).rejects.toThrow('Invalid Kivly rewards response')
  })

  it('does not accept an unconfirmed reward save', async () => {
    vi.mocked(api.put).mockResolvedValue({ ok: false })
    await expect(kivlyApi.saveReward('GAME1', 'reward1')).rejects.toThrow('Kivly reward not confirmed')
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

  it('accepts game settings using the connection without a separate approval flag', async () => {
    const state = {
      ok: true, connection: { connected: true },
      settings: { enabled: true, clubName: 'Club', privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms' },
    }
    vi.mocked(api.get).mockResolvedValue(state)
    expect(await kivlyApi.get('GAME1')).toEqual(state)
  })
})
