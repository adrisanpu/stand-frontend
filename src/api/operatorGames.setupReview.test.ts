import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import {
  finishSetupReview, getOperatorGame, getOperatorGameConfiguration, listOperatorGames,
  SETUP_REVIEW_SECTIONS, updateSetupReview,
} from './operatorGames'

vi.mock('./api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
const game = { gameId: 'NEW', gameName: 'Event', gameType: 'T1MER', lifecycleState: 'active', isActive: true }
const progress = { version: 1, revision: 'r2', confirmedSections: ['appearance'], completed: false }
beforeEach(() => { vi.clearAllMocks() })

it('preserves initial review progress in owner list, detail and configuration responses', async () => {
  const reviewedGame = { ...game, setupReview: progress }
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [reviewedGame] })
  expect((await listOperatorGames())[0].setupReview).toEqual(progress)
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: reviewedGame })
  expect((await getOperatorGame('NEW')).setupReview).toEqual(progress)
  vi.mocked(api.get).mockResolvedValue({
    ok: true, game: reviewedGame, configuration: {}, rewardConditionsRevision: 'conditions',
  })
  expect((await getOperatorGameConfiguration('NEW')).game.setupReview).toEqual(progress)
})

it('keeps legacy events exempt instead of inventing progress', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, game })
  expect((await getOperatorGame('NEW')).setupReview).toBeUndefined()
})

it.each([
  null, {}, { ...progress, version: 2 }, { ...progress, revision: '' },
  { ...progress, confirmedSections: ['unknown'] },
  { ...progress, confirmedSections: ['form', 'form'] },
  { ...progress, completed: true }, { ...progress, completed: 1 },
  { ...progress, confirmedSections: 'form' },
])('rejects malformed or contradictory server review metadata: %j', async setupReview => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: { ...game, setupReview } })
  await expect(getOperatorGame('NEW')).rejects.toThrow('Invalid operator game response')
})

it('requires a server-confirmed section and new revision before confirming a save', async () => {
  vi.mocked(api.put).mockResolvedValue({ ok: true, gameId: 'NEW', setupReview: progress })
  await expect(updateSetupReview('NEW', 'appearance', true, 'r1')).resolves.toEqual(progress)
  expect(api.put).toHaveBeenCalledWith('/v1/game', {
    gameId: 'NEW', setupReview: { section: 'appearance', confirmed: true, expectedRevision: 'r1' },
  })
})

it.each([
  { ok: false, gameId: 'NEW', setupReview: progress },
  { ok: true, gameId: 'OTHER', setupReview: progress },
  { ok: true, gameId: 'NEW' },
  { ok: true, gameId: 'NEW', setupReview: { ...progress, revision: 'r1' } },
  { ok: true, gameId: 'NEW', setupReview: { ...progress, confirmedSections: [] } },
])('does not silently accept unconfirmed saves: %j', async response => {
  vi.mocked(api.put).mockResolvedValue(response)
  await expect(updateSetupReview('NEW', 'appearance', true, 'r1')).rejects.toThrow('not confirmed')
})

it('persists reset separately and requires completed to clear', async () => {
  const reset = { ...progress, confirmedSections: [] }
  vi.mocked(api.put).mockResolvedValue({ ok: true, gameId: 'NEW', setupReview: progress })
  await expect(updateSetupReview('NEW', 'appearance', false, 'r1')).rejects.toThrow('not confirmed')
  vi.mocked(api.put).mockResolvedValue({ ok: true, gameId: 'NEW', setupReview: reset })
  await expect(updateSetupReview('NEW', 'appearance', false, 'r1')).resolves.toEqual(reset)
  expect(api.put).toHaveBeenLastCalledWith('/v1/game', {
    gameId: 'NEW', setupReview: { section: 'appearance', confirmed: false, expectedRevision: 'r1' },
  })
})

it('finishes only on explicit server confirmation with all six sections', async () => {
  vi.mocked(api.put).mockResolvedValue({ ok: true, gameId: 'NEW', setupReview: progress })
  await expect(finishSetupReview('NEW', 'r1')).rejects.toThrow('not confirmed')
  const completed = { ...progress, confirmedSections: [...SETUP_REVIEW_SECTIONS], completed: true }
  vi.mocked(api.put).mockResolvedValue({ ok: true, gameId: 'NEW', setupReview: completed })
  await expect(finishSetupReview('NEW', 'r1')).resolves.toEqual(completed)
  expect(api.put).toHaveBeenLastCalledWith('/v1/game', {
    gameId: 'NEW', setupReview: { finish: true, expectedRevision: 'r1' },
  })
})

it('propagates owner, lifecycle and concurrent-write errors without confirming', async () => {
  vi.mocked(api.put).mockRejectedValue(new Error('SetupReviewChanged'))
  await expect(updateSetupReview('NEW', 'appearance', true, 'r1')).rejects.toThrow('SetupReviewChanged')
  await expect(finishSetupReview('NEW', 'r1')).rejects.toThrow('SetupReviewChanged')
})
