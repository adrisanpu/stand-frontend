import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import { kivlyApi } from '../../api/kivlyApi'
import type { GameDefinition } from '../types'
import L3trasConfig from '../../games/l3tras/GameConfig'
import SettingsMenu from './SettingsMenu'
import { OperatorLanguageProvider } from './operatorLanguage'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({
  kivlyApi: { getAccountConnection: async () => ({
    connected: false, locationId: null, locations: [],
  }) },
}))
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn() }) }))
vi.mock('../../auth/useCurrentUser', () => ({ useCurrentUser: () => ({ user: null, loading: false, plan: 'event' }) }))
vi.mock('../widgets/Raffle', () => ({ default: () => null }))
vi.mock('../widgets/Quiz', () => ({ default: () => null }))
vi.mock('../settings/AppearanceSettings', () => ({ default: () => null }))
vi.mock('../settings/OperatorPrizeSettings', () => ({ default: () => null }))

const colors = { primary: '#000', accent: '#000', background: '#000', surface: '#000', textMain: '#fff', textSub: '#fff' }
const l3tras: GameDefinition = { id: 'L3TRAS', name: 'L3TRAS', colors, GameScreen: () => null, GameConfigComponent: L3trasConfig }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  localStorage.setItem('L3TRAS_settings_ABC123', JSON.stringify({ objectiveWord: 'STAND' }))
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: { playMode: 'master', joinChannel: 'instagram' } })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
  vi.mocked(api.delete).mockResolvedValue({ ok: true })
})
afterEach(cleanup)

function openConfig() {
  const onClose = vi.fn()
  const onConfigSaved = vi.fn()
  render(<SettingsMenu onClose={onClose} gameId="ABC123" gameType="L3TRAS" gameDefinition={l3tras} onConfigSaved={onConfigSaved} />)
  fireEvent.click(screen.getByText('Configurar juego'))
  return { onClose, onConfigSaved }
}

const footer = () => screen.getByRole('button', { name: 'Guardar y aplicar cambios' })

describe('SettingsMenu Configurar juego', () => {
  it('shows the connected Kivly logo on the game configuration menu entry', async () => {
    const account = vi.spyOn(kivlyApi, 'getAccountConnection').mockResolvedValueOnce({
      connected: true,
      locationId: 'location', locations: [{ id: 'location', name: 'Club' }],
    })
    render(<SettingsMenu onClose={vi.fn()} gameId="ABC123" gameType="STACK" gameDefinition={{ ...l3tras, id: 'STACK' }} />)
    expect(await screen.findByRole('img', { name: 'Kivly conectado' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Integraciones' })).not.toBeInTheDocument()
    account.mockRestore()
  })

  it('does not load or show Kivly integration for other games', async () => {
    const account = vi.spyOn(kivlyApi, 'getAccountConnection')
    render(<SettingsMenu onClose={vi.fn()} gameId="ABC123" gameType="L3TRAS" gameDefinition={l3tras} />)
    expect(account).not.toHaveBeenCalled()
    expect(screen.queryByRole('img', { name: 'Kivly conectado' })).not.toBeInTheDocument()
    account.mockRestore()
  })

  it('shows Integraciones from the home settings menu', () => {
    render(<SettingsMenu onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Integraciones' })).toBeInTheDocument()
  })

  it('preserves menu icon colors while theming action buttons inside submenus', async () => {
    render(<SettingsMenu onClose={vi.fn()} gameId="ABC123" gameType="L3TRAS" gameDefinition={l3tras} />)
    const quiz = screen.getByRole('button', { name: /Quiz/ })
    expect(quiz.querySelector('svg')).toHaveClass('text-green-400')
    const raffle = screen.getByRole('button', { name: /Sorteo/ })
    expect(raffle.querySelector('svg')).toHaveClass('text-purple-400')
    fireEvent.click(screen.getByText('Configurar juego'))
    await waitFor(() => expect(footer()).toBeEnabled())
    expect(footer()).toHaveClass('bg-primary/20', 'border-primary/30', 'hover:bg-primary/30')
  })

  it('keeps unsaved rules when changing language beside the close button', async () => {
    render(
      <OperatorLanguageProvider>
        <SettingsMenu onClose={vi.fn()} gameId="ABC123" gameType="L3TRAS" gameDefinition={l3tras} />
      </OperatorLanguageProvider>
    )
    fireEvent.click(screen.getByText('Configurar juego'))
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.change(screen.getByPlaceholderText('STAND'), { target: { value: 'PIZZA' } })
    const requests = vi.mocked(api.get).mock.calls.length
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    expect(screen.getByPlaceholderText('STAND')).toHaveValue('PIZZA')
    expect(screen.getByRole('button', { name: 'Save and apply changes' })).toBeEnabled()
    expect(api.put).not.toHaveBeenCalled()
    expect(api.get).toHaveBeenCalledTimes(requests)
    expect(JSON.parse(localStorage.getItem('L3TRAS_settings_ABC123') ?? '{}')).toEqual({ objectiveWord: 'STAND' })
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'es' } })
    expect(screen.getByPlaceholderText('STAND')).toHaveValue('PIZZA')
    expect(footer()).toBeEnabled()
  })

  it('saves access and rules with one button, then applies and closes', async () => {
    const { onClose, onConfigSaved } = openConfig()
    await waitFor(() => expect(footer()).toBeEnabled())
    expect(screen.getAllByRole('button', { name: /guardar/i })).toHaveLength(1)
    fireEvent.change(screen.getByPlaceholderText('STAND'), { target: { value: 'pizza' } })
    expect(api.put).not.toHaveBeenCalled()
    fireEvent.click(footer())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'ABC123', playMode: 'mobile', joinChannel: 'web',
      participantFields: { email: { required: true }, phone: { required: false, enabled: false } },
    })
    expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'ABC123',
      settings: { l3tras: { objectiveWord: 'PIZZA', validationTimeLimitSeconds: 60 } },
    })
    expect(onConfigSaved).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('L3TRAS_settings_ABC123') ?? '{}')).toEqual({
      objectiveWord: 'PIZZA', validationTimeLimitSeconds: 60, playMode: 'mobile', joinChannel: 'web',
      participantFields: { email: { required: true }, phone: { required: false, enabled: false } },
    })
  })

  it('stays open without applying when the rules save fails', async () => {
    vi.mocked(api.put).mockResolvedValueOnce({ ok: true }).mockRejectedValueOnce(new Error('Servidor caído'))
    const { onClose, onConfigSaved } = openConfig()
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(footer())
    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor caído')
    expect(onClose).not.toHaveBeenCalled()
    expect(onConfigSaved).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Configurar juego' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('L3TRAS_settings_ABC123') ?? '{}')).toEqual({ objectiveWord: 'STAND' })
  })

  it('cannot be closed while saving', async () => {
    vi.mocked(api.put).mockImplementation(() => new Promise(() => {}))
    openConfig()
    await waitFor(() => expect(footer()).toBeEnabled())
    fireEvent.click(footer())
    await screen.findByRole('button', { name: 'Guardando...' })
    expect(screen.getByRole('button', { name: 'Cerrar y volver al juego' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar y volver al juego' }))
    expect(screen.getByRole('dialog', { name: 'Configurar juego' })).toBeInTheDocument()
  })

  it('lists players and removes one only after confirmation', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      ok: true,
      players: [
        { playerId: 1, username: 'Ana' },
        { playerId: 2, username: 'Luis' },
      ],
    })
    render(<SettingsMenu onClose={vi.fn()} gameId="ABC123" gameType="L3TRAS" gameDefinition={l3tras} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gestionar jugadores' }))
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Luis')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/v1/game/players?gameId=ABC123')

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar a Ana' }))
    expect(api.delete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/v1/game/players', {
      gameId: 'ABC123', playerId: 1,
    }))
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument())
    expect(screen.getByText('Luis')).toBeInTheDocument()
  })

  it('keeps the player visible and reports a failed removal', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ ok: true, players: [{ playerId: 1, username: 'Ana' }] })
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('Servidor caído'))
    render(<SettingsMenu onClose={vi.fn()} gameId="ABC123" gameType="L3TRAS" gameDefinition={l3tras} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gestionar jugadores' }))
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar a Ana' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor caído')
    expect(screen.getByText('Ana')).toBeInTheDocument()
  })

  it('offers a retry after a roster load error and shows the empty state', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Servidor caído'))
      .mockResolvedValueOnce({ ok: true, players: [] })
    render(<SettingsMenu onClose={vi.fn()} gameId="ABC123" gameType="L3TRAS" gameDefinition={l3tras} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gestionar jugadores' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Servidor caído')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Todavía no hay jugadores en esta partida.')).toBeInTheDocument()
  })
})
