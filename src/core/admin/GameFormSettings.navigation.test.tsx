import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import AdminGames from './AdminGames'

vi.mock('../../api/operatorGames', () => ({
  listOperatorGames: async () => [],
  archiveOperatorGame: vi.fn(), deleteOperatorGamePermanently: vi.fn(),
  operatorGameHomeUrl: vi.fn(), setOperatorGameActive: vi.fn(), unarchiveOperatorGame: vi.fn(),
}))
vi.mock('./GameShowcase', () => ({ default: () => null }))
vi.mock('./GameConfigurationDialog', () => ({
  default: ({ gameId, initialSection, onClose, onCreated }: {
    gameId?: string; initialSection: string; onClose: () => void; onCreated?: (gameId: string) => void
  }) => <div role="dialog" aria-label="Shared editor"><p>{gameId} · {initialSection}</p>
    {!gameId && <button onClick={() => onCreated?.('NEW')}>Create test event</button>}
    <button onClick={onClose}>Close editor</button></div>,
}))
afterEach(cleanup)

it('opens the shared form tab from the admin query and clears it on close', async () => {
  render(<MemoryRouter initialEntries={['/admin/games?form=SELECTED']}><AdminGames /></MemoryRouter>)
  expect(screen.getByRole('dialog')).toHaveTextContent('SELECTED · form')
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

function Location() {
  return <p data-testid="location">{useLocation().search}</p>
}

it('records the new event in the URL so reloading resumes setup instead of creating another event', async () => {
  const result = render(<MemoryRouter initialEntries={['/admin/games?create=1']}>
    <AdminGames /><Location />
  </MemoryRouter>)
  const dialog = screen.getByRole('dialog')
  fireEvent.click(screen.getByRole('button', { name: 'Create test event' }))
  expect(screen.getByTestId('location')).toHaveTextContent('setup=NEW')
  expect(screen.getByRole('dialog')).toBe(dialog)
  expect(screen.getByRole('dialog')).toHaveTextContent('NEW · appearance')
  result.unmount()
  render(<MemoryRouter initialEntries={['/admin/games?setup=NEW']}><AdminGames /></MemoryRouter>)
  expect(screen.getByRole('dialog')).toHaveTextContent('NEW · appearance')
  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
