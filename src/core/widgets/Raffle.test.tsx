import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Raffle from './Raffle'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }))
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: {} })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
})
afterEach(cleanup)

it.each([undefined, true, false])('loads saved visibility in the raffle section (%s)', async (enabled) => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: { showRaffleOnHome: enabled } })
  const onVisibilitySaved = vi.fn()
  render(<Raffle gameId="ABC123" onBack={vi.fn()} onClose={vi.fn()} onVisibilitySaved={onVisibilitySaved} />)
  const selector = screen.getByLabelText('Mostrar sorteo en el home')
  expect(selector).toBeDisabled()
  await waitFor(() => expect(selector).toBeEnabled())
  expect(selector).toHaveAttribute('role', 'switch')
  expect(selector).toHaveAttribute('aria-checked', String(enabled !== false))
  fireEvent.click(selector)
  await waitFor(() => expect(onVisibilitySaved).toHaveBeenCalledOnce())
  expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'ABC123', showRaffleOnHome: enabled === false })
  expect(selector).toHaveAttribute('aria-checked', String(enabled === false))
})

it('retains the saved value and reports save failures without refreshing the home', async () => {
  vi.mocked(api.put).mockRejectedValue(new Error('network'))
  const onVisibilitySaved = vi.fn()
  render(<Raffle gameId="ABC123" onBack={vi.fn()} onClose={vi.fn()} onVisibilitySaved={onVisibilitySaved} />)
  const selector = screen.getByLabelText('Mostrar sorteo en el home')
  await waitFor(() => expect(selector).toBeEnabled())
  fireEvent.click(selector)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar')
  expect(selector).toHaveAttribute('aria-checked', 'true')
  expect(onVisibilitySaved).not.toHaveBeenCalled()
})

it('blocks the selector on load failure and supports retry', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('network'))
  render(<Raffle gameId="ABC123" onBack={vi.fn()} onClose={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar')
  expect(screen.getByLabelText('Mostrar sorteo en el home')).toBeDisabled()
  expect(api.put).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }))
  await waitFor(() => expect(screen.getByLabelText('Mostrar sorteo en el home')).toBeEnabled())
})
