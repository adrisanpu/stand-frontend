import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import type { GameDefinition } from '../types'
import L3trasConfig from '../../games/l3tras/GameConfig'
import SettingsMenu from './SettingsMenu'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
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
  it('saves access and rules with one button, then applies and closes', async () => {
    const { onClose, onConfigSaved } = openConfig()
    await waitFor(() => expect(footer()).toBeEnabled())
    expect(screen.getAllByRole('button', { name: /guardar/i })).toHaveLength(1)
    fireEvent.change(screen.getByPlaceholderText('STAND'), { target: { value: 'pizza' } })
    expect(api.put).not.toHaveBeenCalled()
    fireEvent.click(footer())
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'ABC123', playMode: 'master', joinChannel: 'instagram' })
    expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'ABC123',
      settings: { l3tras: { objectiveWord: 'PIZZA', validationTimeLimitSeconds: 60 } },
    })
    expect(onConfigSaved).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('L3TRAS_settings_ABC123') ?? '{}')).toEqual({
      objectiveWord: 'PIZZA', validationTimeLimitSeconds: 60, playMode: 'master', joinChannel: 'instagram',
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
})
