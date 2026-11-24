import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publicApi, PublicApiError, type MobileAssignment, type MobileGameType, type PlayerResponse } from '../../api/publicApi'
import L3trasParticipantPlay from '../../games/l3tras/ParticipantPlay'
import SemaforoParticipantPlay from '../../games/semaforo/ParticipantPlay'
import CupidoParticipantPlay from '../../games/cupido/ParticipantPlay'
import InfocardsParticipantPlay from '../../games/infocards/ParticipantPlay'
import { ParticipantLanguageProvider } from './participantLanguage'

vi.mock('../../api/publicApi', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/publicApi')>(),
  publicApi: { getPlayer: vi.fn(), play: vi.fn() },
}))

function assignment(gameType: MobileGameType = 'L3TRAS'): MobileAssignment {
  return {
    gameType, playerId: 1, displayName: 'Alex', validationCode: 1234, validated: false, letter: 'A',
    play: { revision: 0, phase: 'idle', ...(gameType === 'L3TRAS' ? { word: 'AA', slots: [null, null] } : {}) },
  }
}
function response(next: MobileAssignment): PlayerResponse {
  return { ok: true, gameId: 'ABC123', gameType: next.gameType, assignment: next, playerToken: 'token', prizes: [] }
}
function mount(Component: typeof L3trasParticipantPlay, initialAssignment = assignment()) {
  return render(<ParticipantLanguageProvider><Component gameId="ABC123" playerToken="token" initialAssignment={initialAssignment} /></ParticipantLanguageProvider>)
}
beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  localStorage.clear()
  vi.mocked(publicApi.getPlayer).mockResolvedValue(response(assignment()))
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('L3TRAS mobile', () => {
  it('recovers current slots and adds codes only through token gameplay actions', async () => {
    const restored = assignment()
    restored.play = { ...restored.play, revision: 2, phase: 'collecting', slots: ['A', null], expiresAt: Date.now() + 20000 }
    vi.mocked(publicApi.getPlayer).mockResolvedValue(response(restored))
    vi.mocked(publicApi.play).mockResolvedValue(response({
      ...restored, validated: true, play: { ...restored.play, revision: 3, phase: 'finished', slots: ['A', 'A'], result: 'won' },
    }))
    mount(L3trasParticipantPlay)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Añadir letra' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Código de participante'), { target: { value: '5678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }))
    expect(await screen.findByText('¡Palabra completada!')).toBeInTheDocument()
    expect(publicApi.play).toHaveBeenCalledWith('ABC123', 'token', 2, expect.any(String), { move: 'code', code: '5678' })
  })

  it('retries a lost response with the identical request id, revision and code', async () => {
    vi.mocked(publicApi.play).mockRejectedValueOnce(new Error('Network failed')).mockResolvedValueOnce(response({
      ...assignment(), play: { revision: 1, phase: 'collecting', word: 'AA', slots: ['A', null], expiresAt: Date.now() + 60000 },
    }))
    mount(L3trasParticipantPlay)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Añadir letra' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar acción' }))
    await waitFor(() => expect(publicApi.play).toHaveBeenCalledTimes(2))
    expect(vi.mocked(publicApi.play).mock.calls[1]).toEqual(vi.mocked(publicApi.play).mock.calls[0])
  })

  it('refreshes after a conflict instead of replaying a stale revision', async () => {
    vi.mocked(publicApi.play).mockRejectedValue(new PublicApiError('PlayChanged', 409, 'PlayChanged'))
    mount(L3trasParticipantPlay)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Añadir letra' })).toBeEnabled())
    vi.mocked(publicApi.getPlayer).mockResolvedValue(response({
      ...assignment(), validated: true, play: { revision: 3, phase: 'finished', result: 'won', word: 'AA', slots: ['A', 'A'] },
    }))
    fireEvent.click(screen.getByRole('button', { name: 'Añadir letra' }))
    expect(await screen.findByText('¡Palabra completada!')).toBeInTheDocument()
    expect(publicApi.getPlayer).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'Reintentar acción' })).not.toBeInTheDocument()
  })
})

describe('Pair mobile games', () => {
  it.each([
    ['SEMAFORO', SemaforoParticipantPlay],
    ['CUPIDO', CupidoParticipantPlay],
  ] as const)('validates %s on one phone without submitting another player identity', async (kind, Component) => {
    const initial = assignment(kind)
    vi.mocked(publicApi.getPlayer).mockResolvedValue(response(initial))
    vi.mocked(publicApi.play).mockResolvedValue(response({
      ...initial, validated: true, play: { revision: 1, phase: 'finished', result: 'won', participants: ['Alex', 'Sam'] },
    }))
    mount(Component, initial)
    fireEvent.change(screen.getByLabelText('Código de tu pareja'), { target: { value: '5678' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Validar pareja' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    expect(await screen.findByText('¡Pareja validada!')).toBeInTheDocument()
    expect(publicApi.play).toHaveBeenCalledWith('ABC123', 'token', 0, expect.any(String), { move: 'pair', code: '5678' })
    if (kind === 'CUPIDO') expect(screen.getByText('En desarrollo')).toBeInTheDocument()
  })

  it('recovers an alternating quiz and asks the server to evaluate the selected option', async () => {
    const initial = assignment('SEMAFORO')
    initial.play = { revision: 5, phase: 'quiz', roundIndex: 1, strikes: 1,
      turn: { guesser: 'Sam', target: 'Alex', ready: true, question: {
        id: 'q2', text: '¿Café?', options: [{ title: 'Sí', payload: 'yes' }, { title: 'No', payload: 'no' }],
      } }, expiresAt: Date.now() + 5000 }
    vi.mocked(publicApi.getPlayer).mockResolvedValue(response(initial))
    vi.mocked(publicApi.play).mockResolvedValue(response({
      ...initial, play: { ...initial.play, revision: 6, phase: 'finished', result: 'won' },
    }))
    mount(SemaforoParticipantPlay, initial)
    expect(await screen.findByText('Turno de Sam')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sí' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }))
    expect(await screen.findByText('¡Pareja validada!')).toBeInTheDocument()
    expect(publicApi.play).toHaveBeenCalledWith('ABC123', 'token', 5, expect.any(String), { move: 'answer', answer: 'yes' })
  })

  it('submits one timeout action after the recovered server deadline', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(100000)
    const initial = assignment('SEMAFORO')
    initial.play = { revision: 2, phase: 'quiz', serverNow: 100000, expiresAt: 105000,
      turn: { guesser: 'Alex', target: 'Sam', ready: true, question: {
        id: 'q2', text: '¿Café?', options: [{ title: 'Sí', payload: 'yes' }],
      } } }
    vi.mocked(publicApi.getPlayer).mockResolvedValue(response(initial))
    vi.mocked(publicApi.play).mockResolvedValue(response({
      ...initial, play: { revision: 3, phase: 'quiz', strikes: 1, turn: { guesser: 'Sam', target: 'Alex', ready: false } },
    }))
    await act(async () => { mount(SemaforoParticipantPlay, initial) })
    await act(async () => { vi.advanceTimersByTime(5100) })
    expect(publicApi.play).toHaveBeenCalledTimes(1)
    expect(publicApi.play).toHaveBeenCalledWith('ABC123', 'token', 2, expect.any(String), { move: 'answer', answer: null })
    expect(screen.getByRole('button', { name: 'Estoy listo: empezar turno' })).toBeInTheDocument()
  })

  it('resumes an already expired turn without getting stuck during the initial refresh', async () => {
    const initial = assignment('SEMAFORO')
    initial.play = { revision: 2, phase: 'quiz', expiresAt: Date.now() - 1000,
      turn: { guesser: 'Alex', target: 'Sam', ready: true, question: {
        id: 'q2', text: '¿Café?', options: [{ title: 'Sí', payload: 'yes' }],
      } } }
    vi.mocked(publicApi.getPlayer).mockResolvedValue(response(initial))
    vi.mocked(publicApi.play).mockResolvedValue(response({
      ...initial, play: { revision: 3, phase: 'quiz', strikes: 1, turn: { guesser: 'Sam', target: 'Alex', ready: false } },
    }))
    mount(SemaforoParticipantPlay, initial)
    expect(await screen.findByRole('button', { name: 'Estoy listo: empezar turno' })).toBeInTheDocument()
    expect(publicApi.play).toHaveBeenCalledTimes(1)
  })
})

describe('INFOCARDS mobile', () => {
  function cards() {
    return { ...assignment('INFOCARDS'), cards: [
      { id: 'a', title: 'Primera', body: 'Contenido uno', imageUrl: 'https://example.test/a.png' },
      { id: 'b', title: 'Segunda', body: 'Contenido dos' },
    ] }
  }
  it('supports buttons, keyboard and swipe without adding a registration QR card', async () => {
    vi.mocked(publicApi.getPlayer).mockResolvedValue(response(cards()))
    mount(InfocardsParticipantPlay, cards())
    expect(await screen.findByRole('heading', { name: 'Primera' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('article'), { key: 'ArrowRight' })
    expect(screen.getByRole('heading', { name: 'Segunda' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    fireEvent.touchStart(screen.getByRole('article'), { touches: [{ clientX: 20, clientY: 10 }] })
    fireEvent.touchEnd(screen.getByRole('article'), { changedTouches: [{ clientX: 160, clientY: 15 }] })
    expect(screen.getByRole('heading', { name: 'Primera' })).toBeInTheDocument()
    expect(screen.queryByText('Unirse a la partida')).not.toBeInTheDocument()
    expect(publicApi.play).not.toHaveBeenCalled()
  })

  it('keeps the card position across remount and exposes media errors without hiding text', async () => {
    vi.mocked(publicApi.getPlayer).mockResolvedValue(response(cards()))
    const mounted = mount(InfocardsParticipantPlay, cards())
    await screen.findByRole('heading', { name: 'Primera' })
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByRole('alert')).toHaveTextContent('Puedes seguir leyendo')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    mounted.unmount()
    mount(InfocardsParticipantPlay, cards())
    expect(await screen.findByRole('heading', { name: 'Segunda' })).toBeInTheDocument()
  })

  it('retries loading after a transient public API failure', async () => {
    vi.mocked(publicApi.getPlayer).mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(response(cards()))
    mount(InfocardsParticipantPlay, assignment('INFOCARDS'))
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar carga' }))
    expect(await screen.findByRole('heading', { name: 'Primera' })).toBeInTheDocument()
  })
})
