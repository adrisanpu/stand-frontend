import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicApiError, publicApi, type StackAssignment } from '../../api/publicApi'
import { DEFAULT_STACK_CONFIG } from '../../games/stack/stackLogic'
import ParticipantShell from './ParticipantShell'
import { loadAssignment, savePlayerSession } from './playerSession'

vi.mock('../../api/publicApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/publicApi')>()
  return {
    ...actual,
    publicApi: { getGame: vi.fn(), getPlayer: vi.fn(), join: vi.fn() },
  }
})
vi.mock('../../games/stack/ParticipantPlay', () => ({
  default: ({ assignment }: { assignment: StackAssignment }) => (
    <div>Escena STACK: {assignment.attempt ? 'consumido' : 'disponible'}</div>
  ),
}))

const assignment: StackAssignment = { gameType: 'STACK', playerId: 1, displayName: 'Jugador', attempt: null }

function renderParticipant() {
  return render(
    <MemoryRouter initialEntries={['/play/GAME1234']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/play/:gameId" element={<ParticipantShell />} /></Routes>
    </MemoryRouter>
  )
}

describe('ParticipantShell STACK integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'STACK', isActive: true,
      playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '/play/GAME1234', stackConfig: DEFAULT_STACK_CONFIG,
    })
  })
  afterEach(cleanup)

  it('uses the existing registration form for a new player', async () => {
    renderParticipant()
    expect(await screen.findByText('Regístrate para jugar desde tu móvil')).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
    expect(publicApi.getPlayer).not.toHaveBeenCalled()
  })

  it('refreshes consumed attempt state from the server instead of trusting local assignment', async () => {
    savePlayerSession('GAME1234', 'token', assignment)
    const consumed: StackAssignment = {
      ...assignment,
      attempt: { attemptId: 'a1', status: 'started', startedAt: '2026-10-16T10:00:00Z', configVersion: '1' },
    }
    vi.mocked(publicApi.getPlayer).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'STACK', playerToken: 'token', assignment: consumed, prizes: [],
    })
    renderParticipant()
    expect(await screen.findByText('Escena STACK: consumido')).toBeInTheDocument()
    expect(publicApi.getPlayer).toHaveBeenCalledWith('token', 'GAME1234')
    expect(loadAssignment('GAME1234')).toEqual(consumed)
  })

  it('does not fall back to a fresh attempt when state recovery fails', async () => {
    savePlayerSession('GAME1234', 'token', assignment)
    vi.mocked(publicApi.getPlayer).mockRejectedValue(new Error('Sin conexión al servidor'))
    renderParticipant()
    expect(await screen.findByText('Sin conexión al servidor')).toBeInTheDocument()
    expect(screen.queryByText(/Escena STACK/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar carga' })).toBeInTheDocument()
    const consumed: StackAssignment = {
      ...assignment,
      attempt: { attemptId: 'a1', status: 'started', startedAt: '2026-10-16T10:00:00Z', configVersion: '1' },
    }
    vi.mocked(publicApi.getPlayer).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'STACK', playerToken: 'token', assignment: consumed, prizes: [],
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    expect(await screen.findByText('Escena STACK: consumido')).toBeInTheDocument()
    expect(publicApi.getPlayer).toHaveBeenCalledTimes(2)
    expect(loadAssignment('GAME1234')).toEqual(consumed)
  })

  it('does not offer a network retry after a definitive API rejection', async () => {
    vi.mocked(publicApi.getGame).mockRejectedValue(new PublicApiError('GameNotFound', 404))
    renderParticipant()
    expect(await screen.findByText('Juego no disponible')).toBeInTheDocument()
    expect(screen.getByText('GameNotFound')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar carga' })).not.toBeInTheDocument()
  })

  it('continues to accept T1MER registration', async () => {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'T1MER', isActive: true,
      playerCount: 0, validatedCount: 0, recentPairs: [], joinUrl: '/play/GAME1234',
    })
    renderParticipant()
    await waitFor(() => expect(screen.getByText('Regístrate para jugar desde tu móvil')).toBeInTheDocument())
  })

  it('recovers the finalized score from the server rather than a stale local started attempt', async () => {
    savePlayerSession('GAME1234', 'token', assignment)
    const finished: StackAssignment = {
      ...assignment, score: 7, rank: 2,
      attempt: { attemptId: 'a1', status: 'finished', startedAt: '2026-10-16T10:00:00Z', finishedAt: '2026-10-16T10:01:00Z', configVersion: '1' },
    }
    vi.mocked(publicApi.getPlayer).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'STACK', playerToken: 'token', assignment: finished, prizes: [],
    })
    renderParticipant()
    expect(await screen.findByText('Escena STACK: consumido')).toBeInTheDocument()
    expect(loadAssignment('GAME1234')).toEqual(finished)
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument()
  })
})
