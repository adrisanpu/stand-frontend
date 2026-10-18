import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicApi, type ImpostorAssignment, type ImpostorParticipantState } from '../../api/publicApi'
import ImpostorParticipantPlay from './ParticipantPlay'

vi.mock('../../api/publicApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/publicApi')>()
  return { ...actual, publicApi: { ...actual.publicApi, getPlayer: vi.fn() } }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const base: ImpostorAssignment = { playerId: 1, displayName: 'Ana', validationCode: 1234, validated: false }

function state(partial: Partial<ImpostorParticipantState>): ImpostorParticipantState {
  return {
    phase: 'word_round', round: 1, inRound: true, role: 'crew', word: 'playa',
    currentTurn: null, winner: null, won: null, ...partial,
  }
}

function serve(assignment: ImpostorAssignment) {
  vi.mocked(publicApi.getPlayer).mockResolvedValue({
    ok: true, gameId: 'G1', gameType: 'IMPOSTOR', playerToken: 'tok', assignment, prizes: [],
  })
}

describe('Impostor participant Web view', () => {
  it('shows the validation code until the operator validates the player', async () => {
    serve(base)
    render(<ImpostorParticipantPlay gameId="G1" playerToken="tok" initialAssignment={base} />)
    expect(screen.getByText('1234')).toBeInTheDocument()
    expect(await screen.findByText('Díselo al equipo del evento para entrar en la partida.')).toBeInTheDocument()
    expect(publicApi.getPlayer).toHaveBeenCalledWith('tok', 'G1')
  })

  it('reveals the word to the crew and announces their turn', async () => {
    serve({ ...base, validated: true, impostor: state({ currentTurn: { isMine: true, name: 'Ana' } }) })
    render(<ImpostorParticipantPlay gameId="G1" playerToken="tok" initialAssignment={base} />)
    expect(await screen.findByText('playa')).toBeInTheDocument()
    expect(screen.getByText('¡Te toca! Di una palabra en voz alta.')).toBeInTheDocument()
  })

  it('tells the impostor their role without a word', async () => {
    serve({ ...base, validated: true, impostor: state({ role: 'impostor', word: null, currentTurn: { isMine: false, name: 'Bea' } }) })
    render(<ImpostorParticipantPlay gameId="G1" playerToken="tok" initialAssignment={base} />)
    expect(await screen.findByText('Eres el impostor')).toBeInTheDocument()
    expect(screen.queryByText('Tu palabra')).not.toBeInTheDocument()
    expect(screen.getByText('Turno de Bea')).toBeInTheDocument()
  })

  it('shows the round result for the player', async () => {
    serve({ ...base, validated: true, impostor: state({ phase: 'result', winner: 'crew', won: true }) })
    render(<ImpostorParticipantPlay gameId="G1" playerToken="tok" initialAssignment={base} />)
    expect(await screen.findByText('¡Has ganado!')).toBeInTheDocument()
    expect(screen.getByText('Ganan los jugadores')).toBeInTheDocument()
  })
})
