import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { api } from '../../api/api'
import GameConfigurationDialog from './GameConfigurationDialog'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
const currentUser = vi.hoisted(() => ({ plan: 'event', user: { sub: 'owner' }, loading: false }))
vi.mock('../../auth/useCurrentUser', () => ({
  useCurrentUser: () => currentUser,
}))
vi.mock('../../api/userMedia', () => ({
  fetchUserMedia: async () => ({ logo: { selectedId: null } }),
  resolveUserSelectedLogoUrl: () => null,
}))

const game = { gameId: 'NEW', gameName: 'NEW_EVENT', gameType: 'T1MER', isActive: true, lifecycleState: 'active',
  setupReview: { version: 1, revision: 'setup-1', confirmedSections: [], completed: false } }
function Destination() {
  const location = useLocation()
  return <p>{location.pathname + location.search}</p>
}
function mount() {
  const onClose = vi.fn()
  render(<MemoryRouter initialEntries={['/admin/games?create=1']}>
    <Routes>
      <Route path="/admin/games" element={<GameConfigurationDialog gameType="T1MER" onClose={onClose} />} />
      <Route path="/home" element={<Destination />} />
    </Routes>
  </MemoryRouter>)
  return onClose
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(api.post).mockResolvedValue({ game })
  vi.mocked(api.get).mockResolvedValue({ ok: true, game, configuration: {}, rewardConditionsRevision: 'revision' })
})
afterEach(() => { cleanup(); localStorage.clear() })

it('prepends creation to the same configuration modal and keeps its normal tabs', async () => {
  localStorage.setItem('gameId', 'OLD')
  mount()
  const dialog = screen.getByRole('dialog')
  expect(screen.getByRole('img', { name: 'T1MER' })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Nombre de la partida'), { target: { value: 'new_event' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
  expect(await screen.findByText('Este juego no tiene ajustes de mecánica editables.')).toBeInTheDocument()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(screen.queryByText('/home?gameId=NEW')).not.toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(screen.getByRole('tab', { name: 'Premios' }))
  expect(screen.getByRole('tabpanel', { name: 'Premios' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: 'Sorteo' }))
  expect(screen.getByRole('tabpanel', { name: 'Sorteo' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Finalizar configuración' })).toBeDisabled()
  expect(api.post).toHaveBeenCalledTimes(1)
  expect(api.post).toHaveBeenCalledWith('/v1/game', expect.objectContaining({ gameName: 'NEW_EVENT', gameType: 'T1MER' }))
  expect(api.get).toHaveBeenCalledWith('/v1/game?gameId=NEW&configuration=true')
  expect(localStorage.getItem('gameId')).toBe('OLD')
})

it('blocks duplicate creation and closing while the create request is pending', async () => {
  let finish!: (value: unknown) => void
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const onClose = mount()
  const name = screen.getByLabelText('Nombre de la partida')
  fireEvent.change(name, { target: { value: 'new_event' } })
  fireEvent.keyDown(name, { key: 'Enter' })
  fireEvent.keyDown(name, { key: 'Enter' })
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Cerrar configuración' })).toBeDisabled()
  expect(onClose).not.toHaveBeenCalled()
  expect(api.post).toHaveBeenCalledTimes(1)
  await act(async () => finish({ game }))
  await screen.findByText('Este juego no tiene ajustes de mecánica editables.')
})

it('keeps creation errors on the first step and allows retry', async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error('No se ha podido crear la partida. Prueba con otro nombre.'))
  mount()
  fireEvent.change(screen.getByLabelText('Nombre de la partida'), { target: { value: 'new_event' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido crear')
  expect(screen.getByLabelText('Nombre de la partida')).toHaveValue('NEW_EVENT')
  fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
  await screen.findByRole('tab', { name: 'Game' })
})

it('does not allow closing a newly created event before its setup progress has loaded', async () => {
  vi.mocked(api.get).mockImplementation(() => new Promise(() => {}))
  const onClose = mount()
  fireEvent.change(screen.getByLabelText('Nombre de la partida'), { target: { value: 'new_event' } })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Crear' })) })
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  const unload = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unload)
  expect(unload.defaultPrevented).toBe(true)
})

it('closing after creation is blocked until every panel has been reviewed', async () => {
  const trigger = document.createElement('button')
  document.body.appendChild(trigger)
  trigger.focus()
  const onClose = mount()
  fireEvent.change(screen.getByLabelText('Nombre de la partida'), { target: { value: 'new_event' } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
  await screen.findByText('Este juego no tiene ajustes de mecánica editables.')
  expect(document.body.style.overflow).toBe('hidden')
  expect(trigger).toHaveAttribute('inert')
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar configuración' }))
  await waitFor(() => expect(onClose).not.toHaveBeenCalled())
  expect(screen.getByText('Revisa y confirma todos los paneles para finalizar la creación.')).toBeInTheDocument()
  expect(api.delete).not.toHaveBeenCalled()
  expect(api.post).toHaveBeenCalledTimes(1)
  cleanup()
  expect(document.body.style.overflow).toBe('')
  expect(trigger).not.toHaveAttribute('inert')
  expect(trigger).toHaveFocus()
  trigger.remove()
})
