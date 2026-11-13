import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publicApi, type ParticipantQuizState, type PlayerResponse, type PublicGameResponse } from '../../api/publicApi'
import ParticipantQuiz from './ParticipantQuiz'

vi.mock('../../api/publicApi', () => ({ publicApi: { getPlayer: vi.fn(), submitQuiz: vi.fn() } }))
vi.mock('./participantLanguage', () => ({ useParticipantLanguage: () => ({ t: (text: string) => text }) }))
vi.mock('../theme', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => children }))

const quiz: ParticipantQuizState = {
  moment: 'after_registration', completed: false, finished: false, revision: 'r1',
  questions: [{ id: 'q1', text: '¿Qué prefieres?', options: [
    { title: 'Pizza', payload: 'ABC123_q1_a' }, { title: 'Pasta', payload: 'ABC123_q1_b' },
  ] }],
}
const game: PublicGameResponse = {
  ok: true, gameId: 'ABC123', gameType: 'T1MER', isActive: true, playerCount: 1,
  validatedCount: 0, recentPairs: [], joinUrl: '/play/ABC123',
  formConfig: {
    registrationTitle: '', registrationDescription: '', quizTitle: 'Tu opinión', quizDescription: '',
    logoKey: null, bannerKey: null, appearance: null, quizMoment: 'after_registration',
  },
}
const response = (state: ParticipantQuizState): PlayerResponse => ({
  ok: true, gameId: 'ABC123', gameType: 'T1MER', playerToken: 'token', assignment: null, prizes: [], quiz: state,
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(publicApi.getPlayer).mockResolvedValue(response(quiz))
  vi.mocked(publicApi.submitQuiz).mockResolvedValue(response({ ...quiz, completed: true }))
})
afterEach(cleanup)

function show(state = quiz, meta = game, token: string | null = 'token') {
  vi.mocked(publicApi.getPlayer).mockResolvedValue(response(state))
  return render(<ParticipantQuiz gameId="ABC123" playerToken={token} gameMeta={meta}>
    <button>Jugar</button>
  </ParticipantQuiz>)
}

describe('participant survey placement', () => {
  it('renders the saved shared form logo above the questionnaire', async () => {
    show(quiz, { ...game, formLogoUrl: '/event-logo.png',
      formConfig: { ...game.formConfig!, logoKey: 'users/owner/logos/event.png' } })
    const heading = await screen.findByRole('heading', { name: 'Tu opinión' })
    expect(heading.previousElementSibling).toHaveAttribute('src', '/event-logo.png')
    expect(publicApi.submitQuiz).not.toHaveBeenCalled()
  })

  it('does not show a default heading when no questionnaire title is configured', async () => {
    show(quiz, { ...game, formConfig: { ...game.formConfig!, quizTitle: '' } })
    await screen.findByLabelText('Pizza')
    expect(screen.queryByRole('heading', { name: 'Cuéntanos tu opinión' })).not.toBeInTheDocument()
  })

  it('does not request participant data before registration or when disabled', () => {
    show(quiz, game, null)
    expect(screen.getByText('Jugar')).toBeInTheDocument()
    expect(publicApi.getPlayer).not.toHaveBeenCalled()
  })

  it('blocks gameplay after registration until the submission is confirmed', async () => {
    show()
    expect(screen.queryByText('Jugar')).not.toBeInTheDocument()
    fireEvent.click(await screen.findByLabelText('Pizza'))
    await screen.findByText('Jugar')
    expect(publicApi.submitQuiz).toHaveBeenCalledWith('ABC123', 'token', { q1: 'ABC123_q1_a' }, 'r1')
    expect(screen.queryByRole('button', { name: 'Enviar respuestas' })).not.toBeInTheDocument()
  })

  it('submits automatically only after every question has an answer', async () => {
    const multipleQuestions = { ...quiz, questions: [
      ...quiz.questions,
      { id: 'q2', text: '¿Qué prefieres beber?', options: [
        { title: 'Agua', payload: 'ABC123_q2_a' }, { title: 'Café', payload: 'ABC123_q2_b' },
      ] },
    ] }
    show(multipleQuestions)
    fireEvent.click(await screen.findByLabelText('Pizza'))
    expect(publicApi.submitQuiz).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Agua'))
    await screen.findByText('Jugar')
    expect(publicApi.submitQuiz).toHaveBeenCalledWith('ABC123', 'token', {
      q1: 'ABC123_q1_a', q2: 'ABC123_q2_a',
    }, 'r1')
  })

  it('restores a completed survey without asking again', async () => {
    show({ ...quiz, completed: true })
    await screen.findByText('Jugar')
    expect(screen.queryByText('Tu opinión')).not.toBeInTheDocument()
    expect(publicApi.submitQuiz).not.toHaveBeenCalled()
  })

  it('waits for the authoritative end of the game', async () => {
    const meta = { ...game, formConfig: { ...game.formConfig!, quizMoment: 'after_game' as const } }
    show({ ...quiz, moment: 'after_game' }, meta)
    await waitFor(() => expect(publicApi.getPlayer).toHaveBeenCalled())
    expect(screen.getByText('Jugar')).toBeInTheDocument()
    expect(screen.queryByText('Tu opinión')).not.toBeInTheDocument()
  })

  it('shows the survey for a finished game', async () => {
    const meta = { ...game, formConfig: { ...game.formConfig!, quizMoment: 'after_game' as const } }
    show({ ...quiz, moment: 'after_game', finished: true }, meta)
    await screen.findByText('Tu opinión')
    expect(screen.queryByText('Jugar')).not.toBeInTheDocument()
  })

  it.each(['raffle', 'prize'] as const)('does not block gameplay for %s', async moment => {
    const meta = { ...game, formConfig: { ...game.formConfig!, quizMoment: moment } }
    show({ ...quiz, moment, prizePending: true }, meta)
    const open = await screen.findByRole('button', { name: 'Responder cuestionario' })
    expect(screen.getByText('Jugar')).toBeInTheDocument()
    fireEvent.click(open)
    expect(await screen.findByText('Tu opinión')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Volver al juego'))
    expect(screen.getByText('Jugar')).toBeInTheDocument()
  })

  it('keeps entered answers on failed save and retries submission', async () => {
    vi.mocked(publicApi.submitQuiz)
      .mockRejectedValueOnce(new Error('Network failed'))
      .mockResolvedValueOnce(response({ ...quiz, completed: true }))
    show()
    fireEvent.click(await screen.findByLabelText('Pasta'))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Pasta')).toBeChecked()
    fireEvent.click(screen.getByText('Reintentar envío'))
    await screen.findByText('Jugar')
    expect(publicApi.submitQuiz).toHaveBeenCalledTimes(2)
    expect(publicApi.submitQuiz).toHaveBeenLastCalledWith('ABC123', 'token', { q1: 'ABC123_q1_b' }, 'r1')
  })
})
