import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { archiveOperatorGame, deleteOperatorGamePermanently, getOperatorGame, listOperatorGames, operatorGameHomeUrl, setOperatorGameActive, unarchiveOperatorGame } from './operatorGames'

vi.mock('./api', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
const game = { gameId: 'NEW', gameName: 'NEW_EVENT', gameType: 'STACK' }
beforeEach(() => { vi.clearAllMocks() })

it('lists owned games using the authenticated API without a type filter', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [game] })
  expect(await listOperatorGames()).toEqual([game])
  expect(api.get).toHaveBeenCalledWith('/v1/game')
})

it.each([
  { ok: false, games: [] },
  { ok: true },
  { ok: true, games: [game, game] },
  { ok: true, games: [{ ...game, gameId: '' }] },
  { ok: true, games: [{ ...game, gameType: '' }] },
  { ok: true, games: [{ ...game, gameType: 'UNKNOWN' }] },
  { ok: true, games: [{ ...game, createdAt: 'not-a-date' }] },
  { ok: true, games: [{ ...game, playerCount: -1 }] },
  { ok: true, games: [{ ...game, playerCount: 1.5 }] },
])('rejects invalid lists rather than showing an empty success: %j', async response => {
  vi.mocked(api.get).mockResolvedValue(response)
  await expect(listOperatorGames()).rejects.toThrow('Invalid operator games response')
})

it('keeps creation and player metadata from the owner response', async () => {
  const detailed = { ...game, createdAt: '2026-11-04T08:00:00Z', playerCount: 0 }
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [detailed] })
  expect(await listOperatorGames()).toEqual([detailed])
})

it('requires the requested game identity before opening a home', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, game })
  expect(await getOperatorGame('NEW')).toEqual(game)
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=NEW')
  await expect(getOperatorGame('OTHER')).rejects.toThrow('Invalid operator game response')
})

it('propagates unavailable and unauthorized game errors', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Forbidden'))
  await expect(getOperatorGame('OTHER')).rejects.toThrow('Forbidden')
})

it('encodes the selected game in the operational URL', () => {
  expect(operatorGameHomeUrl('a&b')).toBe('/home?gameId=a%26b')
})

it('requires the requested activity state to be confirmed', async () => {
  vi.mocked(api.put).mockResolvedValue({ game: { gameId: 'NEW', isActive: false, lifecycleState: 'closing' } })
  await expect(setOperatorGameActive('NEW', false)).resolves.toEqual({ isActive: false, lifecycleState: 'closing' })
  await expect(setOperatorGameActive('NEW', true)).rejects.toThrow('not confirmed')
})

it('requires identity and success confirmation before removing a card', async () => {
  vi.mocked(api.delete).mockResolvedValue({ gameId: 'OTHER', message: 'Game archived successfully' })
  await expect(archiveOperatorGame('NEW')).rejects.toThrow('not confirmed')
  vi.mocked(api.delete).mockResolvedValue({ gameId: 'NEW', message: 'Game archived successfully' })
  await expect(archiveOperatorGame('NEW')).resolves.toBeUndefined()
})

it.each([
  { gameId: 'NEW', isActive: false },
  { gameId: 'NEW', isActive: false, lifecycleState: 'active' },
  { gameId: 'NEW', isActive: false, lifecycleState: 'unknown' },
])('does not confirm an outdated or inconsistent lifecycle response: %j', async game => {
  vi.mocked(api.put).mockResolvedValue({ game })
  await expect(setOperatorGameActive('NEW', false)).rejects.toThrow('not confirmed')
})

const archivedGame = { ...game, isActive: false, lifecycleState: 'inactive', archivedAt: '2026-01-01T00:00:00Z' }

it('requests archived events explicitly and rejects data from the wrong view', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [archivedGame] })
  expect(await listOperatorGames(true)).toEqual([archivedGame])
  expect(api.get).toHaveBeenCalledWith('/v1/game?archived=true')
  await expect(listOperatorGames()).rejects.toThrow('Invalid operator games response')
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [game] })
  await expect(listOperatorGames(true)).rejects.toThrow('Invalid operator games response')
})

it.each([
  { ...archivedGame, archivedAt: 'not-a-date' },
  { ...archivedGame, isActive: true },
  { ...archivedGame, deletionStartedAt: 'not-a-date' },
  { ...game, deletionStartedAt: '2026-01-01T00:00:00Z' },
])('rejects invalid archive/deletion metadata: %j', async value => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [value] })
  await expect(listOperatorGames(true)).rejects.toThrow('Invalid operator games response')
})

it('restores without activation using a distinct mutation', async () => {
  vi.mocked(api.put).mockResolvedValue({
    message: 'Game unarchived successfully', game: { ...game, isActive: false, lifecycleState: 'inactive' },
  })
  await expect(unarchiveOperatorGame('NEW')).resolves.toBeUndefined()
  expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'NEW', archived: false })
})

it.each([
  { ...game, isActive: true, lifecycleState: 'active' },
  { ...game, gameId: 'OTHER', isActive: false, lifecycleState: 'inactive' },
  archivedGame,
  { ...game, isActive: false },
])('does not confirm inconsistent restoration: %j', async value => {
  vi.mocked(api.put).mockResolvedValue({ message: 'Game unarchived successfully', game: value })
  await expect(unarchiveOperatorGame('NEW')).rejects.toThrow('not confirmed')
})

it('distinguishes permanent deletion from archival and requires the exact confirmation response', async () => {
  vi.mocked(api.delete).mockResolvedValue({ gameId: 'NEW', message: 'Game archived successfully' })
  await expect(deleteOperatorGamePermanently('NEW', 'NEW_EVENT')).rejects.toThrow('not confirmed')
  vi.mocked(api.delete).mockResolvedValue({ gameId: 'OTHER', message: 'Game permanently deleted successfully' })
  await expect(deleteOperatorGamePermanently('NEW', 'NEW_EVENT')).rejects.toThrow('not confirmed')
  vi.mocked(api.delete).mockResolvedValue({ gameId: 'NEW', message: 'Game permanently deleted successfully' })
  await expect(deleteOperatorGamePermanently('NEW', 'NEW_EVENT')).resolves.toBeUndefined()
  expect(api.delete).toHaveBeenLastCalledWith('/v1/game', { gameId: 'NEW', permanent: true, confirmation: 'NEW_EVENT' })
})
