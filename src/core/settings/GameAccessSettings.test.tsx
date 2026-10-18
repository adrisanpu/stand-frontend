import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import GameAccessSettings from './GameAccessSettings'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: { playMode: 'master', joinChannel: 'instagram' } })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
})

function mount(type = 'T1MER') {
  const onLoaded = vi.fn()
  const onSaved = vi.fn()
  render(<GameAccessSettings gameId="ABC123" gameType={type} onLoaded={onLoaded} onSaved={onSaved} />)
  return { onLoaded, onSaved }
}

describe('fixed mobile and Web access presentation', () => {
  it('shows fixed informative values instead of selectors', async () => {
    mount()
    await waitFor(() => expect(screen.getByText('∞ móviles')).toBeInTheDocument())
    expect(screen.getByText('Web')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Modo de juego' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Acceso del participante' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1 pantalla' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Instagram' })).not.toBeInTheDocument()
  })

  it('normalizes and saves legacy master/Instagram API settings as mobile/Web', async () => {
    const { onLoaded, onSaved } = mount()
    await waitFor(() => expect(onLoaded).toHaveBeenCalledWith({ playMode: 'mobile', joinChannel: 'web' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar modo y acceso' }))
    await screen.findByText('Modo y acceso guardados.')
    expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'ABC123', playMode: 'mobile', joinChannel: 'web' })
    expect(onSaved).toHaveBeenCalledWith({ playMode: 'mobile', joinChannel: 'web' })
  })

  it('normalizes legacy values for every supported game', async () => {
    for (const type of ['L3TRAS', 'RULET4', 'CUPIDO', 'SEMAFORO', 'INFOCARDS', 'IMPOSTOR', 'STACK']) {
      vi.mocked(api.get).mockResolvedValueOnce({ ok: true, game: { playMode: 'old', joinChannel: 'old' } })
      mount(type)
      await waitFor(() => expect(screen.getByText('∞ móviles')).toBeInTheDocument())
      expect(screen.getByText('Web')).toBeInTheDocument()
      cleanup()
    }
  })

  it('blocks editing on load failure, exposes retry and does not persist defaults', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Sin conexión'))
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(api.put).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar modo y acceso' })).toBeEnabled())
  })

  it('does not report a failed save as success', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('Error al guardar'))
    const { onSaved } = mount()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar modo y acceso' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Guardar modo y acceso' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Error al guardar')
    expect(onSaved).not.toHaveBeenCalled()
    expect(screen.queryByText('Modo y acceso guardados.')).not.toBeInTheDocument()
  })
})
