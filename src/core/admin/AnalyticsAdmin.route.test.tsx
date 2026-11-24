import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminShell from './AdminShell'

vi.mock('./AnalyticsAdmin', () => ({ default: () => <p>Response analytics mounted</p> }))
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

it('adds the global analytics navigation route', () => {
  render(<MemoryRouter initialEntries={['/admin/analytics']}>
    <Routes><Route path="/admin/*" element={<AdminShell />} /></Routes>
  </MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Analíticas' })).toHaveAttribute('href', '/admin/analytics')
  expect(screen.getByRole('heading', { level: 1, name: 'Analíticas' })).toBeInTheDocument()
  expect(screen.getByText('Response analytics mounted')).toBeInTheDocument()
})

it('does not retain the old responses route', () => {
  render(<MemoryRouter initialEntries={['/admin/responses']}>
    <Routes><Route path="/admin/*" element={<AdminShell />} /></Routes>
  </MemoryRouter>)
  expect(screen.queryByRole('link', { name: 'Analíticas' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Juegos' })).toBeInTheDocument()
  expect(screen.queryByText('Response analytics mounted')).not.toBeInTheDocument()
})
