import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stackPrizeApi, type StackPrizeSettingsResponse } from '../../api/stackPrizes'
import StackCloseSettings from './StackCloseSettings'

vi.mock('../../api/stackPrizes', () => ({ stackPrizeApi: { get: vi.fn(), close: vi.fn() } }))
const data: StackPrizeSettingsResponse = {
  globalInventory: null,
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
it('requires confirmation before deactivation and preserves pending attempts', async () => {
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Desactivar partida' }))
  expect(stackPrizeApi.close).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar desactivación' }))
  await waitFor(() => expect(stackPrizeApi.close).toHaveBeenCalledWith('GAME'))
  expect(await screen.findByText(/Cerrando: las partidas en curso/)).toBeInTheDocument()
})
it('waits for pending attempts instead of offering exclusion', async () => {
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...data, state: 'closing', pendingPlayers: [{ playerId: 3, name: 'Pending' }] })
  mount()
  expect(await screen.findByText('Pending')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Excluir los intentos pendientes' })).not.toBeInTheDocument()
  expect(stackPrizeApi.close).not.toHaveBeenCalled()
})
it('reports uncertainty and lets the operator refresh before retrying', async () => {
  vi.mocked(stackPrizeApi.close).mockRejectedValue(new Error('Offline'))
  mount()
  fireEvent.click(await screen.findByRole('button', { name: 'Desactivar partida' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar desactivación' }))
  expect(await screen.findByText(/No se pudo confirmar el cierre/)).toBeInTheDocument()
  vi.mocked(stackPrizeApi.get).mockResolvedValue({ ...data, state: 'closed' })
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar estado' }))
  expect(await screen.findByText(/Partida desactivada/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Desactivar partida' })).not.toBeInTheDocument()
})
