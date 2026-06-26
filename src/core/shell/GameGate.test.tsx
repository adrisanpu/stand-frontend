import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import GameGate from './GameGate'

// ---------------------------------------------------------------------------
// Module mocks (vi.hoisted so mockGames is available when vi.mock runs)
// ---------------------------------------------------------------------------

const { mockGames } = vi.hoisted(() => ({
  mockGames: [
    {
      id: 'T1MER',
      name: 'T1MER',
      description: 'Reacciona a tiempo',
      descriptionLong: 'Pulsa al ritmo correcto',
      underDevelopment: false,
      assets: { logo: '/t1mer.png' },
      tags: { playerMode: 'solo', social: false, competitive: true },
    },
    {
      id: 'RULET4',
      name: 'RULET4',
      description: 'Gira la ruleta',
      underDevelopment: true,
      assets: {},
      tags: {},
    },
  ],
}))

vi.mock('../../games', () => ({ games: mockGames }))

vi.mock('../../api/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ ok: true, games: [] }),
    post: vi.fn().mockResolvedValue({ ok: true }),
  },
}))

const mockUseCurrentUser = vi.fn()
vi.mock('../../auth/useCurrentUser', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}))

vi.mock('../../auth/featureFlags', () => ({
  getFeaturesByPlan: (plan: string) => ({
    maxPlayers: plan === 'free' ? 20 : Infinity,
    maxGames: plan === 'free' ? 1 : Infinity,
  }),
}))

vi.mock('../theme', () => ({
  useStandLogo: () => '/images/logo_stand_letters_white.png',
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderGate(onGameCreated = vi.fn()) {
  return render(<GameGate onGameCreated={onGameCreated} />)
}

// ---------------------------------------------------------------------------
// Tests: Catalog view
// ---------------------------------------------------------------------------

describe('GameGate – catalog view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCurrentUser.mockReturnValue({ plan: 'free', user: { sub: 'u1' } })
    localStorage.clear()
  })

  it('renders the game catalog', () => {
    renderGate()
    expect(screen.getByText('T1MER')).toBeInTheDocument()
    expect(screen.getByText('RULET4')).toBeInTheDocument()
  })

  it('navigates to create/join view when a game is selected', () => {
    renderGate()
    fireEvent.click(screen.getByText('T1MER'))
    expect(screen.getByText('Crear')).toBeInTheDocument()
    expect(screen.getByText('Unirse')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Tests: Create/Join view
// ---------------------------------------------------------------------------

describe('GameGate – create/join view', () => {
  function renderAndSelect(plan = 'free', game = mockGames[0]) {
    mockUseCurrentUser.mockReturnValue({ plan, user: { sub: 'u1' } })
    renderGate()
    fireEvent.click(screen.getByText(game.name))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('Crear button is disabled when gameId is empty', () => {
    renderAndSelect('event')
    const btn = screen.getByRole('button', { name: 'Crear' })
    expect(btn).toBeDisabled()
  })

  it('Crear button is enabled when gameId is valid and canCreateGame', () => {
    renderAndSelect('event')
    fireEvent.change(screen.getByLabelText(/Nombre de la partida/i), {
      target: { value: 'TORNEO1' },
    })
    const btn = screen.getByRole('button', { name: 'Crear' })
    expect(btn).not.toBeDisabled()
  })

  it('Crear button is disabled for free plan when a game already exists', () => {
    localStorage.setItem('gameId', 'EXISTING')
    renderAndSelect('free')
    fireEvent.change(screen.getByLabelText(/Nombre de la partida/i), {
      target: { value: 'NUEVA' },
    })
    const btn = screen.getByRole('button', { name: 'Crear' })
    expect(btn).toBeDisabled()
  })

  it('shows "Disponible en el plan Event" when canCreateGame is false', () => {
    localStorage.setItem('gameId', 'EXISTING')
    renderAndSelect('free')
    expect(screen.getByText(/Disponible en el plan Event/i)).toBeInTheDocument()
  })

  it('Crear button is disabled for underDevelopment games', () => {
    renderAndSelect('event', mockGames[1])
    fireEvent.change(screen.getByLabelText(/Nombre de la partida/i), {
      target: { value: 'GAME1' },
    })
    const btn = screen.getByRole('button', { name: 'Crear' })
    expect(btn).toBeDisabled()
  })

  it('shows "En desarrollo" note for underDevelopment games', () => {
    renderAndSelect('event', mockGames[1])
    expect(screen.getByText(/En desarrollo/i)).toBeInTheDocument()
  })

  it('Unirse button is disabled when gameId is empty', () => {
    renderAndSelect('event')
    const btn = screen.getByRole('button', { name: 'Unirse' })
    expect(btn).toBeDisabled()
  })

  it('game name input uppercases the value', () => {
    renderAndSelect('event')
    const input = screen.getByLabelText(/Nombre de la partida/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'torneo' } })
    expect(input.value).toBe('TORNEO')
  })

  it('back button returns to catalog', () => {
    renderAndSelect('event')
    fireEvent.click(screen.getByText(/Volver al catálogo/i))
    expect(screen.getByText('T1MER')).toBeInTheDocument()
  })

  it('calls onGameCreated after successful Crear', async () => {
    const { api } = await import('../../api/api')
    vi.mocked(api.post).mockResolvedValueOnce({
      message: 'Created',
      game: { gameId: 'GID1', gameName: 'TORNEOTEST', gameType: 'T1MER', createdAt: '', maxPlayers: 100, ownerUserId: '', isActive: true, updatedAt: '' },
    })

    const onCreated = vi.fn()
    mockUseCurrentUser.mockReturnValue({ plan: 'event', user: { sub: 'u1' } })
    render(<GameGate onGameCreated={onCreated} />)
    fireEvent.click(screen.getByText('T1MER'))
    fireEvent.change(screen.getByLabelText(/Nombre de la partida/i), {
      target: { value: 'TORNEOTEST' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('TORNEOTEST', 'GID1', 'T1MER'))
  })
})
