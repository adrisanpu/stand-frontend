import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { api } from '../../api/api'
import { kivlyApi } from '../../api/kivlyApi'
import AdminShell from './AdminShell'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'user-1', name: 'Ana', email: 'ana@example.com', plan: 'free', profilePicUrl: 'https://example.com/photo.jpg' },
    loading: false, error: null, updateProfile: vi.fn(),
  }),
}))
vi.mock('../../api/kivlyApi', () => ({
  kivlyApi: { getAccountConnection: vi.fn() },
}))
vi.mock('../shell/GameGate', () => ({
  default: ({ onGameCreated }: { onGameCreated: (name: string, id: string, type: string) => void }) =>
    <button onClick={() => onGameCreated('NEW_EVENT', 'NEW', 'STACK')}>Crear partida de prueba</button>,
}))

const game = { gameId: 'NEW', gameName: 'NEW_EVENT', gameType: 'STACK', createdAt: '2026-11-04T08:00:00Z', playerCount: 17, isActive: true }
function Destination() {
  const location = useLocation()
  return <p>{location.pathname + location.search}</p>
}
function mount(path = '/admin/games') {
  return render(<MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/*" element={<AdminShell />} />
      <Route path="/home" element={<Destination />} />
      <Route path="/logout" element={<p>Logged out</p>} />
    </Routes>
  </MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [game] })
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({ connected: false, locations: [], locationId: null })
})
afterEach(cleanup)

it('opens account settings from the sidebar identity block', async () => {
  mount()
  await screen.findByText('NEW_EVENT')
  expect(screen.getByText('Ana')).toBeInTheDocument()
  expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  for (const name of ['Configurar cuenta', 'Cerrar sesión']) {
    const action = screen.getByRole('link', { name })
    expect(action).toHaveAttribute('title', name)
    expect(action.textContent).toBe('')
    expect(action.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  }
  expect(document.querySelector('img[src="https://example.com/photo.jpg"]')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Configurar cuenta' }))
  expect(screen.getByRole('link', { name: 'Configurar cuenta' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Ana')
  expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAttribute('readonly')
})

it('signs out from the avatar actions', async () => {
  mount()
  await screen.findByText('NEW_EVENT')
  fireEvent.click(screen.getByRole('link', { name: 'Cerrar sesión' }))
  expect(screen.getByText('Logged out')).toBeInTheDocument()
})

it('opens the selected event independently of a stale browser selection', async () => {
  localStorage.setItem('gameId', 'OLD')
  mount()
  fireEvent.click(await screen.findByRole('link', { name: 'Entrar en la partida NEW_EVENT' }))
  expect(screen.getByText('/home?gameId=NEW')).toBeInTheDocument()
  expect(localStorage.getItem('gameId')).toBe('OLD')
})

it('shows a real empty state and catalog access', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [] })
  mount()
  expect(await screen.findByText('Todavía no tienes partidas')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Crear partida' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Crear partida de prueba' }))
  expect(screen.getByText('/home?gameId=NEW')).toBeInTheDocument()
})

it('does not present a failed lookup as an empty list and supports retry', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ ok: true, games: [game] })
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar')
  expect(screen.queryByText('Todavía no tienes partidas')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('NEW_EVENT')).toBeInTheDocument()
})

it('retains the list while changing language and exposes only functional sections', async () => {
  mount()
  await screen.findByText('NEW_EVENT')
  fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
  expect(screen.getByRole('searchbox', { name: 'Search events' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open event NEW_EVENT' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Prizes' })).toBeInTheDocument()
  expect(api.get).toHaveBeenCalledTimes(1)
})

it('offers a collapsible mobile navigation with state and active location', async () => {
  mount()
  await screen.findByText('NEW_EVENT')
  const menu = screen.getByRole('button', { name: 'Menú' })
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(menu)
  expect(menu).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('link', { name: 'Juegos' })).toHaveAttribute('aria-current', 'page')
  fireEvent.click(screen.getByRole('link', { name: 'Configurar cuenta' }))
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Ana')
  fireEvent.click(menu)
  fireEvent.click(screen.getByRole('link', { name: 'Integraciones' }))
  expect(menu).toHaveAttribute('aria-expanded', 'false')
  await waitFor(() => expect(kivlyApi.getAccountConnection).toHaveBeenCalledOnce())
  expect(screen.getByRole('region', { name: 'Conexiones disponibles' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cerrar configuración' })).not.toBeInTheDocument()
})

it('redirects unknown admin locations to the event list', async () => {
  mount('/admin/not-a-page')
  expect(await screen.findByRole('link', { name: 'Entrar en la partida NEW_EVENT' })).toBeInTheDocument()
})

it('shows the game logo, event identity, creation date and real player count', async () => {
  mount()
  const card = (await screen.findByText('NEW_EVENT')).closest('tr')!
  const showcase = document.getElementById('showcase-STACK')!
  expect(showcase).toHaveAttribute('aria-selected', 'true')
  expect(showcase).toHaveAccessibleName(/\(1\)$/)
  expect(showcase.querySelector('img')).toHaveAttribute('src')
  expect(within(card).queryByText('STACK')).not.toBeInTheDocument()
  expect(within(card).getByText('Activa')).toBeInTheDocument()
  expect(within(card).getByText('4 nov 2026')).toHaveAttribute('dateTime', game.createdAt)
  expect(within(card).getByText('17')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Catálogo' })).not.toBeInTheDocument()
})

it('uses icon-only actions with accessible names and hover titles', async () => {
  mount()
  await screen.findByText('NEW_EVENT')
  for (const name of ['Crear partida', 'Desactivar', 'Archivar']) {
    const button = screen.getByRole('button', { name })
    expect(button).toHaveAttribute('title', name)
    expect(button).toHaveTextContent('')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(button.textContent).toBe('')
  }
  const open = screen.getByRole('link', { name: 'Entrar en la partida NEW_EVENT' })
  expect(open).toHaveAttribute('title', 'Entrar')
  expect(open.textContent).toBe('')
  expect(open.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  const configure = screen.getByRole('button', { name: 'Configurar partida NEW_EVENT' })
  expect(configure).toHaveAttribute('title', 'Configurar partida')
  expect(configure.textContent).toBe('')
  expect(configure.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
})

it('opens configuration over the existing filtered list, without navigating to the home', async () => {
  vi.mocked(api.get).mockImplementation(async url => {
    if (url.includes('configuration=true')) return {
      ok: true, game: { ...game, gameType: 'T1MER', lifecycleState: 'active' },
      configuration: {}, rewardConditionsRevision: 'revision',
    }
    return { ok: true, games: [{ ...game, gameType: 'T1MER' }] }
  })
  mount()
  await screen.findByText('NEW_EVENT')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'NEW' } })
  const configure = screen.getByRole('button', { name: 'Configurar partida NEW_EVENT' })
  configure.focus()
  fireEvent.click(configure)
  expect(await screen.findByRole('dialog')).toHaveAccessibleName('NEW_EVENT')
  expect(screen.getByRole('searchbox')).toHaveValue('NEW')
  expect(screen.queryByText('/home?gameId=NEW')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  await screen.findByText('NEW_EVENT')
  expect(screen.getByRole('searchbox')).toHaveValue('NEW')
})

it('switches the event table when another game reaches the centre of the showcase', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true, games: [game, { gameId: 'OTHER', gameName: 'Otra', gameType: 'T1MER', playerCount: 8, createdAt: '2025-01-01T10:00:00Z' }],
  })
  mount()
  await screen.findByText('Otra')
  expect(screen.queryByText('NEW_EVENT')).not.toBeInTheDocument()
  const listbox = screen.getByRole('listbox', { name: 'Juegos' })
  const stack = screen.getAllByRole('option').find(option => option.id === 'showcase-STACK')!
  fireEvent.click(stack)
  expect(await screen.findByText('NEW_EVENT')).toBeInTheDocument()
  expect(screen.queryByText('Otra')).not.toBeInTheDocument()
  expect(stack).toHaveAttribute('aria-selected', 'true')
  expect(listbox).toHaveAttribute('aria-activedescendant', 'showcase-STACK')
  fireEvent.keyDown(listbox, { key: 'ArrowRight' })
  expect(listbox).toHaveAttribute('aria-activedescendant', 'showcase-EMPAREJA2')
  expect(screen.getByText('Este juego no tiene partidas.')).toBeInTheDocument()
})

it.each(['new_event', '2026-11-04', '4 nov', '17', 'new 17'])('filters the displayed fields using %s', async query => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true, games: [game, { gameId: 'OTHER', gameName: 'Otra', gameType: 'STACK', playerCount: 8, createdAt: '2025-01-01T10:00:00Z' }],
  })
  mount()
  await screen.findByText('Otra')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } })
  expect(screen.getByText('NEW_EVENT')).toBeInTheDocument()
  expect(screen.queryByText('Otra')).not.toBeInTheDocument()
  expect(api.get).toHaveBeenCalledOnce()
})

it('distinguishes no matches from no events and restores results on clearing', async () => {
  mount()
  await screen.findByText('NEW_EVENT')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'absent' } })
  expect(screen.getByRole('status')).toHaveTextContent('No hay partidas que coincidan')
  expect(screen.queryByText('Todavía no tienes partidas')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
  expect(screen.getByText('NEW_EVENT')).toBeInTheDocument()
})

it('opens the catalog over the list and closes with Escape, restoring focus and search', async () => {
  mount()
  await screen.findByText('NEW_EVENT')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'stack' } })
  const trigger = screen.getByRole('button', { name: 'Crear partida' })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog')
  expect(screen.getByText('NEW_EVENT')).toBeInTheDocument()
  expect(window.document.body.style.overflow).toBe('hidden')
  fireEvent.keyDown(dialog, { key: 'Tab' })
  expect(within(dialog).getByRole('button', { name: 'Cerrar catálogo' })).toHaveFocus()
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(screen.getByRole('searchbox')).toHaveValue('stack')
  expect(document.body.style.overflow).not.toBe('hidden')
})

it('redirects the old catalog URL to the overlay on the event list', async () => {
  mount('/admin/games/catalog')
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(await screen.findByText('NEW_EVENT')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar catálogo' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('does not replace missing legacy metadata with invented dates or zero players', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [{ gameId: 'OLD', gameName: 'Legacy', gameType: 'STACK' }] })
  mount()
  const card = (await screen.findByText('Legacy')).closest('tr')!
  expect(within(card).getAllByText('No disponible')).toHaveLength(3)
})

it('confirms deactivation, then reactivates without resetting the event', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [{ ...game, gameType: 'T1MER' }] })
  vi.mocked(api.put).mockResolvedValueOnce({ game: { gameId: 'NEW', isActive: false, lifecycleState: 'inactive' } })
    .mockResolvedValueOnce({ game: { gameId: 'NEW', isActive: true, lifecycleState: 'active' } })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }))
  expect(api.put).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar desactivación' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Activar' }))
  await screen.findByRole('button', { name: 'Desactivar' })
  expect(api.put).toHaveBeenNthCalledWith(1, '/v1/game', { gameId: 'NEW', isActive: false })
  expect(api.put).toHaveBeenNthCalledWith(2, '/v1/game', { gameId: 'NEW', isActive: true })
})

it('requires confirmation to archive, supports cancel and removes only the confirmed event', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [{ ...game, isActive: false, lifecycleState: 'inactive' }] })
  vi.mocked(api.delete).mockResolvedValue({ gameId: 'NEW', message: 'Game archived successfully' })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Archivar' }))
  expect(api.delete).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('button', { name: 'Confirmar archivo' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Archivar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }))
  await screen.findByText('Todavía no tienes partidas')
  expect(api.delete).toHaveBeenCalledWith('/v1/game', { gameId: 'NEW' })
})

it('keeps the card on failed archival and requires a reload before retry', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [{ ...game, isActive: false, lifecycleState: 'inactive' }] })
  vi.mocked(api.delete).mockRejectedValue(new Error('Unavailable'))
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Archivar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo confirmar')
  expect(screen.getByText('NEW_EVENT')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirmar archivo' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Recargar partidas' }))
  expect(await screen.findByRole('button', { name: 'Archivar' })).toBeEnabled()
})

it('allows archiving a closing STACK game to stop it immediately', async () => {
  vi.mocked(api.put).mockResolvedValue({ game: { gameId: 'NEW', isActive: false, lifecycleState: 'closing' } })
  vi.mocked(api.delete).mockResolvedValue({ gameId: 'NEW', message: 'Game archived successfully' })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar desactivación' }))
  expect(await screen.findByRole('button', { name: 'Desactivando…' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Archivar' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Detiene el cierre y los trabajos pendientes.')
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }))
  await screen.findByText('Todavía no tienes partidas')
  expect(api.delete).toHaveBeenCalledWith('/v1/game', { gameId: 'NEW' })
})

it('updates closing events in the background without unmounting their cards', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true, games: [{ ...game, isActive: false, lifecycleState: 'closing' }],
  })
  vi.useFakeTimers()
  try {
    await act(async () => { mount() })
    const card = screen.getByText('NEW_EVENT').closest('tr')
    let resolveRefresh!: (value: { ok: boolean; games: Array<typeof game & { lifecycleState: string }> }) => void
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveRefresh = resolve }))
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(screen.queryByText('Cargando partidas…')).not.toBeInTheDocument()
    expect(screen.getByText('NEW_EVENT').closest('tr')).toBe(card)
    await act(async () => {
      resolveRefresh({ ok: true, games: [{ ...game, isActive: false, lifecycleState: 'inactive' }] })
    })
    expect(screen.getByRole('button', { name: 'Activar' })).toBeEnabled()
    expect(screen.getByText('NEW_EVENT').closest('tr')).toBe(card)
  } finally {
    vi.useRealTimers()
  }
})

it('keeps closing event cards visible and reports background refresh failures', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true, games: [{ ...game, isActive: false, lifecycleState: 'closing' }],
  })
  vi.useFakeTimers()
  try {
    await act(async () => { mount() })
    const card = screen.getByText('NEW_EVENT').closest('tr')
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline'))
    await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo actualizar el estado')
    expect(screen.getByText('NEW_EVENT').closest('tr')).toBe(card)
    expect(screen.getByRole('button', { name: 'Recargar partidas' })).toBeEnabled()
  } finally {
    vi.useRealTimers()
  }
})

const archivedGame = { ...game, isActive: false, lifecycleState: 'inactive', archivedAt: '2026-01-01T00:00:00Z' }

it('switches lists using an accessible archive icon and retains search', async () => {
  vi.mocked(api.get).mockImplementation(async path => ({
    ok: true, games: path.includes('archived=true') ? [archivedGame] : [game],
  }))
  mount()
  await screen.findByText('NEW_EVENT')
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'new' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ver partidas archivadas' }))
  expect(await screen.findByRole('button', { name: 'Desarchivar' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Volver a partidas' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Entrar en/ })).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox')).toHaveValue('new')
  fireEvent.click(screen.getByRole('button', { name: 'Volver a partidas' }))
  expect(await screen.findByRole('button', { name: 'Desactivar' })).toBeEnabled()
  expect(api.get).toHaveBeenNthCalledWith(2, '/v1/game?archived=true')
})

it('restores an archived card without activating it', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [archivedGame] })
  vi.mocked(api.put).mockResolvedValue({
    message: 'Game unarchived successfully', game: { ...game, isActive: false, lifecycleState: 'inactive' },
  })
  mount('/admin/games?archived=1')
  fireEvent.click(await screen.findByRole('button', { name: 'Desarchivar' }))
  expect(await screen.findByText('No tienes partidas archivadas')).toBeInTheDocument()
  expect(api.put).toHaveBeenCalledOnce()
  expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'NEW', archived: false })
})

it('requires the exact event name and explains permanent deletion effects', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [archivedGame] })
  vi.mocked(api.delete).mockResolvedValue({ gameId: 'NEW', message: 'Game permanently deleted successfully' })
  mount('/admin/games?archived=1')
  fireEvent.click(await screen.findByRole('button', { name: 'Borrar definitivamente' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Se borrarán sus datos locales. Kivly no se modifica; las entregas externas podrían completarse.')
  const card = screen.getByRole('rowheader', { name: 'NEW_EVENT' }).closest('tr')
  expect(card).not.toBeNull()
  expect(within(card as HTMLElement).queryByRole('dialog')).not.toBeInTheDocument()
  const confirm = screen.getByRole('button', { name: 'Confirmar borrado definitivo' })
  expect(confirm).toBeDisabled()
  const name = screen.getByRole('textbox', { name: 'Escribe NEW_EVENT para confirmar' })
  fireEvent.change(name, { target: { value: 'NEW' } })
  expect(confirm).toBeDisabled()
  expect(api.delete).not.toHaveBeenCalled()
  fireEvent.change(name, { target: { value: 'NEW_EVENT' } })
  fireEvent.click(confirm)
  expect(await screen.findByText('No tienes partidas archivadas')).toBeInTheDocument()
  expect(api.delete).toHaveBeenCalledWith('/v1/game', { gameId: 'NEW', permanent: true, confirmation: 'NEW_EVENT' })
})

it('explains a partially started deletion that can be retried', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, games: [archivedGame] })
  vi.mocked(api.delete).mockRejectedValue(Object.assign(new Error('Deletion in progress'), { code: 'GameDeletionInProgress' }))
  mount('/admin/games?archived=1')
  fireEvent.click(await screen.findByRole('button', { name: 'Borrar definitivamente' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'NEW_EVENT' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado definitivo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('El borrado está iniciado')
  expect(screen.getByRole('rowheader', { name: 'NEW_EVENT' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Confirmar borrado definitivo' })).toBeDisabled()
})

it.each([
  ['Pausar', 'Se detendrán las nuevas participaciones; las iniciadas finalizarán.'],
  ['Archivar', 'Detiene el cierre y los trabajos pendientes.'],
])('shows a compact %s confirmation outside the game card', async (action, message) => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true,
    games: action === 'Archivar' ? [{ ...game, isActive: false, lifecycleState: 'inactive' }] : [game],
  })
  mount()
  const actionButton = await screen.findByRole('button', {
    name: action === 'Pausar' ? 'Desactivar' : 'Archivar',
  })
  const card = screen.getByRole('rowheader', { name: 'NEW_EVENT' }).closest('tr')
  expect(card).not.toBeNull()
  fireEvent.click(actionButton)
  expect(screen.getByRole('dialog')).toHaveTextContent(message)
  expect(within(card as HTMLElement).queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
})

it('does not allow restoration of a partially deleted event', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ok: true, games: [{ ...archivedGame, deletionStartedAt: '2026-01-02T00:00:00Z' }],
  })
  mount('/admin/games?archived=1')
  expect(await screen.findByRole('button', { name: 'Desarchivar' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('Borrado iniciado')
  expect(screen.getByRole('button', { name: 'Borrar definitivamente' })).toBeEnabled()
})

it('never shows stale current cards or a late response in the archived view', async () => {
  let resolveCurrent: ((value: { ok: boolean; games: typeof game[] }) => void) | undefined
  vi.mocked(api.get).mockImplementation(path => path.includes('archived=true')
    ? Promise.resolve({ ok: true, games: [] })
    : new Promise(resolve => { resolveCurrent = resolve }))
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Ver partidas archivadas' }))
  await screen.findByText('No tienes partidas archivadas')
  resolveCurrent?.({ ok: true, games: [game] })
  await waitFor(() => expect(screen.queryByText('NEW_EVENT')).not.toBeInTheDocument())
})
