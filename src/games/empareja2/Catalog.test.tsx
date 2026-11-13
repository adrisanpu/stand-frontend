import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Catalog from './Catalog'

vi.mock('../../api/api', () => ({ api: { get: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('EMPAREJA2 catalog', () => {
  it('displays the catalog in order and updates the difficulty selection', async () => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true, pairs: [
        { id: '1', characters: [{ id: 1, name: 'Uno', imageUrl: 'uno.png' }, { id: 2, name: 'Dos', imageUrl: 'dos.png' }] },
        { id: '2', characters: [{ id: 3, name: 'Tres', imageUrl: 'tres.png' }, { id: 4, name: 'Cuatro', imageUrl: 'cuatro.png' }] },
      ],
    })
    const { rerender } = render(<Catalog gameId="ABC123" selected={1} />)
    const entries = await screen.findAllByRole('listitem')
    expect(entries[0].parentElement).toHaveClass('sm:grid-cols-3')
    expect(entries[0]).toHaveClass('bg-primary/20')
    expect(entries[1]).not.toHaveClass('bg-primary/20')
    expect(entries[1]).toHaveClass('opacity-50')
    expect(within(entries[0]).getByText('Uno')).toBeInTheDocument()
    expect(within(entries[0]).getByText('Uno')).toHaveClass('hidden', 'group-hover:block', 'group-focus:block', 'text-textMain')
    expect(within(entries[0]).getByLabelText('Uno')).toHaveAttribute('tabindex', '0')
    expect(within(entries[0]).getByText('Dos')).toBeInTheDocument()
    expect(within(entries[0]).getByText('Disponible para repartir')).toBeInTheDocument()
    expect(within(entries[1]).getByText('Fuera del límite')).toBeInTheDocument()
    rerender(<Catalog gameId="ABC123" selected={2} />)
    expect(screen.getAllByText('Disponible para repartir')).toHaveLength(2)
    expect(entries[1]).toHaveClass('bg-primary/20')
    expect(entries[1]).not.toHaveClass('opacity-50')
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('reports a catalog loading error', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Unavailable'))
    render(<Catalog gameId="ABC123" selected={1} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el catálogo de parejas.')
  })
})
