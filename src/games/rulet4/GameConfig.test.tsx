import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import GameConfig from './GameConfig'
import { DEFAULT_RULET4_CONFIG } from './rulet4Logic'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
const props = { gameId: 'ABC123', gameName: 'RULET4', settings: {}, onChange: vi.fn() }

describe('RULET4 persisted settings', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    vi.mocked(api.get).mockResolvedValue({ game: { type: { RULET4: DEFAULT_RULET4_CONFIG }, rulet4ConfigStored: true } })
    vi.mocked(api.put).mockResolvedValue({ ok: true })
  })
  afterEach(cleanup)

  it('loads server settings and waits for confirmed persistence before changing the shell', async () => {
    render(<GameConfig {...props} />)
    await screen.findByDisplayValue('Rojo')
    fireEvent.change(screen.getByDisplayValue('Rojo'), { target: { value: 'Premio nuevo' } })
    let resolve: ((value: { ok: boolean }) => void) | undefined
    vi.mocked(api.put).mockReturnValueOnce(new Promise((done) => { resolve = done }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    expect(props.onChange).not.toHaveBeenCalled()
    expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'ABC123', settings: { rulet4: {
      panels: [{ ...DEFAULT_RULET4_CONFIG.panels[0], label: 'Premio nuevo' }, ...DEFAULT_RULET4_CONFIG.panels.slice(1)],
    } } })
    resolve?.({ ok: true })
    await waitFor(() => expect(props.onChange).toHaveBeenCalledOnce())
  })

  it('offers migration only when the server has no persisted config', async () => {
    localStorage.setItem('RULET4_settings_ABC123', JSON.stringify({ panels: [{ id: 'old', label: 'Local prize', count: 1 }] }))
    vi.mocked(api.get).mockResolvedValueOnce({ game: { type: { RULET4: DEFAULT_RULET4_CONFIG }, rulet4ConfigStored: false } })
    render(<GameConfig {...props} />)
    await screen.findByDisplayValue('Local prize')
    expect(screen.getByRole('status')).toHaveTextContent('migrar')
    expect(api.put).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledOnce())
  })

  it('ignores a stale browser cache once settings exist on the server', async () => {
    localStorage.setItem('RULET4_settings_ABC123', 'invalid old cache')
    render(<GameConfig {...props} />)
    await screen.findByDisplayValue('Rojo')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('blocks saving after a load error and supports retry without silent defaults', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Load failed'))
    render(<GameConfig {...props} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Load failed')
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled())
  })

  it('reports persistence failure and does not claim local success', async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error('Save failed'))
    render(<GameConfig {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }))
    await screen.findByText('Save failed')
    expect(props.onChange).not.toHaveBeenCalled()
  })
})
