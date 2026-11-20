import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import PrizeNotificationSettings from './PrizeNotificationSettings'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('defaults to /play only and saves email opt-in while keeping one channel checked', async () => {
  vi.mocked(api.get).mockResolvedValue({ ok: true, game: {} })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
  render(<PrizeNotificationSettings gameId="GAME1" />)
  const play = await screen.findByRole('checkbox', { name: /pantalla del juego/ })
  const email = screen.getByRole('checkbox', { name: 'Por email' })
  expect(play).toBeChecked()
  expect(play).toBeDisabled()
  expect(email).not.toBeChecked()
  fireEvent.click(email)
  await waitFor(() => expect(email).toBeChecked())
  expect(api.put).toHaveBeenCalledWith('/v1/game', { gameId: 'GAME1', prizeNotification: { play: true, email: true } })
  expect(play).toBeEnabled()
  fireEvent.click(play)
  await waitFor(() => expect(play).not.toBeChecked())
  expect(api.put).toHaveBeenLastCalledWith('/v1/game', { gameId: 'GAME1', prizeNotification: { play: false, email: true } })
  expect(email).toBeDisabled()
})
