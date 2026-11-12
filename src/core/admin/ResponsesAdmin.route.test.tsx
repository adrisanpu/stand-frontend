import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminShell from './AdminShell'

vi.mock('./ResponsesAdmin', () => ({ default: () => <p>Response analytics mounted</p> }))
vi.mock('../../auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'owner', name: 'Ana', email: 'ana@example.test' },
    loading: false, error: null, updateProfile: vi.fn(),
  }),
}))
vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { getAccountConnection: vi.fn() } }))
vi.mock('./AdminGames', () => ({ default: () => <p>Games</p> }))
vi.mock('./ClientsAdmin', () => ({ default: () => <p>Clients</p> }))
vi.mock('./PrizeAdministration', () => ({ default: () => <p>Prizes</p> }))
vi.mock('../settings/IntegrationsSettings', () => ({ default: () => <p>Integrations</p> }))

it('adds the global responses navigation route', () => {
  render(<MemoryRouter initialEntries={['/admin/responses']}>
    <Routes><Route path="/admin/*" element={<AdminShell />} /></Routes>
  </MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Respuestas' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Respuestas' })).toBeInTheDocument()
  expect(screen.getByText('Response analytics mounted')).toBeInTheDocument()
})
