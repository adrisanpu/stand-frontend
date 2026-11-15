import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { getFormResponses, type FormResponses } from '../../api/formResponses'
import { listOperatorGames } from '../../api/operatorGames'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'
import ResponsesAdmin, { buildResponsesCsv, buildResponsesSummary } from './ResponsesAdmin'

vi.mock('../../api/formResponses', () => ({ getFormResponses: vi.fn() }))
vi.mock('../../api/operatorGames', () => ({ listOperatorGames: vi.fn() }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))

const games = [{ gameId: 'ABC123', gameName: 'Quiz event', gameType: 'T1MER' }]
const responses: FormResponses = {
  ok: true as const, gameId: 'ABC123', gameName: 'Quiz event',
  questions: [{ id: 'q1', text: 'Favourite?', options: [
    { title: 'First', payload: 'first' }, { title: 'Second', payload: 'second' },
  ] }],
  players: [
    { playerId: 1, name: 'Ana', email: 'ana@example.test', completed: true,
      completedAt: '2026-01-02T03:04:05Z', answers: { q1: 'first' } },
    { playerId: 2, name: 'Bob', email: 'bob@example.test', completed: false,
      completedAt: null, answers: { q1: 'second' } },
  ],
}

function mount() {
  return render(<OperatorLanguageProvider><OperatorLanguageSelector /><MemoryRouter><ResponsesAdmin /></MemoryRouter></OperatorLanguageProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCurrentUser).mockReturnValue({ plan: 'event' } as ReturnType<typeof useCurrentUser>)
  vi.mocked(listOperatorGames).mockResolvedValue(games)
  vi.mocked(getFormResponses).mockResolvedValue(responses)
})

it('keeps responses readable but gates CSV export on the current plan', async () => {
  vi.mocked(useCurrentUser).mockReturnValue({ plan: 'free' } as ReturnType<typeof useCurrentUser>)
  mount()
  await screen.findByRole('region', { name: 'Resumen de respuestas' })
  expect(screen.getByRole('region', { name: 'Distribución: Favourite?' })).toHaveTextContent('1 (50%)')
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
  expect(screen.getByText('Exportar resultados está disponible en el plan Event.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toHaveAttribute('title', 'Disponible en el plan Event')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('shows question charts without a participant table and links to configuration', async () => {
  mount()
  const header = await screen.findByRole('region', { name: 'Resumen de respuestas' })
  expect(header).toHaveTextContent('Participantes con respuestas2')
  expect(header).toHaveTextContent('Formularios completados: 1')
  expect(screen.getByRole('link', { name: 'Configurar formulario' })).toHaveAttribute(
    'href', '/admin/games?form=ABC123',
  )
  const chart = screen.getByRole('region', { name: 'Distribución: Favourite?' })
  expect(within(chart).getByRole('heading')).toHaveTextContent('1. Favourite?')
  expect(chart).toHaveTextContent('Respuestas: 2')
  const options = within(chart).getAllByRole('listitem')
  expect(options[0]).toHaveTextContent('First1 (50%)')
  expect(options[1]).toHaveTextContent('Second1 (50%)')
  expect(options[0].querySelector('[aria-hidden="true"] > div')).toHaveStyle({ width: '50%' })
  expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  expect(screen.queryByText('bob@example.test')).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Filtrar por estado' })).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Paginación de respuestas' })).not.toBeInTheDocument()
})

it('loads archived games on request and presents readable load errors', async () => {
  vi.mocked(listOperatorGames).mockResolvedValueOnce(games).mockRejectedValueOnce(new Error('offline'))
  mount()
  await screen.findByText('Quiz event')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir partidas archivadas' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las partidas.')
  expect(listOperatorGames).toHaveBeenNthCalledWith(2, true)
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('region', { name: 'Resumen de respuestas' })).toBeInTheDocument()
  expect(listOperatorGames).toHaveBeenNthCalledWith(3, true)
})

it('does not offer form configuration for archived events', async () => {
  const archivedGame = { ...games[0], isActive: false as const, lifecycleState: 'inactive' as const, archivedAt: '2026-01-01T00:00:00Z' }
  vi.mocked(listOperatorGames).mockResolvedValueOnce(games).mockResolvedValueOnce([archivedGame])
  mount()
  await screen.findByRole('link', { name: 'Configurar formulario' })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir partidas archivadas' }))
  const select = await screen.findByRole('combobox', { name: 'Seleccionar partida' })
  fireEvent.change(select, { target: { value: 'ABC123' } })
  expect(await screen.findByText('Las partidas archivadas son de solo lectura y no se pueden configurar.')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Configurar formulario' })).not.toBeInTheDocument()
})

it('aggregates every loaded participant, including incomplete forms', async () => {
  vi.mocked(getFormResponses).mockResolvedValue({
    ...responses,
    players: Array.from({ length: 26 }, (_, index) => ({
      playerId: index + 1, name: `Player ${index + 1}`, email: `${index + 1}@example.test`,
      completed: false, completedAt: null, answers: { q1: index < 25 ? 'first' : 'second' },
    })),
  })
  mount()
  const chart = await screen.findByRole('region', { name: 'Distribución: Favourite?' })
  expect(chart).toHaveTextContent('Respuestas: 26')
  expect(chart).toHaveTextContent('25 (96,2%)')
  expect(chart).toHaveTextContent('1 (3,8%)')
  expect(screen.queryByText('Player 1')).not.toBeInTheDocument()
})

it('uses each question’s nonblank answers as the denominator and reports unknown options', () => {
  const summary = buildResponsesSummary([
    responses.players[0], responses.players[1],
    { ...responses.players[0], playerId: 3, answers: { q1: 'first', q2: 'yes' } },
    { ...responses.players[1], playerId: 4, answers: { q1: 'legacy' } },
    { ...responses.players[1], playerId: 5, answers: { q1: '  ' } },
    { ...responses.players[1], playerId: 6, answers: {} },
    { ...responses.players[1], playerId: 7, answers: { deletedQuestion: 'yes' } },
  ], [...responses.questions, { id: 'q2', text: 'Again?', options: [{ title: 'Yes', payload: 'yes' }] }])
  expect(summary.answeredCount).toBe(4)
  expect(summary.completedCount).toBe(2)
  expect(summary.questions[0].answerCount).toBe(4)
  expect(summary.questions[0].options.map(({ count, percentage }) => ({ count, percentage })))
    .toEqual([{ count: 2, percentage: 50 }, { count: 1, percentage: 25 }])
  expect(summary.questions[0].unrecognizedCount).toBe(1)
  expect(summary.questions[0].textAnswers).toEqual([])
  expect(summary.questions[1].answerCount).toBe(1)
  expect(summary.questions[1].options[0].percentage).toBe(100)
})

it('shows unknown-answer counts without treating raw values as current options', async () => {
  vi.mocked(getFormResponses).mockResolvedValue({
    ...responses, players: [...responses.players, { ...responses.players[1], playerId: 3, answers: { q1: 'legacy' } }],
  })
  mount()
  const chart = await screen.findByRole('region', { name: 'Distribución: Favourite?' })
  expect(chart).toHaveTextContent('Respuestas: 3')
  expect(within(chart).getAllByText('1 (33,3%)')).toHaveLength(2)
  expect(within(chart).getByRole('status')).toHaveTextContent('Respuestas que no coinciden con las opciones actuales: 1')
  expect(within(chart).queryByText('legacy')).not.toBeInTheDocument()
})

it('shows zero counts and zero-width bars for unanswered questions', async () => {
  vi.mocked(getFormResponses).mockResolvedValue({ ...responses, players: [] })
  mount()
  const chart = await screen.findByRole('region', { name: 'Distribución: Favourite?' })
  expect(chart).toHaveTextContent('Respuestas: 0')
  expect(chart).toHaveTextContent('Todavía no hay respuestas a esta pregunta.')
  expect(within(chart).getAllByText('0 (0%)')).toHaveLength(2)
  within(chart).getAllByRole('listitem').forEach(option => {
    expect(option.querySelector('[aria-hidden="true"] > div')).toHaveStyle({ width: '0%' })
  })
  expect(buildResponsesSummary([], responses.questions).answeredCount).toBe(0)
})

it('retains zero-vote options alongside selected options', async () => {
  vi.mocked(getFormResponses).mockResolvedValue({ ...responses, players: [responses.players[0]] })
  mount()
  const chart = await screen.findByRole('region', { name: 'Distribución: Favourite?' })
  const options = within(chart).getAllByRole('listitem')
  expect(options[0]).toHaveTextContent('First1 (100%)')
  expect(options[1]).toHaveTextContent('Second0 (0%)')
})

it('lists existing text answers for questions without options without participant details', async () => {
  const textResponses: FormResponses = {
    ...responses, questions: [{ id: 'q1', text: 'Comments?', options: [] }],
    players: [
      { ...responses.players[0], answers: { q1: 'Great event\nThank you!' } },
      { ...responses.players[1], answers: { q1: 'Great event\nThank you!' } },
      { ...responses.players[1], playerId: 3, answers: { q1: '   ' } },
    ],
  }
  vi.mocked(getFormResponses).mockResolvedValue(textResponses)
  mount()
  const chart = await screen.findByRole('region', { name: 'Distribución: Comments?' })
  expect(chart).toHaveTextContent('Respuestas: 2')
  expect(within(chart).getAllByRole('listitem')).toHaveLength(2)
  expect(chart).toHaveTextContent('Great event Thank you!')
  expect(screen.queryByText('Ana')).not.toBeInTheDocument()
  expect(chart.querySelector('[aria-hidden="true"]')).toBeNull()
  expect(buildResponsesSummary(textResponses.players, textResponses.questions).questions[0].textAnswers)
    .toEqual(['Great event\nThank you!', 'Great event\nThank you!'])
})

it('shows an explicit empty-questionnaire state', async () => {
  vi.mocked(getFormResponses).mockResolvedValue({ ...responses, questions: [] })
  mount()
  expect(await screen.findByText('Esta partida no tiene preguntas de cuestionario.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('shows an explicit empty-events state without requesting responses', async () => {
  vi.mocked(listOperatorGames).mockResolvedValue([])
  mount()
  expect(await screen.findByText('No hay partidas disponibles.')).toBeInTheDocument()
  expect(getFormResponses).not.toHaveBeenCalled()
})

it('retries response load errors', async () => {
  vi.mocked(getFormResponses).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(responses)
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las respuestas.')
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('region', { name: 'Distribución: Favourite?' })).toBeInTheDocument()
  expect(getFormResponses).toHaveBeenCalledTimes(2)
})

it('switches events without retaining charts from the previous selection', async () => {
  vi.mocked(listOperatorGames).mockResolvedValue([...games, { ...games[0], gameId: 'OTHER', gameName: 'Other event' }])
  vi.mocked(getFormResponses).mockResolvedValueOnce(responses).mockResolvedValueOnce({
    ...responses, gameId: 'OTHER', questions: [{ id: 'q2', text: 'Other question?', options: [] }], players: [],
  })
  mount()
  await screen.findByRole('region', { name: 'Distribución: Favourite?' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Seleccionar partida' }), { target: { value: 'OTHER' } })
  expect(await screen.findByRole('region', { name: 'Distribución: Other question?' })).toHaveTextContent('Respuestas: 0')
  expect(screen.queryByRole('region', { name: 'Distribución: Favourite?' })).not.toBeInTheDocument()
  expect(getFormResponses).toHaveBeenLastCalledWith('OTHER')
})

it('localizes chart labels and fractional percentages in English', async () => {
  vi.mocked(getFormResponses).mockResolvedValue({
    ...responses, players: [...responses.players, { ...responses.players[1], playerId: 3 }],
  })
  mount()
  await screen.findByRole('region', { name: 'Resumen de respuestas' })
  fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
  const chart = screen.getByRole('region', { name: 'Distribution: Favourite?' })
  expect(chart).toHaveTextContent('Answers: 3')
  expect(chart).toHaveTextContent('1 (33.3%)')
  expect(chart).toHaveTextContent('2 (66.7%)')
  expect(screen.getByRole('region', { name: 'Response summary' })).toHaveTextContent('Completed forms: 1')
})

it('downloads all event records as CSV, including participants without answers', async () => {
  const allPlayers = [...responses.players, { ...responses.players[1], playerId: 3, name: 'No answers', answers: {} }]
  vi.mocked(getFormResponses).mockResolvedValue({ ...responses, players: allPlayers })
  mount()
  await screen.findByRole('region', { name: 'Resumen de respuestas' })
  const createObjectURL = vi.fn((blob: Blob) => {
    expect(blob.type).toBe('text/csv;charset=utf-8')
    return 'blob:csv'
  })
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('responses-ABC123.csv')
    expect(this.href).toBe('blob:csv')
  })
  fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
  expect(createObjectURL).toHaveBeenCalledOnce()
  const blob = createObjectURL.mock.calls[0][0]
  const csv = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
  expect(csv.split('\r\n')).toHaveLength(4)
  expect(csv).toContain('"Ana"')
  expect(csv).toContain('"Bob"')
  expect(csv).toContain('"No answers"')
  expect(csv).toContain('"First"')
  expect(csv).toContain('"Second"')
  expect(click).toHaveBeenCalledOnce()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv')
})

it('exports escaped CSV cells and neutralizes spreadsheet formulas', () => {
  const csv = buildResponsesCsv([{
    playerId: 1, name: '=2+2', email: 'safe@example.test', completed: true,
    completedAt: null, answers: { q1: '+SUM(A1:A2)' },
  }], responses.questions)
  expect(csv).toContain('"\'=2+2"')
  expect(csv).toContain("\"'+SUM(A1:A2)\"")
})

it('keeps registration details out of the summary but preserves safe CSV profile columns', async () => {
  const player = { ...responses.players[0], phone: '+34612345678', address: 'Street 1',
    company: '=Company', sex: 'female', jobTitle: 'Engineer', birthDate: '2000-01-02' }
  vi.mocked(getFormResponses).mockResolvedValue({ ...responses, players: [player] })
  mount()
  await screen.findByRole('region', { name: 'Resumen de respuestas' })
  expect(screen.queryByText('Street 1')).not.toBeInTheDocument()
  expect(screen.queryByText('Engineer')).not.toBeInTheDocument()
  expect(screen.queryByText('Femenino')).not.toBeInTheDocument()
  expect(screen.queryByText('2000-01-02')).not.toBeInTheDocument()
  const csv = buildResponsesCsv([player], [])
  expect(csv).toContain("\"'+34612345678\"")
  expect(csv).toContain('"Street 1"')
  expect(csv).toContain("\"'=Company\"")
  expect(csv).toContain('"Female","2000-01-02","Engineer"')
  expect(buildResponsesCsv([player], [], undefined, 'es')).toContain('"Femenino","2000-01-02","Engineer"')
})
