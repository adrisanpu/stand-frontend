import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import GameAccessSettings from './GameAccessSettings'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: { playMode: 'master', joinChannel: 'web' } })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
})

function mount(type = 'T1MER') {
  const onLoaded = vi.fn()
  const onSaved = vi.fn()
  render(<GameAccessSettings gameId="ABC123" gameType={type} onLoaded={onLoaded} onSaved={onSaved} />)
  return { onLoaded, onSaved }
}

describe('mode and access selectors', () => {
  it('keeps both singly labelled selectors in one two-column row', async () => {
    mount()
    await waitFor(() => expect(screen.getByRole('button', { name: '1 pantalla' })).toBeEnabled())
    const mode = screen.getByRole('group', { name: 'Modo de juego' })
    const access = screen.getByRole('group', { name: 'Acceso del participante' })
    expect(mode.parentElement).toBe(access.parentElement)
    expect(mode.parentElement).toHaveClass('grid', 'grid-cols-2')
    expect(screen.getAllByText('Modo de juego')).toHaveLength(1)
    expect(screen.getAllByText('Acceso del participante')).toHaveLength(1)
    expect(mode.querySelector('div')).toHaveClass('grid-cols-1', 'sm:grid-cols-2')
    expect(access.querySelector('div')).toHaveClass('grid-cols-1', 'sm:grid-cols-2')
    expect(screen.queryByText(/El acceso determina|Estos ajustes se guardan/)).not.toBeInTheDocument()
  })

  it('loads independent saved selections and persists them together', async () => {
    const { onSaved } = mount()
    await waitFor(() => expect(screen.getByRole('button', { name: '1 pantalla' })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('button', { name: 'Web' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '∞ móviles' }))
    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar modo y acceso' }))
    await screen.findByText('Modo y acceso guardados.')
    expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'ABC123', playMode: 'mobile', joinChannel: 'instagram' })
    expect(onSaved).toHaveBeenCalledWith({ playMode: 'mobile', joinChannel: 'instagram' })
  })

  it.each(['L3TRAS', 'RULET4', 'CUPIDO', 'SEMAFORO', 'INFOCARDS', 'IMPOSTOR'])('shows unsupported options disabled for %s', async (type) => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, game: {} })
    mount(type)
    await waitFor(() => expect(screen.getByRole('button', { name: '1 pantalla' })).toBeEnabled())
    expect(screen.getByRole('button', { name: '∞ móviles' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Web' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Instagram' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps STACK mobile but allows either access channel', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, game: { joinChannel: 'instagram' } })
    mount('STACK')
    await waitFor(() => expect(screen.getByRole('button', { name: '∞ móviles' })).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByRole('button', { name: '1 pantalla' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Web' })).toBeEnabled()
  })

  it('blocks editing on load failure, exposes retry and does not persist defaults', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Sin conexión'))
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByRole('button', { name: '1 pantalla' })).toBeDisabled()
    expect(api.put).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '1 pantalla' })).toBeEnabled())
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
