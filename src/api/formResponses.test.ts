import { beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { getFormResponses } from './formResponses'

vi.mock('./api', () => ({ api: { get: vi.fn() } }))

const response = {
  ok: true as const,
  gameId: 'ABC123',
  gameName: 'Event',
  questions: [{ id: 'q1', text: 'Question?', options: [{ title: 'Yes', payload: 'yes' }] }],
  players: [{
    playerId: 1, name: 'Ana', email: 'ana@example.test', completed: true,
    completedAt: '2026-01-02T03:04:05Z', answers: { q1: 'yes' },
  }],
}

beforeEach(() => { vi.clearAllMocks() })

it('requests the owner-protected analytics endpoint and validates its response', async () => {
  vi.mocked(api.get).mockResolvedValue(response)
  await expect(getFormResponses('ABC123')).resolves.toEqual(response)
  expect(api.get).toHaveBeenCalledWith('/v1/game/quiz?gameId=ABC123&analytics=1')
})

it('encodes game IDs and rejects malformed or mismatched responses', async () => {
  vi.mocked(api.get).mockResolvedValue({ ...response, gameId: 'other' })
  await expect(getFormResponses('A B')).rejects.toThrow('Invalid form responses response')
  expect(api.get).toHaveBeenCalledWith('/v1/game/quiz?gameId=A%20B&analytics=1')
})

it('preserves authenticated profile fields and rejects malformed profile values', async () => {
  const player = { ...response.players[0], phone: '+34612345678', address: 'Street 1',
    company: 'Company', jobTitle: 'Engineer', birthDate: '2000-01-02' }
  const result = { ...response, players: [player] }
  vi.mocked(api.get).mockResolvedValue(result)
  await expect(getFormResponses('ABC123')).resolves.toEqual(result)
  vi.mocked(api.get).mockResolvedValue({ ...response, players: [{ ...player, company: { unexpected: true } }] })
  await expect(getFormResponses('ABC123')).rejects.toThrow('Invalid form responses response')
})
