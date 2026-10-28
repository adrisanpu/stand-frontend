import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stackPrizeApi, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import StackCloseSettings from './StackCloseSettings'

vi.mock('../../api/stackPrizes', () => ({ stackPrizeApi: { get: vi.fn(), close: vi.fn() } }))
const data: StackPrizeSettingsResponse = {
  ok: true, enabled: true, state: 'open', pendingPlayers: [], awards: [], inventory: [], allocations: [],
  program: { version: 3, catalog: [], rules: [], storefrontUrl: '' },
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(stackPrizeApi.get).mockResolvedValue(data)
  vi.mocked(stackPrizeApi.close).mockResolvedValue({ ...data, state: 'closing' })
})
afterEach(cleanup)
const mount = () => render(<StackCloseSettings gameId="GAME" onBack={vi.fn()} onClose={vi.fn()} onSavingChange={vi.fn()} />)
it('requires confirmation before definitive closure and preserves pending attempts', async () => {
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Cerrar juego' }))
  expect(stackPrizeApi.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
  await waitFor(() => expect(stackPrizeApi.close).toHaveBeenCalledWith('GAME', []))
  expect(await screen.findByText(/Cerrando: las partidas en curso/)).toBeInTheDocument()
})
it('requires a separate confirmation to exclude pending attempts', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...data, state: 'closing', pendingPlayers: [{ playerId: 3, name: 'Pending' }] })
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Excluir los intentos pendientes' }))
  expect(stackPrizeApi.close).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('Sus resultados tardíos serán rechazados.')
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusión y cierre' }))
  await waitFor(() => expect(stackPrizeApi.close).toHaveBeenCalledWith('GAME', [3]))
})
it('reports uncertainty and lets the operator refresh before retrying', async () => {
  vi.mocked(stackPrizeApi.close).mockRejectedValue(new Error('Offline'))
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Cerrar juego' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cierre' }))
  expect(await screen.findByText(/No se pudo confirmar el cierre/)).toBeInTheDocument()
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...data, state: 'closed' })
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }))
  expect(await screen.findByText(/Juego cerrado/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cerrar juego' })).not.toBeInTheDocument()
})
