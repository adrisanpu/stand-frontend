import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import StackGameConfig from './GameConfig'
import { DEFAULT_STACK_CONFIG } from './stackLogic'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('./BlockPreview', () => ({ default: ({ skin }: { skin: string }) => <div data-testid="block-preview">{skin}</div> }))

describe('STACK operator configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ game: { type: { STACK: DEFAULT_STACK_CONFIG } } })
    vi.mocked(api.put).mockResolvedValue({ ok: true })
  })
  afterEach(cleanup)

  it('loads authoritative rules and saves through the existing game endpoint', async () => {
    const onChange = vi.fn()
    render(<StackGameConfig gameId="GAME1234" gameName="PIZZA" settings={{}} onChange={onChange} />)
    const save = screen.getByRole('button', { name: 'Guardar configuración' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Velocidad inicial'), { target: { value: '2.5' } })
    fireEvent.change(screen.getByLabelText('Aspecto de las piezas'), { target: { value: 'baklava' } })
    expect(screen.getByTestId('block-preview')).toHaveTextContent('baklava')
    expect(screen.getByText('Ajustes avanzados').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(save)
    await screen.findByText('Configuración guardada. Se aplicará a los nuevos intentos.')
    expect(api.put).toHaveBeenCalledWith('/v1/game', {
      gameId: 'GAME1234',
      settings: { stack: { initialSpeed: 2.5, speedIncrement: 0.08, maxSpeed: 5, perfectTolerance: 0.06, skin: 'baklava' } },
    })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not silently use defaults after a load failure', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Sin conexión'))
    render(<StackGameConfig gameId="GAME1234" gameName="PIZZA" settings={{}} onChange={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('keeps failed saves visible and does not report local success', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('No se pudo guardar'))
    const onChange = vi.fn()
    render(<StackGameConfig gameId="GAME1234" gameName="PIZZA" settings={{}} onChange={onChange} />)
    const save = screen.getByRole('button', { name: 'Guardar configuración' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
    expect(onChange).not.toHaveBeenCalled()
  })
})
