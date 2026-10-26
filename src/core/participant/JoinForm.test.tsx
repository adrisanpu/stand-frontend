import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { PublicApiError, publicApi, type PublicGameResponse } from '../../api/publicApi'
import { savePlayerSession } from './playerSession'
import JoinForm from './JoinForm'
import ParticipantPrizePromo from './ParticipantPrizePromo'
import { ParticipantLanguageProvider, ParticipantLanguageSelector } from './participantLanguage'
import type { PrizeCatalog } from '../prizes'

vi.mock('../../api/publicApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../api/publicApi')>(),
  publicApi: { join: vi.fn(), requestEmailCode: vi.fn(), uploadParticipantPhoto: vi.fn() },
}))
vi.mock('./playerSession', () => ({ savePlayerSession: vi.fn() }))

const meta: PublicGameResponse = {
  ok: true, gameId: 'ABC123', gameType: 'T1MER', isActive: true,
  playMode: 'mobile', joinChannel: 'web', playerCount: 0, validatedCount: 0,
  recentPairs: [], joinUrl: '/play/ABC123',
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(publicApi.requestEmailCode).mockResolvedValue({
    ok: true, challengeId: 'challenge-1', emailMasked: 'p***@example.com',
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
  })
  vi.mocked(publicApi.join).mockResolvedValue({
    ok: true, gameId: 'ABC123', gameType: 'T1MER', playerToken: 'token',
    assignment: { playerId: 1, displayName: 'Jugador', validated: false },
  })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const catalog: PrizeCatalog = {
  validation: { name: 'Mochila', limit: 20, imageKey: 'validation.png', imageUrl: '/prizes/backpack.png' },
  ranking: { name: 'Auriculares', limit: null, topX: 3, imageKey: 'ranking.png', imageUrl: '/prizes/headphones.png' },
  raffle: { name: 'Sorteo secreto', limit: 1, imageUrl: '/prizes/raffle.png' },
}

describe('participant prize promotion', () => {
  it('shows validation and ranking before registration fields, never the raffle', () => {
    render(<>
      <ParticipantPrizePromo catalog={catalog} stickers />
      <JoinForm gameId="ABC123" gameMeta={{ ...meta, prizeCatalog: catalog }} onJoined={vi.fn()} />
    </>)
    expect(screen.getByRole('img', { name: 'Mochila' })).toHaveAttribute('src', '/prizes/backpack.png')
    expect(screen.getByRole('img', { name: 'Auriculares' })).toHaveAttribute('src', '/prizes/headphones.png')
    expect(screen.queryByText('Sorteo secreto')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Sorteo secreto' })).not.toBeInTheDocument()
    const heading = screen.getByLabelText('Premios en juego')
    expect(heading.compareDocumentPosition(screen.getByLabelText('Email *')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(heading).toHaveClass('-mb-8', 'items-start')
    expect(screen.getByText('PREMIO: Mochila').closest('.rounded-full')).toHaveClass('self-start', 'h-16', 'border-primary')
    expect(screen.queryByText('0/20')).not.toBeInTheDocument()
  })

  it('keeps text-only prizes and hides slots with zero availability', () => {
    render(<ParticipantPrizePromo catalog={{
      validation: { name: 'Sin existencias', limit: 0, imageUrl: '/out.png' },
      ranking: { name: 'Entrada', limit: null, topX: 3 },
    }} stickers />)
    expect(screen.getByText('PREMIO TOP 3: Entrada')).toBeInTheDocument()
    expect(screen.queryByText('Sin existencias')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not add empty promotion panels for legacy games', () => {
    render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
    expect(screen.queryByRole('heading', { name: 'Premios en juego' })).not.toBeInTheDocument()
  })

  it('translates promotional labels without translating prize names or resetting fields', () => {
    render(
      <ParticipantLanguageProvider>
        <ParticipantLanguageSelector />
        <ParticipantPrizePromo catalog={catalog} stickers />
        <JoinForm gameId="ABC123" gameMeta={{ ...meta, prizeCatalog: catalog }} onJoined={vi.fn()} />
      </ParticipantLanguageProvider>
    )
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
    expect(screen.getByLabelText('Prizes to play for')).toBeInTheDocument()
    expect(screen.getByText('PRIZE: Mochila')).toBeInTheDocument()
    expect(screen.getByText('TOP PRIZE 3: Auriculares')).toBeInTheDocument()
    expect(screen.getByLabelText('Email *')).toHaveValue('player@example.com')
  })
})

describe('participant registration fields', () => {
  it.each(Array.from({ length: 4 }, (_, mask) => ({
    email: Boolean(mask & 1), phone: Boolean(mask & 2),
  })))('always verifies email and only requests enabled optional phone: %o', async ({ email, phone }) => {
    const onJoined = vi.fn()
    render(<JoinForm gameId="ABC123" gameMeta={{
      ...meta, participantFields: {
        email: { required: email }, phone: { required: phone },
      },
    }} onJoined={onJoined} />)
    const emailInput = screen.getByLabelText('Email *')
    expect(emailInput).toBeRequired()
    fireEvent.change(emailInput, { target: { value: 'player@example.com' } })
    const phoneInput = screen.queryByLabelText('Teléfono (opcional)')
    if (phone) {
      expect(phoneInput).not.toBeRequired()
      expect(phoneInput).toHaveAttribute('type', 'tel')
      fireEvent.change(phoneInput!, { target: { value: '+34 600123456' } })
    } else expect(phoneInput).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Instagram *')).not.toBeInTheDocument()
    const usernameInput = screen.getByLabelText('Nombre completo *')
    expect(usernameInput).toBeRequired()
    fireEvent.change(usernameInput, { target: { value: 'Player' } })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(usernameInput).toHaveAttribute('autocomplete', 'name')
    expect(usernameInput.compareDocumentPosition(emailInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
    const registration = {
      gameId: 'ABC123', consent: true,
      username: 'Player',
      email: 'player@example.com',
      ...(phone ? { phone: '+34 600123456' } : {}),
    }
    await screen.findByLabelText('Código de verificación')
    expect(publicApi.requestEmailCode).toHaveBeenCalledWith({ ...registration, language: 'es' })
    expect(publicApi.join).not.toHaveBeenCalled()
    expect(savePlayerSession).not.toHaveBeenCalled()
    expect(onJoined).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '012345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('token'))
    expect(publicApi.join).toHaveBeenCalledWith({ gameId: 'ABC123', challengeId: 'challenge-1', code: '012345' })
  })

  async function startVerification() {
    fillFullName()
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /Enviar código|Send code/ }))
    await act(async () => {})
    return screen.getByLabelText(/Código de verificación|Verification code/)
  }

  function fillFullName() {
    const input = screen.queryByLabelText(/^(Nombre completo|Full name) \*$/) as HTMLInputElement | null
    if (input && !input.value) fireEvent.change(input, { target: { value: 'Player' } })
  }

  describe('required username', () => {
    it.each([
      { email: false, phone: false }, { email: false, phone: true },
      { email: true, phone: false }, { email: true, phone: true },
    ])('requires username before joining with contact configuration %o', ({ email, phone }) => {
      render(<JoinForm gameId="ABC123" gameMeta={{
        ...meta, participantFields: {
          email: { required: email }, phone: { required: phone },
        },
      }} onJoined={vi.fn()} />)
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      if (phone) fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '+34123456789' } })
      const input = screen.getByLabelText('Nombre completo *')
      expect(input).toHaveValue('')
      fireEvent.change(input, { target: { value: '  ' } })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.submit(input.closest('form')!)
      expect(screen.getByRole('alert')).toHaveTextContent('El nombre completo es obligatorio.')
      expect(publicApi.join).not.toHaveBeenCalled()
      expect(publicApi.requestEmailCode).not.toHaveBeenCalled()
    })

    it('binds the trimmed name to the challenge, resends it, and verifies without resubmitting identity fields', async () => {
      vi.useFakeTimers()
      const onJoined = vi.fn()
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={onJoined} />)
      fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: '  Ana 🌟  ' } })
      await startVerification()
      const registration = {
        gameId: 'ABC123', email: 'player@example.com', username: 'Ana 🌟', consent: true, language: 'es',
      }
      expect(publicApi.requestEmailCode).toHaveBeenCalledWith(registration)
      expect(screen.queryByLabelText('Nombre completo *')).not.toBeInTheDocument()
      await act(async () => { vi.advanceTimersByTime(60_000) })
      fireEvent.click(screen.getByRole('button', { name: 'Reenviar código' }))
      await act(async () => {})
      expect(publicApi.requestEmailCode).toHaveBeenCalledTimes(2)
      expect(publicApi.requestEmailCode).toHaveBeenLastCalledWith(registration)
      fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '012345' } })
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
      await act(async () => {})
      expect(onJoined).toHaveBeenCalledWith('token')
      expect(publicApi.join).toHaveBeenCalledWith({ gameId: 'ABC123', challengeId: 'challenge-1', code: '012345' })
      expect(publicApi.uploadParticipantPhoto).not.toHaveBeenCalled()
    })

    it.each(['', '   '])('rejects an empty username explicitly: %j', (username) => {
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      const input = screen.getByLabelText('Nombre completo *')
      fireEvent.change(input, { target: { value: username } })
      fireEvent.submit(input.closest('form')!)
      expect(screen.getByRole('alert')).toHaveTextContent('El nombre completo es obligatorio.')
      expect(publicApi.requestEmailCode).not.toHaveBeenCalled()
    })

    it('counts Unicode characters rather than UTF-16 units at the name length boundary', async () => {
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: '🌟'.repeat(100) } })
      await startVerification()
      expect(publicApi.requestEmailCode).toHaveBeenCalledWith(expect.objectContaining({ username: '🌟'.repeat(100) }))
    })

    it.each(['a'.repeat(101), 'Ana\u0007', 'Ana\u007f', 'Ana\u0085B'])('rejects invalid names before requesting a challenge', async (username) => {
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: username } })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Usa un nombre completo de hasta 100 caracteres sin caracteres de control.')
      expect(publicApi.requestEmailCode).not.toHaveBeenCalled()
    })

    it('translates the required field and server validation error', async () => {
      vi.mocked(publicApi.requestEmailCode).mockRejectedValueOnce(new PublicApiError('invalid', 400, 'invalid_username'))
      render(<ParticipantLanguageProvider>
        <ParticipantLanguageSelector />
        <JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />
      </ParticipantLanguageProvider>)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
      expect(screen.getByLabelText('Full name *')).toBeRequired()
      fillFullName()
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Use a full name of up to 100 characters without control characters.')
    })
  })

  describe('optional participant photo', () => {
    const noRequiredFields = {
      ...meta,
      participantFields: {
        email: { required: false },
        phone: { required: false },
      },
    }

    it('uploads a selected photo before saving the player session', async () => {
      const onJoined = vi.fn()
      const photo = new File([new Uint8Array([1, 2, 3])], 'profile.png', { type: 'image/png' })
      vi.mocked(publicApi.uploadParticipantPhoto).mockResolvedValueOnce('https://photo.example/profile.png')
      render(<JoinForm gameId="ABC123" gameMeta={noRequiredFields} onJoined={onJoined} />)

      fillFullName()
      fireEvent.change(screen.getByLabelText('Foto de perfil (opcional)'), { target: { files: [photo] } })
      await startVerification()
      fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '012345' } })
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))

      await waitFor(() => expect(onJoined).toHaveBeenCalledWith('token'))
      expect(publicApi.uploadParticipantPhoto).toHaveBeenCalledWith(photo, 'token')
      expect(savePlayerSession).toHaveBeenCalledWith('ABC123', 'token', {
        playerId: 1,
        displayName: 'Jugador',
        validated: false,
        profilePicUrl: 'https://photo.example/profile.png',
      })
    })

    it('continues without the photo and reports the generic avatar if upload fails', async () => {
      const onJoined = vi.fn()
      const photo = new File([new Uint8Array([1, 2, 3])], 'profile.png', { type: 'image/png' })
      vi.mocked(publicApi.uploadParticipantPhoto).mockRejectedValueOnce(new Error('network failure'))
      render(<JoinForm gameId="ABC123" gameMeta={noRequiredFields} onJoined={onJoined} />)

      fillFullName()
      fireEvent.change(screen.getByLabelText('Foto de perfil (opcional)'), { target: { files: [photo] } })
      await startVerification()
      fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '012345' } })
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))

      await waitFor(() => expect(onJoined).toHaveBeenCalledWith('token', true))
      expect(savePlayerSession).toHaveBeenCalledWith('ABC123', 'token', {
        playerId: 1,
        displayName: 'Jugador',
        validated: false,
      })
    })
  })

  describe('email verification', () => {
    it.each([
      ['InvalidJson', 'Unable to submit registration. Check your details and try again.'],
      ['ConsentRequired', 'You must accept the privacy policy.'],
      ['EmailNotRequested', 'The form configuration has changed. Reload the page to register.'],
      ['InvalidLanguage', 'Unable to submit registration. Check your details and try again.'],
      ['InvalidGameId', 'Game not found. Check your participation link.'],
      ['GameNotFound', 'Game not found. Check your participation link.'],
      ['GameInactive', 'The game is not active. Ask the event team.'],
      ['web_join_disabled', 'Web registration is unavailable for this game. Ask the event team.'],
      ['unsupported_game_type', 'Web registration is unavailable for this game. Ask the event team.'],
      ['missing_email', 'Email is required.'],
      ['missing_username', 'Full name is required.'],
      ['invalid_email', 'Enter a valid email address.'],
      ['missing_phone', 'Phone number is required.'],
      ['invalid_phone', 'Enter a valid phone number.'],
      ['InternalError', 'Unable to complete registration. Please try again later.'],
      ['UnknownFailure', 'Unable to complete registration. Please try again later.'],
    ])('localizes request validation failure %s without exposing server text', async (errorCode, message) => {
      vi.mocked(publicApi.requestEmailCode).mockRejectedValueOnce(new PublicApiError('HTTP 500 / raw server details', 500, errorCode))
      render(<ParticipantLanguageProvider><ParticipantLanguageSelector />
        <JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />
      </ParticipantLanguageProvider>)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
      fillFullName()
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(publicApi.join).not.toHaveBeenCalled()
      expect(savePlayerSession).not.toHaveBeenCalled()
      expect(screen.getByLabelText('Email *')).toHaveValue('player@example.com')
      expect(screen.getByRole('checkbox')).toBeChecked()
    })

    it.each([
      new PublicApiError('HTTP 500', 500),
      new Error('Failed to fetch'),
    ])('uses a friendly Spanish fallback for unclassified failures', async (error) => {
      vi.mocked(publicApi.requestEmailCode).mockRejectedValueOnce(error)
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      fillFullName()
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo completar el registro. Inténtalo de nuevo más tarde.')
    })

    it('localizes capacity errors from finalization without creating a session', async () => {
      vi.mocked(publicApi.join).mockRejectedValueOnce(new PublicApiError('player_limit_reached', 409, 'player_limit_reached'))
      render(<ParticipantLanguageProvider><ParticipantLanguageSelector />
        <JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />
      </ParticipantLanguageProvider>)
      const input = await startVerification()
      fireEvent.change(input, { target: { value: '012345' } })
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('El juego ha alcanzado el límite de participantes.')
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
      expect(screen.getByRole('alert')).toHaveTextContent('The game has reached its participant limit. Ask the event team.')
      expect(savePlayerSession).not.toHaveBeenCalled()
    })

    it('requires consent before requesting a code for legacy defaults', () => {
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      fillFullName()
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Debes aceptar')
      expect(publicApi.requestEmailCode).not.toHaveBeenCalled()
    })

    it('keeps wrong codes pending and saves only after a successful retry', async () => {
      const onJoined = vi.fn()
      const storage = vi.spyOn(Storage.prototype, 'setItem')
      vi.mocked(publicApi.join).mockRejectedValueOnce(new PublicApiError('untranslated', 400, 'InvalidVerificationCode'))
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={onJoined} />)
      const input = await startVerification()
      expect(input).toHaveAttribute('type', 'text')
      expect(input).toHaveAttribute('inputmode', 'numeric')
      expect(input).toHaveAttribute('maxlength', '6')
      expect(input).toHaveAttribute('pattern', '[0-9]{6}')
      expect(input).toHaveAttribute('autocomplete', 'one-time-code')
      fireEvent.change(input, { target: { value: '000001' } })
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
      await screen.findByText('El código no es correcto. Inténtalo de nuevo.')
      expect(savePlayerSession).not.toHaveBeenCalled()
      expect(onJoined).not.toHaveBeenCalled()
      expect(storage).not.toHaveBeenCalled()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      fireEvent.change(input, { target: { value: '000002' } })
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
      await waitFor(() => expect(savePlayerSession).toHaveBeenCalledWith('ABC123', 'token', expect.any(Object)))
      expect(onJoined).toHaveBeenCalledOnce()
    })

    it('accepts pasted digits without losing leading zeros and rejects incomplete codes', async () => {
      const user = userEvent.setup()
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      const input = await startVerification()
      fireEvent.change(input, { target: { value: '012' } })
      fireEvent.submit(input.closest('form')!)
      expect(screen.getByRole('alert')).toHaveTextContent('6 dígitos')
      expect(publicApi.join).not.toHaveBeenCalled()
      await user.clear(input)
      await user.paste('001234')
      expect(input).toHaveValue('001234')
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
      await waitFor(() => expect(publicApi.join).toHaveBeenCalledWith({
        gameId: 'ABC123', challengeId: 'challenge-1', code: '001234',
      }))
    })

    it('resends only after server cooldown using captured fields and replaces the challenge', async () => {
      vi.useFakeTimers()
      render(<JoinForm gameId="ABC123" gameMeta={{ ...meta, participantFields: {
        email: { required: true }, phone: { required: true },
      } }} onJoined={vi.fn()} />)
      fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '+34123456789' } })
      const input = await startVerification()
      expect(screen.queryByLabelText('Email *')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Instagram *')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Nombre completo *')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Teléfono (opcional)')).not.toBeInTheDocument()
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      expect(screen.queryByText('Regístrate para jugar desde tu móvil')).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Política de privacidad' })).not.toBeInTheDocument()
      fireEvent.change(input, { target: { value: '123456' } })
      expect(screen.getByRole('button', { name: /Reenviar código/ })).toBeDisabled()
      await act(async () => { vi.advanceTimersByTime(59_000) })
      expect(screen.getByRole('button', { name: /Reenviar código/ })).toBeDisabled()
      await act(async () => { vi.advanceTimersByTime(1_000) })
      expect(screen.getByRole('button', { name: /Reenviar código/ })).toBeEnabled()
      vi.mocked(publicApi.requestEmailCode).mockResolvedValueOnce({
        ok: true, challengeId: 'challenge-2', emailMasked: 'p***@example.com',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
      })
      fireEvent.click(screen.getByRole('button', { name: /Reenviar código/ }))
      await act(async () => {})
      expect(publicApi.requestEmailCode).toHaveBeenLastCalledWith({
        gameId: 'ABC123', email: 'player@example.com', username: 'Player',
        phone: '+34123456789', consent: true, language: 'es',
      })
      expect(input).toHaveValue('')
      expect(screen.getByRole('button', { name: /Reenviar código/ })).toBeDisabled()
      fireEvent.change(input, { target: { value: '012345' } })
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
      await act(async () => {})
      expect(publicApi.join).toHaveBeenCalledWith({ gameId: 'ABC123', challengeId: 'challenge-2', code: '012345' })
    })

    it('invalidates a challenge on edit without clearing fields or consent', async () => {
      vi.useFakeTimers()
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      await startVerification()
      fireEvent.click(screen.getByRole('button', { name: 'Cambiar datos' }))
      expect(screen.queryByLabelText('Código de verificación')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Email *')).toHaveValue('player@example.com')
      expect(screen.getByLabelText('Email *')).toBeEnabled()
      expect(screen.getByRole('checkbox')).toBeChecked()
      expect(screen.getByText('Regístrate para jugar desde tu móvil')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Política de privacidad' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled()
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'new@example.com' } })
      await act(async () => { vi.advanceTimersByTime(60_000) })
      fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
      await act(async () => {})
      expect(publicApi.requestEmailCode).toHaveBeenLastCalledWith({
        gameId: 'ABC123', email: 'new@example.com', username: 'Player', consent: true, language: 'es',
      })
      expect(publicApi.join).not.toHaveBeenCalled()
      expect(savePlayerSession).not.toHaveBeenCalled()
    })

    it('expires according to the server timestamp and allows resending or editing', async () => {
      vi.useFakeTimers()
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      const input = await startVerification()
      await act(async () => { vi.advanceTimersByTime(600_000) })
      expect(input).toBeDisabled()
      expect(screen.getByText('El código ha caducado. Solicita uno nuevo.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Verificar y empezar' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Reenviar código' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Cambiar datos' })).toBeEnabled()
      expect(publicApi.join).not.toHaveBeenCalled()
    })

    it.each(['VerificationRequired', 'VerificationExpired', 'VerificationAttemptsExceeded', 'VerificationSuperseded', 'VerificationUsed'])(
      'blocks final join after %s but allows requesting a new code', async (errorCode) => {
        vi.mocked(publicApi.join).mockRejectedValueOnce(new PublicApiError('raw server text', 400, errorCode))
        render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
        const input = await startVerification()
        fireEvent.change(input, { target: { value: '123456' } })
        fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Verificar y empezar' })).toBeDisabled())
        expect(screen.getByRole('alert')).not.toHaveTextContent('raw server text')
        expect(input).toBeDisabled()
        expect(savePlayerSession).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Cambiar datos' })).toBeEnabled()
      },
    )

    it.each([
      ['EmailDeliveryFailed', 'Unable to send the email. Try again.'],
      ['VerificationUnavailable', 'Email verification is unavailable. Try again later.'],
      ['EmailRateLimited', 'Too many requests. Wait before requesting another code.'],
    ])('localizes %s and sends the selected language', async (errorCode, message) => {
      vi.mocked(publicApi.requestEmailCode).mockRejectedValueOnce(new PublicApiError('raw server text', 503, errorCode))
      render(<ParticipantLanguageProvider><ParticipantLanguageSelector />
        <JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />
      </ParticipantLanguageProvider>)
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
      fillFullName()
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Send code' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      expect(publicApi.requestEmailCode).toHaveBeenCalledWith({
        gameId: 'ABC123', email: 'player@example.com', username: 'Player', consent: true, language: 'en',
      })
      expect(publicApi.join).not.toHaveBeenCalled()
    })

    it('translates a pending challenge and its error without resetting the code', async () => {
      vi.mocked(publicApi.join).mockRejectedValueOnce(new PublicApiError('raw', 400, 'InvalidVerificationCode'))
      render(<ParticipantLanguageProvider><ParticipantLanguageSelector />
        <JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />
      </ParticipantLanguageProvider>)
      const input = await startVerification()
      fireEvent.change(input, { target: { value: '012345' } })
      fireEvent.click(screen.getByRole('button', { name: 'Verificar y empezar' }))
      await screen.findByRole('alert')
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'en' } })
      expect(screen.getByLabelText('Verification code')).toHaveValue('012345')
      expect(screen.getByRole('status')).toHaveTextContent('Code sent to: p***@example.com')
      expect(screen.getByRole('alert')).toHaveTextContent('The code is incorrect. Try again.')
      expect(screen.getByRole('button', { name: 'Verify and start' })).toBeEnabled()
      expect(publicApi.requestEmailCode).toHaveBeenCalledOnce()
    })

    it('honors rate-limit retryAfter even before a challenge exists', async () => {
      vi.useFakeTimers()
      vi.mocked(publicApi.requestEmailCode).mockRejectedValueOnce(new PublicApiError('raw', 429, 'EmailRateLimited', 90))
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
      fillFullName()
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      fireEvent.click(screen.getByRole('checkbox'))
      fireEvent.click(screen.getByRole('button', { name: 'Enviar código' }))
      await act(async () => {})
      expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled()
      await act(async () => { vi.advanceTimersByTime(89_000) })
      expect(screen.getByRole('button', { name: 'Enviar código' })).toBeDisabled()
      await act(async () => { vi.advanceTimersByTime(1_000) })
      expect(screen.getByRole('button', { name: 'Enviar código' })).toBeEnabled()
      expect(publicApi.join).not.toHaveBeenCalled()
    })

    it('prevents duplicate requests while delivery is pending', async () => {
      let resolve!: (value: Awaited<ReturnType<typeof publicApi.requestEmailCode>>) => void
      vi.mocked(publicApi.requestEmailCode).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
      const onJoined = vi.fn()
      render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={onJoined} />)
      fillFullName()
      fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'player@example.com' } })
      fireEvent.click(screen.getByRole('checkbox'))
      const form = screen.getByLabelText('Email *').closest('form')!
      fireEvent.submit(form)
      fireEvent.submit(form)
      expect(publicApi.requestEmailCode).toHaveBeenCalledOnce()
      expect(publicApi.join).not.toHaveBeenCalled()
      expect(savePlayerSession).not.toHaveBeenCalled()
      expect(onJoined).not.toHaveBeenCalled()
      await act(async () => resolve({
        ok: true, challengeId: 'pending-challenge', emailMasked: 'p***@example.com',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
      }))
      expect(screen.getByLabelText('Código de verificación')).toBeInTheDocument()
    })
  })

  it('keeps email enabled by default, requires a username, and never requests Instagram', () => {
    render(<JoinForm gameId="ABC123" gameMeta={meta} onJoined={vi.fn()} />)
    expect(screen.getByLabelText('Email *')).toBeRequired()
    expect(screen.getByLabelText('Nombre completo *')).toBeRequired()
    expect(screen.queryByLabelText('Instagram *')).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })

  it('does not allow legacy settings to disable email verification', async () => {
    render(<JoinForm gameId="ABC123" gameMeta={{
      ...meta, participantFields: { email: { required: false } },
    }} onJoined={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Nombre completo *'), { target: { value: 'Player' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.submit(screen.getByLabelText('Email *').closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('El email es obligatorio.')
    expect(publicApi.join).not.toHaveBeenCalled()
    expect(publicApi.requestEmailCode).not.toHaveBeenCalled()
  })

  it('omits a whitespace-only optional phone', async () => {
    render(<JoinForm gameId="ABC123" gameMeta={{
      ...meta, participantFields: { email: { required: false }, phone: { required: false, enabled: true } },
    }} onJoined={vi.fn()} />)
    const input = screen.getByLabelText('Teléfono (opcional)')
    fireEvent.change(input, { target: { value: '   ' } })
    await startVerification()
    expect(publicApi.requestEmailCode).toHaveBeenCalledWith({
      gameId: 'ABC123', email: 'player@example.com', username: 'Player', consent: true, language: 'es',
    })
    expect(publicApi.join).not.toHaveBeenCalled()
  })

  it('honors an explicit hidden phone over the old required-phone setting', async () => {
    render(<JoinForm gameId="ABC123" gameMeta={{
      ...meta, participantFields: { phone: { required: true, enabled: false } },
    }} onJoined={vi.fn()} />)
    expect(screen.queryByLabelText('Teléfono (opcional)')).not.toBeInTheDocument()
    await startVerification()
    expect(publicApi.requestEmailCode).toHaveBeenCalledWith({
      gameId: 'ABC123', email: 'player@example.com', username: 'Player', consent: true, language: 'es',
    })
  })
})
