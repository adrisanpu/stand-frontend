import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicApiError, publicApi, type StackAssignment, type PublicGameResponse, type PlayerResponse, type PlayerAssignment } from '../../api/publicApi'
import { DEFAULT_STACK_CONFIG } from '../../games/stack/stackLogic'
import { StrictMode } from 'react'
import ParticipantShell from './ParticipantShell'
import { loadAssignment, loadPlayerToken, savePlayerSession } from './playerSession'
import { STORAGE_KEY_COLORS, STORAGE_KEY_THEME_MODE } from '../storageKeys'

vi.mock('../../api/publicApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/publicApi')>()
  return {
    ...actual,
    publicApi: { getGame: vi.fn(), getPlayer: vi.fn(), join: vi.fn(), requestEmailCode: vi.fn(), uploadParticipantPhoto: vi.fn(), exchangeAccess: vi.fn(), validate: vi.fn() },
  }
})
vi.mock('../../games/stack/ParticipantPlay', () => ({
  default: ({ assignment }: { assignment: StackAssignment }) => (
    <div>Escena STACK: {assignment.attempt ? 'consumido' : 'disponible'}</div>
  ),
}))

const assignment: StackAssignment = { gameType: 'STACK', playerId: 1, displayName: 'Jugador', attempt: null }

function renderParticipant(strict = false) {
  const participant = (
    <MemoryRouter initialEntries={['/play/GAME1234']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/play/:gameId" element={<ParticipantShell />} /></Routes>
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{participant}</StrictMode> : participant)
}

describe('ParticipantShell STACK integration', () => {
  it('keeps the validation prize visible while the participant looks for their partner', async () => {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'EMPAREJA2', isActive: true,
      playMode: 'mobile', joinChannel: 'web', playerCount: 1, validatedCount: 0,
      recentPairs: [], joinUrl: '', prizeCatalog: {
        validation: { name: 'Mochila', limit: 10, imageUrl: '/backpack.png' },
        raffle: { name: 'Sorteo', limit: 1, imageUrl: '/raffle.png' },
      },
    })
    const pair = { playerId: 7, characterId: 1, characterName: 'Sol', partnerCharacterName: 'Luna', validationCode: 5678, validated: false }
    savePlayerSession('GAME1234', 'token', pair)
    vi.mocked(publicApi.getPlayer).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'EMPAREJA2', playerToken: 'token', assignment: pair, prizes: [],
    })
    renderParticipant()
    expect(await screen.findByRole('img', { name: 'Mochila' })).toHaveAttribute('src', '/backpack.png')
    expect(screen.getByText('Luna')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Validar pareja' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Sorteo' })).not.toBeInTheDocument()
  })

  it('continues to play with an initial avatar and a warning when photo upload fails', async () => {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'T1MER', isActive: true,
      playMode: 'mobile', joinChannel: 'web', playerCount: 0, validatedCount: 0,
      recentPairs: [], joinUrl: '',
      participantFields: { email: { required: false }, instagram: { required: false }, phone: { required: false } },
    })
    vi.mocked(publicApi.join).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'T1MER', playerToken: 'player-token',
      assignment: { playerId: 1, displayName: '@ana', validated: false },
    })
    vi.mocked(publicApi.uploadParticipantPhoto).mockRejectedValueOnce(new Error('offline'))
    const { container } = renderParticipant()
    const photo = new File([new Uint8Array([1, 2, 3])], 'profile.png', { type: 'image/png' })
    fireEvent.change(await screen.findByLabelText('Foto de perfil (opcional)'), { target: { files: [photo] } })
    fireEvent.change(screen.getByLabelText(/Nombre de usuario/), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('No se pudo guardar la foto')
    expect(screen.getByText('Jugando como')).toBeInTheDocument()
    expect(container.querySelector('.rounded-full')).toHaveTextContent('A')
    expect(publicApi.uploadParticipantPhoto).toHaveBeenCalledWith(photo, 'player-token')
  })

  it('refreshes signed prize images without resetting the registration draft', async () => {
    vi.useFakeTimers()
    try {
      const meta: PublicGameResponse = {
        ok: true, gameId: 'GAME1234', gameType: 'T1MER', isActive: true,
        playMode: 'mobile', joinChannel: 'web', playerCount: 0, validatedCount: 0,
        recentPairs: [], joinUrl: '', prizeCatalog: {
          ranking: { name: 'Auriculares', limit: null, topX: 3, imageUrl: '/first.png' },
        },
      }
      vi.mocked(publicApi.getGame).mockResolvedValue(meta)
      renderParticipant()
      await act(async () => {})
      const promo = screen.getByLabelText('Premios en juego')
      const card = screen.getByLabelText(/Email/).closest('.card')
      expect(promo.nextElementSibling).toBe(card?.parentElement)
      expect(card).not.toContainElement(promo)
      expect(screen.getAllByRole('img', { name: 'Auriculares' })).toHaveLength(1)
      fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'draft@example.com' } })
      vi.mocked(publicApi.getGame).mockResolvedValue({
        ...meta, prizeCatalog: { ranking: { ...meta.prizeCatalog!.ranking!, imageUrl: '/fresh.png' } },
      })
      await act(async () => { vi.advanceTimersByTime(30 * 60 * 1000) })
      expect(screen.getByRole('img', { name: 'Auriculares' })).toHaveAttribute('src', '/fresh.png')
      expect(screen.getByLabelText(/Email/)).toHaveValue('draft@example.com')
      expect(publicApi.getGame).toHaveBeenCalledTimes(2)
      expect(publicApi.join).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a prize refresh failure without discarding the form, then allows retry', async () => {
    vi.useFakeTimers()
    try {
      const meta: PublicGameResponse = {
        ok: true, gameId: 'GAME1234', gameType: 'T1MER', isActive: true,
        playMode: 'mobile', joinChannel: 'web', playerCount: 0, validatedCount: 0,
        recentPairs: [], joinUrl: '', prizeCatalog: {
          ranking: { name: 'Auriculares', limit: null, topX: 3, imageUrl: '/first.png' },
        },
      }
      vi.mocked(publicApi.getGame).mockResolvedValue(meta)
      renderParticipant()
      await act(async () => {})
      fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'draft@example.com' } })
      vi.mocked(publicApi.getGame).mockRejectedValueOnce(new Error('Offline'))
      await act(async () => { vi.advanceTimersByTime(30 * 60 * 1000) })
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron actualizar los premios.')
      expect(screen.getByLabelText(/Email/)).toHaveValue('draft@example.com')
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reintentar actualización de premios' })) })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByLabelText(/Email/)).toHaveValue('draft@example.com')
      expect(publicApi.join).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'STACK', isActive: true,
      playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '/play/GAME1234', stackConfig: DEFAULT_STACK_CONFIG,
    })
  })
  afterEach(() => {
    cleanup()
    window.history.replaceState(null, '', '/')
  })

  it('uses the existing registration form for a new player', async () => {
    renderParticipant()
    expect(await screen.findByText('Regístrate para jugar desde tu móvil')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar código' })).toHaveClass('text-primary', 'bg-[rgba(var(--color-primary-rgb),0.25)]')
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

  it.each(['InvalidPlayerToken', 'PlayerNotFound'])('clears a rejected saved session (%s) and requires a new verified join', async (code) => {
    savePlayerSession('GAME1234', 'expired-token', assignment)
    savePlayerSession('OTHERGAME', 'other-token', assignment)
    vi.mocked(publicApi.getPlayer).mockRejectedValueOnce(new PublicApiError(code, 403, code))
    vi.mocked(publicApi.requestEmailCode).mockResolvedValueOnce({
      ok: true, challengeId: 'new-challenge', emailMasked: 'p***@example.com',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
    })
    vi.mocked(publicApi.join).mockResolvedValueOnce({
      ok: true, gameId: 'GAME1234', gameType: 'STACK', playerToken: 'new-token', assignment,
    })
    renderParticipant()
    expect(await screen.findByRole('button', { name: 'Enviar código' })).toBeInTheDocument()
    expect(loadPlayerToken('GAME1234')).toBeNull()
    expect(loadAssignment('GAME1234')).toBeNull()
    expect(loadPlayerToken('OTHERGAME')).toBe('other-token')
    expect(screen.queryByText(/Escena STACK/)).not.toBeInTheDocument()
    expect(publicApi.exchangeAccess).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
    fireEvent.change(screen.getByLabelText(/Nombre de usuario/), { target: { value: 'Player' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    const input = await screen.findByLabelText('Código de verificación')
    expect(publicApi.join).not.toHaveBeenCalled()
    expect(loadPlayerToken('GAME1234')).toBeNull()
    expect(screen.queryByText(/Escena STACK/)).not.toBeInTheDocument()
    fireEvent.change(input, { target: { value: '012345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
    expect(await screen.findByText('Escena STACK: disponible')).toBeInTheDocument()
    expect(publicApi.join).toHaveBeenCalledWith({ gameId: 'GAME1234', challengeId: 'new-challenge', code: '012345' })
    expect(loadPlayerToken('GAME1234')).toBe('new-token')
  })

  it('returns rejected Instagram sessions to the Instagram screen, not web registration', async () => {
    const meta = await publicApi.getGame('GAME1234')
    vi.mocked(publicApi.getGame).mockResolvedValue({ ...meta, joinChannel: 'instagram' })
    savePlayerSession('GAME1234', 'expired-token', assignment)
    vi.mocked(publicApi.getPlayer).mockRejectedValueOnce(new PublicApiError('InvalidPlayerToken', 403, 'InvalidPlayerToken'))
    renderParticipant()
    expect(await screen.findByText('Participa desde Instagram')).toBeInTheDocument()
    expect(loadPlayerToken('GAME1234')).toBeNull()
    expect(loadAssignment('GAME1234')).toBeNull()
    expect(screen.queryByLabelText('Email *')).not.toBeInTheDocument()
    expect(publicApi.join).not.toHaveBeenCalled()
    expect(publicApi.requestEmailCode).not.toHaveBeenCalled()
  })

  it.each([
    new Error('Network failure'),
    new PublicApiError('Server failure', 500, 'InvalidPlayerToken'),
    new PublicApiError('Rate limited', 429, 'InvalidPlayerToken'),
    new PublicApiError('Forbidden', 403, 'Forbidden'),
    new PublicApiError('Unknown rejection', 403),
  ])('preserves saved sessions and existing error handling for other recovery failures: %s', async (error) => {
    savePlayerSession('GAME1234', 'saved-token', assignment)
    vi.mocked(publicApi.getPlayer).mockRejectedValueOnce(error)
    renderParticipant()
    expect(await screen.findByText(error.message)).toBeInTheDocument()
    expect(loadPlayerToken('GAME1234')).toBe('saved-token')
    expect(loadAssignment('GAME1234')).toEqual(assignment)
    expect(screen.queryByLabelText('Email *')).not.toBeInTheDocument()
    expect(screen.queryByText(/Escena STACK/)).not.toBeInTheDocument()
    const retryable = !(error instanceof PublicApiError) || error.status >= 500 || error.status === 429
    expect(!!screen.queryByRole('button', { name: 'Reintentar carga' })).toBe(retryable)
  })

  it.each([
    { ok: false },
    { gameId: 'OTHERGAME' },
    { isActive: false },
    { gameType: 'UNSUPPORTED' },
  ])('does not clear saved sessions or offer registration for invalid metadata: %o', async (override) => {
    const meta = await publicApi.getGame('GAME1234')
    vi.mocked(publicApi.getGame).mockResolvedValue({ ...meta, ...override })
    savePlayerSession('GAME1234', 'saved-token', assignment)
    renderParticipant()
    expect(await screen.findByText('Juego no disponible')).toBeInTheDocument()
    expect(loadPlayerToken('GAME1234')).toBe('saved-token')
    expect(loadAssignment('GAME1234')).toEqual(assignment)
    expect(publicApi.getPlayer).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Email *')).not.toBeInTheDocument()
  })

  it('preserves saved sessions when game metadata fails with a participant-token error', async () => {
    savePlayerSession('GAME1234', 'saved-token', assignment)
    vi.mocked(publicApi.getGame).mockRejectedValueOnce(new PublicApiError('InvalidPlayerToken', 403, 'InvalidPlayerToken'))
    renderParticipant()
    expect(await screen.findByText('Juego no disponible')).toBeInTheDocument()
    expect(loadPlayerToken('GAME1234')).toBe('saved-token')
    expect(publicApi.getPlayer).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Email *')).not.toBeInTheDocument()
    expect(loadAssignment('GAME1234')).toEqual(assignment)
  })

  it.each([true, false])('shows the registration logo instead of the event name (client logo: %s)', async (custom) => {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'EMPAREJA2', gameName: 'TEST',
      isActive: true, playMode: 'mobile', clientLogoUrl: custom ? 'https://images.test/client.png' : null,
      playerCount: 0, validatedCount: 0, recentPairs: [], joinUrl: '',
    })
    renderParticipant()
    const logo = await screen.findByRole('img', { name: custom ? 'Logo del cliente' : 'EMPAREJA2' })
    expect(logo).toHaveAttribute('src', custom ? 'https://images.test/client.png' : '/images/empareja2-logo.png')
    expect(logo).toHaveClass('mx-auto')
    expect(logo.parentElement).toHaveClass('card', 'relative')
    expect(logo.nextElementSibling?.tagName).toBe('FORM')
    expect(screen.queryByText('TEST')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar código' })).toBeInTheDocument()
  })

  it.each([
    ['EMPAREJA2', 'join'], ['EMPAREJA2', 'assignment'], ['EMPAREJA2', 'validate'], ['EMPAREJA2', 'result'],
    ['EMPAREJA2', 'instagram'], ['EMPAREJA2', 'load-error'], ['EMPAREJA2', 'access-error'],
    ['T1MER', 'join'], ['T1MER', 'play'], ['T1MER', 'master'], ['T1MER', 'result'],
    ['STACK', 'join'], ['STACK', 'play'],
  ])('keeps the shared branding, panel format and language selector for %s %s', async (type, panel) => {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: type, gameName: 'TEST',
      clientLogoUrl: 'https://images.test/client.png', isActive: true,
      playMode: panel === 'master' ? 'master' : 'mobile',
      joinChannel: panel === 'instagram' ? 'instagram' : 'web',
      playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '',
      prizeCatalog: type === 'EMPAREJA2'
        ? { validation: { name: 'Mochila', limit: 10, imageUrl: '/backpack.png' } }
        : { ranking: { name: 'Auriculares', limit: null, topX: 3, imageUrl: '/headphones.png' } },
    })
    const needsSession = !['join', 'instagram', 'access-error'].includes(panel)
    const player = type === 'EMPAREJA2'
      ? { playerId: 7, characterId: 1, characterName: 'Sol', partnerCharacterName: 'Luna', validationCode: 5678, validated: panel === 'result' }
      : type === 'T1MER'
        ? { playerId: 7, displayName: 'Ana', validationCode: 1234, validated: false, ...(panel === 'result' ? { timer: 10, score: 0 } : {}) }
        : assignment
    if (needsSession) savePlayerSession('GAME1234', 'token', player)
    vi.mocked(publicApi.getPlayer).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: type, playerToken: 'token', assignment: player, prizes: [],
    })
    if (panel === 'load-error') vi.mocked(publicApi.getPlayer).mockRejectedValueOnce(new Error('Sin conexión'))
    if (panel === 'access-error') {
      window.history.replaceState(null, '', '/play/GAME1234#access=branding-error')
      vi.mocked(publicApi.exchangeAccess).mockRejectedValueOnce(new Error('InvalidAccessToken'))
    }
    renderParticipant()
    await waitFor(() => expect(screen.queryByText('Cargando...')).not.toBeInTheDocument())
    if (panel === 'validate') fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    const logo = screen.getByRole('img', { name: 'Logo del cliente' })
    expect(logo).toHaveAttribute('src', 'https://images.test/client.png')
    expect(screen.getAllByRole('img', { name: 'Logo del cliente' })).toHaveLength(1)
    const selector = screen.getByRole('combobox', { name: 'Idioma' })
    expect(selector.parentElement).toBe(logo.parentElement?.parentElement)
    expect(selector.closest('.card')).toBeNull()
    expect(selector).toHaveClass('z-50', 'pointer-events-auto')
    expect(logo.parentElement).toHaveClass('card', 'relative', 'p-6', 'pt-14')
    expect(logo).toHaveClass('h-32')
    const promo = screen.getByLabelText('Premios en juego')
    expect(promo.parentElement).toBe(selector.parentElement?.parentElement)
    expect(promo.nextElementSibling).toBe(selector.parentElement)
    expect(promo).toHaveClass('pr-24')
    expect(screen.getAllByRole('img', { name: type === 'EMPAREJA2' ? 'Mochila' : 'Auriculares' })).toHaveLength(1)
    expect(screen.queryByText('TEST')).not.toBeInTheDocument()
    fireEvent.change(selector, { target: { value: 'en' } })
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en')
    expect(screen.getByLabelText('Prizes to play for')).toBeInTheDocument()
    expect(screen.getByText(type === 'EMPAREJA2' ? 'PRIZE: Mochila' : 'TOP PRIZE 3: Auriculares')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Client logo' })).toHaveAttribute('src', 'https://images.test/client.png')
  })

  it.each([true, false])('waits for branding before rendering any logo (client logo: %s)', async (custom) => {
    let finish!: (meta: PublicGameResponse) => void
    vi.mocked(publicApi.getGame).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    renderParticipant()
    expect(screen.getByText('Cargando...')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    finish({
      ok: true, gameId: 'GAME1234', gameType: 'STACK', isActive: true,
      clientLogoUrl: custom ? 'https://images.test/client.png' : null,
      playerCount: 0, validatedCount: 0, recentPairs: [], joinUrl: '',
    })
    const logo = await screen.findByRole('img', { name: custom ? 'Logo del cliente' : 'STACK' })
    expect(logo).toHaveAttribute('src', custom ? 'https://images.test/client.png' : '/images/stack-logo.png')
    expect(screen.queryByRole('img', { name: 'EMPAREJA2' })).not.toBeInTheDocument()
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

  it('switches registration language without losing entered values or fetching again', async () => {
      renderParticipant()
      expect(await screen.findByText('Regístrate para jugar desde tu móvil')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'ana@example.test' } })
      fireEvent.click(screen.getByRole('checkbox'))
      const selector = screen.getByRole('combobox', { name: 'Idioma' })
      expect(selector).toHaveClass('absolute', 'right-3', 'top-3')
      expect(selector.parentElement).toHaveClass('relative')
      expect(screen.getByRole('option', { name: 'ES' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'EN' })).toBeInTheDocument()
      expect(screen.queryByText('Idioma')).not.toBeInTheDocument()
      fireEvent.change(selector, { target: { value: 'en' } })
      expect(screen.getByText('Register to play on your phone')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send code' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/pages/privacy.html')
      expect(screen.getByLabelText(/Email/)).toHaveValue('ana@example.test')
      expect(screen.getByRole('checkbox')).toBeChecked()
      fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'es' } })
      expect(screen.getByRole('button', { name: 'Enviar código' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', '/pages/privacy-es.html')
      expect(publicApi.getGame).toHaveBeenCalledTimes(1)
      expect(publicApi.join).not.toHaveBeenCalled()
    })

    it('switches assignment, validation and results while retaining the pair code and session', async () => {
      vi.mocked(publicApi.getGame).mockResolvedValue({
        ok: true, gameId: 'GAME1234', gameType: 'EMPAREJA2', playMode: 'mobile',
        isActive: true, playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '',
      })
      const pair = {
        participantName: '@ana', profilePicUrl: '/ana.png',
        playerId: 7, characterId: 1, characterName: 'Filemón', partnerCharacterName: 'Mortadelo',
        validationCode: 5678, validated: false,
      }
      savePlayerSession('GAME1234', 'token', pair)
      vi.mocked(publicApi.getPlayer).mockResolvedValue({
        ok: true, gameId: 'GAME1234', gameType: 'EMPAREJA2', playerToken: 'token', assignment: pair, prizes: [],
      })
      const { container } = renderParticipant()
      expect(await screen.findByText('Mortadelo')).toBeInTheDocument()
      expect(container.querySelector('img[src="/ana.png"]')).toBeInTheDocument()
      expect(screen.getByText('@ana')).toBeInTheDocument()
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
      expect(screen.getByText('Your character')).toBeInTheDocument()
      expect(screen.getByText('Your mission:')).toBeInTheDocument()
      expect(screen.getByText('Mortadelo').parentElement).toHaveTextContent('Find Mortadelo')
      expect(screen.getByRole('heading', { name: 'Filemón' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Validate pair' }))
      fireEvent.change(screen.getByLabelText('Your partner’s code'), { target: { value: '1234' } })
      vi.mocked(publicApi.validate).mockResolvedValueOnce({ valid: false, gameId: 'GAME1234', message: 'No sois la pareja correcta.' })
      fireEvent.click(screen.getByRole('button', { name: 'Validate' }))
      expect(await screen.findByText('You are not the correct pair.')).toBeInTheDocument()
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es' } })
      expect(screen.getByLabelText('Código de tu pareja')).toHaveValue('1234')
      expect(screen.getByText('No sois la pareja correcta.')).toBeInTheDocument()
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
      vi.mocked(publicApi.getPlayer).mockResolvedValue({
        ok: true, gameId: 'GAME1234', gameType: 'EMPAREJA2', playerToken: 'token',
        assignment: { ...pair, validated: true },
        prizes: [{ kind: 'validation', token: 'prize-token', delivered: false }],
      })
      vi.mocked(publicApi.validate).mockResolvedValueOnce({ valid: true, gameId: 'GAME1234' })
      fireEvent.click(screen.getByRole('button', { name: 'Validate' }))
      expect(await screen.findByText('Pair validated!')).toBeInTheDocument()
      expect(await screen.findByRole('img', { name: 'QR Pair prize' })).toHaveAttribute('src', expect.stringContaining('data=prize-token'))
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es' } })
      expect(screen.getByRole('img', { name: 'QR Premio por pareja' })).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      expect(screen.queryByRole('link')).not.toBeInTheDocument()
      expect(publicApi.getGame).toHaveBeenCalledTimes(1)
      expect(publicApi.join).not.toHaveBeenCalled()
  })

  it.each(['master', 'mobile'] as const)('translates T1MER %s controls without refreshing the session', async (mode) => {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'T1MER', playMode: mode, isActive: true,
      playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '',
    })
    const timer = { playerId: 7, displayName: 'Ana', validationCode: 1234, validated: false }
    savePlayerSession('GAME1234', 'token', timer)
    vi.mocked(publicApi.getPlayer).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'T1MER', playerToken: 'token', assignment: timer, prizes: [],
    })
    renderParticipant()
    await screen.findByText(mode === 'master' ? 'Tu código' : 'Jugando como')
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
    if (mode === 'master') {
      expect(screen.getByText('Your code')).toBeInTheDocument()
      expect(screen.getByText('1234')).toBeInTheDocument()
      expect(screen.getByText(/Go to the event screen/)).toBeInTheDocument()
    } else {
      expect(screen.getByText('Playing as')).toBeInTheDocument()
      expect(screen.getByText('Ana')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'START' }))
      expect(screen.getByRole('button', { name: 'STOP' })).toBeInTheDocument()
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'es' } })
      expect(screen.getByRole('button', { name: 'DETENER' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'EMPEZAR' })).not.toBeInTheDocument()
    }
    expect(publicApi.getPlayer).toHaveBeenCalledTimes(1)
    expect(publicApi.join).not.toHaveBeenCalled()
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

  const timerAssignment = { playerId: 7, displayName: 'Ana', validationCode: 1234, validated: false }
  const pairAssignment = {
    playerId: 7, characterId: 1, characterName: 'Sol', partnerCharacterName: 'Luna',
    validationCode: 5678, validated: false,
  }

  function mockGame(gameType: string, playMode: 'master' | 'mobile', joinChannel: 'instagram' | 'web') {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType, playMode, joinChannel, isActive: true,
      playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '/play/GAME1234',
    })
  }

  function playerResponse(gameType: string, playerAssignment: PlayerAssignment): PlayerResponse {
    return {
      ok: true, gameId: 'GAME1234', gameType, playerToken: 'personal-session',
      assignment: playerAssignment, prizes: [],
    }
  }

  it.each(['EMPAREJA2', 'T1MER'])('registers %s for master without offering mobile play', async (gameType) => {
    mockGame(gameType, 'master', 'web')
    vi.mocked(publicApi.requestEmailCode).mockResolvedValue({
      ok: true, challengeId: 'email-challenge', emailMasked: 'a***@example.test',
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
    })
    vi.mocked(publicApi.join).mockResolvedValue({
      ...playerResponse(gameType, gameType === 'T1MER' ? timerAssignment : pairAssignment),
      assignment: gameType === 'T1MER' ? timerAssignment : pairAssignment,
    })
    renderParticipant()
    expect(await screen.findByText('Regístrate para jugar en la pantalla máster')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'ana@example.test' } })
    fireEvent.change(screen.getByLabelText(/Nombre de usuario/), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    const code = await screen.findByLabelText('Código de verificación')
    expect(publicApi.join).not.toHaveBeenCalled()
    fireEvent.change(code, { target: { value: '012345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
    if (gameType === 'T1MER') {
      expect(await screen.findByText('1234')).toBeInTheDocument()
    } else {
      expect(await screen.findByText('Sol')).toBeInTheDocument()
      expect(screen.queryByText('5678')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
      expect(screen.getByText('5678')).toBeInTheDocument()
    }
    expect(screen.getByText(/pantalla máster del evento/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Validar pareja' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Detén el cronómetro/)).not.toBeInTheDocument()
  })

  it.each([
    ['EMPAREJA2', 'master', 'instagram'],
    ['EMPAREJA2', 'mobile', 'instagram'],
    ['EMPAREJA2', 'master', 'web'],
    ['EMPAREJA2', 'mobile', 'web'],
    ['T1MER', 'master', 'instagram'],
    ['T1MER', 'mobile', 'instagram'],
    ['T1MER', 'master', 'web'],
    ['T1MER', 'mobile', 'web'],
  ] as const)('restores %s %s with %s independently from access channel', async (gameType, mode, channel) => {
    mockGame(gameType, mode, channel)
    const authoritative = gameType === 'T1MER' ? timerAssignment : pairAssignment
    savePlayerSession('GAME1234', 'token', assignment)
    vi.mocked(publicApi.getPlayer).mockResolvedValue(playerResponse(gameType, authoritative))
    renderParticipant()
    if (gameType === 'EMPAREJA2') {
      expect(await screen.findByText('Sol')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Validar pareja' })).toBeInTheDocument()
      expect(screen.queryByText('5678')).not.toBeInTheDocument()
    } else if (mode === 'master') {
      expect(await screen.findByText('1234')).toBeInTheDocument()
      expect(screen.queryByText(/Detén el cronómetro/)).not.toBeInTheDocument()
    } else {
      expect(await screen.findByText(/Detén el cronómetro/)).toBeInTheDocument()
    }
    expect(loadAssignment('GAME1234')).toEqual(authoritative)
    expect(publicApi.join).not.toHaveBeenCalled()
  })

  it('captures and removes the fragment synchronously, exchanges once in StrictMode, and restores the same STACK player', async () => {
    mockGame('STACK', 'mobile', 'instagram')
    window.history.replaceState({ keep: true }, '', '/play/GAME1234?keep=1#access=secret-access&other=value')
    vi.mocked(publicApi.exchangeAccess).mockResolvedValue(playerResponse('STACK', assignment))
    renderParticipant(true)
    expect(window.location.hash).toBe('#other=value')
    expect(window.location.search).toBe('?keep=1')
    expect(window.history.state).toEqual({ keep: true })
    expect(await screen.findByText('Escena STACK: disponible')).toBeInTheDocument()
    expect(publicApi.exchangeAccess).toHaveBeenCalledTimes(1)
    expect(publicApi.exchangeAccess).toHaveBeenCalledWith({ gameId: 'GAME1234', accessToken: 'secret-access' })
    expect(publicApi.join).not.toHaveBeenCalled()
    expect(loadAssignment('GAME1234')).toEqual(assignment)
  })

  it.each(['master', 'mobile'] as const)('shows EMPAREJA2 branding and images with a hidden code in %s mode', async (mode) => {
    mockGame('EMPAREJA2', mode, 'web')
    const illustrated = {
      ...pairAssignment, characterImageUrl: 'https://images.test/sol.png',
      partnerCharacterImageUrl: 'https://images.test/luna.png',
      participantName: '@ana', profilePicUrl: 'https://images.test/ana.png',
    }
    savePlayerSession('GAME1234', 'token', illustrated)
    vi.mocked(publicApi.getPlayer).mockResolvedValue(playerResponse('EMPAREJA2', illustrated))
    renderParticipant()
    const ownImage = await screen.findByRole('img', { name: 'Sol' })
    expect(ownImage).toHaveAttribute('src', illustrated.characterImageUrl)
    expect(ownImage).toHaveClass('h-64', 'w-64', 'max-w-full')
    expect(screen.getByRole('img', { name: 'Luna' })).toHaveAttribute('src', illustrated.partnerCharacterImageUrl)
    const partnerImage = screen.getByRole('img', { name: 'Luna' })
    expect(partnerImage).toHaveClass('h-16', 'w-16')
    expect(partnerImage.parentElement).toHaveClass('grid', 'grid-cols-[minmax(0,1fr)_4rem]')
    expect(screen.getByText('Tu misión:').parentElement).toBe(partnerImage.previousElementSibling)
    expect(screen.getByRole('img', { name: 'EMPAREJA2' })).toHaveAttribute('src', '/images/empareja2-logo.png')
    const characterPanel = ownImage.parentElement
    const logo = screen.getByRole('img', { name: 'EMPAREJA2' })
    expect(logo.parentElement).toBe(characterPanel?.parentElement?.parentElement)
    expect(logo.nextElementSibling).toBe(characterPanel?.parentElement)
    expect(logo).toHaveClass('mx-auto')
    expect(characterPanel).toHaveClass('relative')
    const overlayHeader = screen.getByText('Te toca').parentElement
    expect(overlayHeader).toHaveClass('absolute', 'left-3', 'right-3', 'top-3', 'items-center', 'justify-between')
    const profile = screen.getByText('@ana').parentElement
    expect(profile?.parentElement).toBe(overlayHeader)
    expect(overlayHeader?.lastElementChild).toBe(profile)
    expect(profile?.querySelector('img')).toHaveAttribute('src', illustrated.profilePicUrl)
    expect(screen.getByText('@ana')).toHaveClass('truncate')
    expect(screen.getByRole('heading', { name: 'Sol' })).toHaveClass('absolute', 'bottom-3', 'right-3')
    expect(characterPanel?.firstElementChild).toBe(overlayHeader)
    expect(characterPanel?.lastElementChild).toBe(screen.getByRole('heading', { name: 'Sol' }))
    expect(screen.queryByText('5678')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
    expect(screen.getByText('5678').tagName).toBe('P')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('5678')).not.toBeInTheDocument()
    if (mode === 'master') {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(screen.getByText(/pantalla máster del evento/)).toBeInTheDocument()
    } else {
      expect(screen.getAllByRole('textbox')).toHaveLength(1)
      const ownThumbnail = screen.getByRole('img', { name: 'Sol' })
      const partnerThumbnail = screen.getByRole('img', { name: 'Luna' })
      expect(ownThumbnail).toHaveAttribute('src', illustrated.characterImageUrl)
      expect(partnerThumbnail).toHaveAttribute('src', illustrated.partnerCharacterImageUrl)
      expect(ownThumbnail).toHaveClass('h-16', 'w-16')
      expect(partnerThumbnail).toHaveClass('h-16', 'w-16')
      expect(ownThumbnail.nextElementSibling).toBe(screen.getByText('Tu código'))
      expect(partnerThumbnail.nextElementSibling).toHaveTextContent('Código de tu pareja')
      expect(screen.getByLabelText('Código de tu pareja')).toBe(screen.getByRole('textbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
      expect(screen.queryByText('5678')).not.toBeInTheDocument()
    }
    expect(publicApi.validate).not.toHaveBeenCalled()
  })

  it('uses the selected client logo instead of the game logo above the character panel', async () => {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType: 'EMPAREJA2', isActive: true,
      playMode: 'mobile', joinChannel: 'web', clientLogoUrl: 'https://images.test/client.png',
      playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '/play/GAME1234',
    })

    savePlayerSession('GAME1234', 'token', pairAssignment)
    vi.mocked(publicApi.getPlayer).mockResolvedValue(playerResponse('EMPAREJA2', {
      ...pairAssignment, characterImageUrl: 'https://images.test/sol.png',
    }))
    renderParticipant()
    const logo = await screen.findByRole('img', { name: 'Logo del cliente' })
    expect(logo).toHaveAttribute('src', 'https://images.test/client.png')
    expect(logo.nextElementSibling).toBe(screen.getByRole('img', { name: 'Sol' }).parentElement?.parentElement)
    expect(screen.queryByRole('img', { name: 'EMPAREJA2' })).not.toBeInTheDocument()
  })

  it.each([true, false])('uses owner appearance instead of participant browser colors (custom: %s)', async (custom) => {
      const previousColors = localStorage.getItem(STORAGE_KEY_COLORS)
      const previousMode = localStorage.getItem(STORAGE_KEY_THEME_MODE)
      localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify({
        primary: '#111111', accent: '#222222', background: '#000000',
        surface: '#000000', textMain: '#ffffff', textSub: '#aaaaaa',
      }))
      localStorage.setItem(STORAGE_KEY_THEME_MODE, 'dark')
      try {
        vi.mocked(publicApi.getGame).mockResolvedValue({
          ok: true, gameId: 'GAME1234', gameType: 'EMPAREJA2', isActive: true,
          playMode: 'mobile', joinChannel: 'web', clientLogoUrl: 'https://images.test/client.png',
          appearance: { colors: custom ? { primary: '#ff0000', accent: '#00ff00' } : null, themeMode: 'light' },
          playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '/play/GAME1234',
        })
        savePlayerSession('GAME1234', 'token', pairAssignment)
        vi.mocked(publicApi.getPlayer).mockResolvedValue(playerResponse('EMPAREJA2', pairAssignment))
        renderParticipant()
        expect(await screen.findByRole('img', { name: 'Logo del cliente' })).toBeInTheDocument()
        expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe(custom ? '#00ff00' : '#22D3EE')
        expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(custom ? '#ff0000' : '#B026FF')
        expect(document.documentElement.style.getPropertyValue('--color-accent-rgb')).toBe(custom ? '0,255,0' : '34,211,238')
        expect(document.documentElement).toHaveClass('light-mode')
        expect(screen.getByText('Luna').parentElement).toHaveClass('text-accent')
        const validate = screen.getByRole('button', { name: 'Validar pareja' })
        expect(validate).toHaveClass('text-accent', 'bg-[rgba(var(--color-accent-rgb),0.2)]')
        fireEvent.click(validate)
        expect(screen.getByRole('button', { name: 'Volver' })).toHaveClass('text-accent')
        expect(screen.getByRole('button', { name: 'Validar' })).toHaveClass('text-primary', 'bg-[rgba(var(--color-primary-rgb),0.25)]')
      } finally {
        if (previousColors === null) localStorage.removeItem(STORAGE_KEY_COLORS)
        else localStorage.setItem(STORAGE_KEY_COLORS, previousColors)
        if (previousMode === null) localStorage.removeItem(STORAGE_KEY_THEME_MODE)
        else localStorage.setItem(STORAGE_KEY_THEME_MODE, previousMode)
      }
  })

  it('validates the immutable own code together with the entered partner code and preserves errors', async () => {
    mockGame('EMPAREJA2', 'mobile', 'web')
    savePlayerSession('GAME1234', 'token', pairAssignment)
    vi.mocked(publicApi.getPlayer).mockResolvedValue(playerResponse('EMPAREJA2', pairAssignment))
    renderParticipant()
    fireEvent.click(await screen.findByRole('button', { name: 'Validar pareja' }))
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
    expect(screen.getByText('Introduce los dos códigos de la pareja.')).toBeInTheDocument()
    expect(publicApi.validate).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Código de tu pareja'), { target: { value: '12a34' } })
    expect(screen.getByLabelText('Código de tu pareja')).toHaveValue('1234')
    vi.mocked(publicApi.validate).mockResolvedValueOnce({ valid: false, gameId: 'GAME1234', message: 'No sois la pareja correcta.' })
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
    expect(await screen.findByText('No sois la pareja correcta.')).toBeInTheDocument()
    expect(publicApi.validate).toHaveBeenLastCalledWith({ gameId: 'GAME1234', playerToken: 'personal-session', codes: ['5678', '1234'] })
    vi.mocked(publicApi.validate).mockRejectedValueOnce(new Error('Sin conexión'))
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument()
    vi.mocked(publicApi.validate).mockResolvedValueOnce({ valid: true, gameId: 'GAME1234' })
    fireEvent.click(screen.getByRole('button', { name: 'Validar' }))
    expect(await screen.findByText('¡Pareja válida!')).toBeInTheDocument()
    expect(loadAssignment('GAME1234')).toMatchObject({ ...pairAssignment, validated: true })
  })

  it('reuses an in-flight exchange after unmounting instead of consuming the link twice', async () => {
    mockGame('T1MER', 'master', 'instagram')
    window.history.replaceState(null, '', '/play/GAME1234#access=remount-link')
    let finish!: (player: PlayerResponse) => void
    vi.mocked(publicApi.exchangeAccess).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const first = renderParticipant()
    await waitFor(() => expect(publicApi.exchangeAccess).toHaveBeenCalledTimes(1))
    first.unmount()
    renderParticipant(true)
    finish(playerResponse('T1MER', timerAssignment))
    expect(await screen.findByText('1234')).toBeInTheDocument()
    expect(publicApi.exchangeAccess).toHaveBeenCalledTimes(1)
    expect(publicApi.join).not.toHaveBeenCalled()
  })

  it.each(['AccessTokenInvalid', 'AccessTokenExpired', 'AccessTokenUsed', 'InvalidPlayerToken', 'PlayerNotFound'])('shows explicit DM recovery for %s without fallback to an existing session or registration', async (code) => {
    mockGame('T1MER', 'mobile', 'instagram')
    savePlayerSession('GAME1234', 'old-session', timerAssignment)
    window.history.replaceState(null, '', `/play/GAME1234#access=${code}`)
    vi.mocked(publicApi.exchangeAccess).mockRejectedValue(new PublicApiError(code, 401, code))
    renderParticipant(true)
    expect(await screen.findByRole('alert')).toHaveTextContent('no es válido, ya se ha utilizado o ha caducado')
    expect(screen.getByRole('alert')).toHaveTextContent('mensaje directo de Instagram')
    expect(publicApi.exchangeAccess).toHaveBeenCalledTimes(1)
    expect(publicApi.getPlayer).not.toHaveBeenCalled()
    expect(publicApi.join).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Detén el cronómetro/)).not.toBeInTheDocument()
    expect(loadPlayerToken('GAME1234')).toBe('old-session')
  })

  it('does not offer web registration for an Instagram-only access channel', async () => {
    mockGame('T1MER', 'mobile', 'instagram')
    renderParticipant()
    expect(await screen.findByText('Participa desde Instagram')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument()
  })

  it('rejects a session returned for a different game instead of saving it', async () => {
    mockGame('STACK', 'mobile', 'instagram')
    window.history.replaceState(null, '', '/play/GAME1234#access=wrong-game')
    vi.mocked(publicApi.exchangeAccess).mockResolvedValue({
      ...playerResponse('STACK', assignment), gameId: 'OTHER123',
    })
    renderParticipant()
    expect(await screen.findByRole('alert')).toHaveTextContent('Solicita un nuevo enlace')
    expect(loadAssignment('GAME1234')).toBeNull()
    expect(screen.queryByText(/Escena STACK/)).not.toBeInTheDocument()
  })

  it('rejects an empty access credential without silently registering', async () => {
    window.history.replaceState(null, '', '/play/GAME1234#access=')
    renderParticipant(true)
    expect(window.location.hash).toBe('')
    expect(await screen.findByRole('alert')).toHaveTextContent('Solicita un nuevo enlace')
    expect(publicApi.exchangeAccess).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument()
  })

  it('recovers a token-only session rather than registering a duplicate participant', async () => {
    savePlayerSession('GAME1234', 'token-only', assignment)
    sessionStorage.removeItem('stand_player_assignment_GAME1234')
    vi.mocked(publicApi.getPlayer).mockResolvedValue(playerResponse('STACK', assignment))
    renderParticipant()
    expect(await screen.findByText('Escena STACK: disponible')).toBeInTheDocument()
    expect(publicApi.getPlayer).toHaveBeenCalledWith('token-only', 'GAME1234')
    expect(publicApi.join).not.toHaveBeenCalled()
  })

  it.each(['master', 'mobile'] as const)('keeps restored validated %s results and prizes without an internal exit', async (mode) => {
    mockGame('EMPAREJA2', mode, 'web')
    savePlayerSession('GAME1234', 'token', pairAssignment)
    vi.mocked(publicApi.getPlayer).mockResolvedValue({
      ...playerResponse('EMPAREJA2', { ...pairAssignment, validated: true }),
      prizes: [{ kind: 'raffle', token: 'prize-token', delivered: false }],
    })
    renderParticipant()
    expect(await screen.findByText('¡Pareja válida!')).toBeInTheDocument()
    expect(await screen.findByText('Premio del sorteo')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'QR Premio del sorteo' })).toHaveAttribute('src', expect.stringContaining('data=prize-token'))
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it.each(['EMPAREJA2', 'T1MER'])('keeps legacy Instagram %s sessions in master mode', async (gameType) => {
    vi.mocked(publicApi.getGame).mockResolvedValue({
      ok: true, gameId: 'GAME1234', gameType, isActive: true, joinChannel: 'instagram',
      playerCount: 1, validatedCount: 0, recentPairs: [], joinUrl: '',
    } satisfies PublicGameResponse)
    savePlayerSession('GAME1234', 'token', assignment)
    vi.mocked(publicApi.getPlayer).mockResolvedValue(playerResponse(gameType, gameType === 'T1MER' ? timerAssignment : pairAssignment))
    renderParticipant()
    expect(await screen.findByText(/pantalla máster del evento/)).toBeInTheDocument()
    if (gameType === 'EMPAREJA2') {
      expect(screen.queryByText('5678')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Validar pareja' }))
      expect(screen.getByText('5678')).toBeInTheDocument()
      expect(publicApi.validate).not.toHaveBeenCalled()
    } else {
      expect(screen.queryByRole('button', { name: 'Validar pareja' })).not.toBeInTheDocument()
    }
    expect(screen.queryByText(/Detén el cronómetro/)).not.toBeInTheDocument()
  })
})
