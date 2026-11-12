import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { getFormResponses } from '../../api/formResponses'
import { listOperatorGames } from '../../api/operatorGames'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { OperatorLanguageProvider } from '../shell/operatorLanguage'
import ResponsesAdmin, { buildResponsesCsv } from './ResponsesAdmin'

vi.mock('../../api/formResponses', () => ({ getFormResponses: vi.fn() }))
vi.mock('../../api/operatorGames', () => ({ listOperatorGames: vi.fn() }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))

const games = [{ gameId: 'ABC123', gameName: 'Quiz event', gameType: 'T1MER' }]
const responses = {
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
  return render(<OperatorLanguageProvider><MemoryRouter><ResponsesAdmin /></MemoryRouter></OperatorLanguageProvider>)
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
  await screen.findByRole('region', { name: 'Detalle de respuestas' })
  expect(screen.getByText('Ana')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled()
  expect(screen.getByText('Exportar resultados está disponible en el plan Event.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Exportar CSV' })).toHaveAttribute('title', 'Disponible en el plan Event')
})
afterEach(cleanup)

it('loads form analytics, filters participants, paginates data and links to configuration', async () => {
  mount()
  await screen.findByRole('region', { name: 'Detalle de respuestas' })
  expect(screen.getByText('Personas registradas').parentElement).toHaveTextContent('2')
  expect(screen.getByRole('link', { name: 'Configurar formulario' })).toHaveAttribute(
    'href', '/admin/games?form=ABC123',
  )
  expect(screen.getAllByText('First').length).toBeGreaterThan(0)

  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar participantes' }), {
    target: { value: 'bob@example.test' },
  })
  await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument())
  expect(screen.queryByText('Ana')).not.toBeInTheDocument()

  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por estado' }), {
    target: { value: 'completed' },
  })
  expect(await screen.findByText('No hay respuestas que coincidan con el filtro.')).toBeInTheDocument()
})

it('loads archived games on request and presents readable load errors', async () => {
  vi.mocked(listOperatorGames).mockResolvedValueOnce(games).mockRejectedValueOnce(new Error('offline'))
  mount()
  await screen.findByText('Quiz event')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir partidas archivadas' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las partidas.')
  expect(listOperatorGames).toHaveBeenNthCalledWith(2, true)
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

it('paginates the fully loaded participant list', async () => {
  vi.mocked(getFormResponses).mockResolvedValue({
    ...responses,
    players: Array.from({ length: 26 }, (_, index) => ({
      playerId: index + 1, name: `Player ${index + 1}`, email: `${index + 1}@example.test`,
      completed: false, completedAt: null, answers: {},
    })),
  })
  mount()
  expect(await screen.findByText('Player 1')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(await screen.findByText('Player 26')).toBeInTheDocument()
  expect(screen.queryByText('Player 1')).not.toBeInTheDocument()
})

it('exports escaped CSV cells and neutralizes spreadsheet formulas', () => {
  const csv = buildResponsesCsv([{
    playerId: 1, name: '=2+2', email: 'safe@example.test', completed: true,
    completedAt: null, answers: { q1: '+SUM(A1:A2)' },
  }], responses.questions)
  expect(csv).toContain('"\'=2+2"')
  expect(csv).toContain("\"'+SUM(A1:A2)\"")
})

it('shows and exports the protected registration profile with safe CSV cells', async () => {
  const player = { ...responses.players[0], phone: '+34612345678', address: 'Street 1',
    company: '=Company', jobTitle: 'Engineer', birthDate: '2000-01-02' }
  vi.mocked(getFormResponses).mockResolvedValue({ ...responses, players: [player] })
  mount()
  expect(await screen.findByText('Street 1')).toBeInTheDocument()
  expect(screen.getByText('Engineer')).toBeInTheDocument()
  expect(screen.getByText('2000-01-02')).toBeInTheDocument()
  const csv = buildResponsesCsv([player], [])
  expect(csv).toContain("\"'+34612345678\"")
  expect(csv).toContain('"Street 1"')
  expect(csv).toContain("\"'=Company\"")
  expect(csv).toContain('"Engineer","2000-01-02"')
})
