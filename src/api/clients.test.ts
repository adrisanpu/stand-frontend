import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { getClientHistory, listClients, searchClients } from './clients'

vi.mock('./api', () => ({ api: { get: vi.fn() } }))

const client = {
  id: 'a'.repeat(64), name: 'Ana', email: 'ana@example.com',
  phone: '+34600000000', participationCount: 2,
}

beforeEach(() => { vi.clearAllMocks() })

it('requests a paginated owner client list and validates the response', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true, clients: [client], nextCursor: 'opaque',
  })
  await expect(listClients('previous')).resolves.toEqual({
    clients: [client], nextCursor: 'opaque',
  })
  expect(api.get).toHaveBeenCalledWith('/v1/clients?limit=25&cursor=previous')
})

it('loads a client history by opaque verified-email identity', async () => {
  const history = {
    client,
    participations: [{
      gameId: 'ABC123', gameName: 'Feria', gameType: 'STACK',
      joinedAt: null, name: 'Ana', phone: client.phone,
      awards: [{
        id: 'award_1', name: 'Premio', source: 'kivly', condition: 'complete',
        awardedAt: null, awardState: 'confirmed', kivlyAssignmentState: 'confirmed',
        emailState: 'accepted', deliveryChannel: 'wallet', collected: false, collectedAt: null,
      }],
    }],
  }
  vi.mocked(api.get).mockResolvedValue({ ok: true, ...history })
  await expect(getClientHistory(client.id)).resolves.toEqual(history)
  expect(api.get).toHaveBeenCalledWith(`/v1/clients/${client.id}`)
})

it('rejects malformed or duplicate client identities', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true, clients: [client, client], nextCursor: null,
  })

  await expect(listClients()).rejects.toThrow('Invalid clients response')
  await expect(getClientHistory('not-an-id')).rejects.toThrow('Invalid client id')
})

it('requests a globally filtered numbered page with its exact total', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true, clients: [client], page: 2, total: 26, pageSize: 25,
    })
    await expect(searchClients(2, 'Ana')).resolves.toEqual({ clients: [client], page: 2, total: 26 })
    expect(api.get).toHaveBeenCalledWith('/v1/clients?page=2&search=Ana')
    vi.mocked(api.get).mockResolvedValue({
      ok: true, clients: [client], page: 2, total: 1, pageSize: 25,
    })
    await expect(searchClients(2, '')).rejects.toThrow('Invalid clients response')
})
