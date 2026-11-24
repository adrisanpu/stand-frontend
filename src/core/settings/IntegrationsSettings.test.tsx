import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { kivlyApi, type KivlyAccountConnection } from '../../api/kivlyApi'
import IntegrationsSettings from './IntegrationsSettings'

vi.mock('../../api/kivlyApi', () => ({
  kivlyApi: { getAccountConnection: vi.fn(), connectAccount: vi.fn(), disconnectAccount: vi.fn(), saveClubSettings: vi.fn() },
}))
const connected: KivlyAccountConnection = {
  connected: true, locationId: 'loc', locations: [{ id: 'loc', name: 'Test club' }],
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(kivlyApi.saveClubSettings).mockResolvedValue()
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue(connected)
})
afterEach(cleanup)
async function mount(state = 'Conectado') {
  render(<IntegrationsSettings onBack={vi.fn()} onClose={vi.fn()} />)
  await screen.findByText(state)
  fireEvent.click(screen.getByAltText('Kivly').closest('summary')!)
}
it('explains a missing backend endpoint and offers a status check', async () => {
  vi.mocked(kivlyApi.getAccountConnection).mockRejectedValue(Object.assign(new Error('Missing'), { status: 404 }))
  render(<IntegrationsSettings onBack={vi.fn()} onClose={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Despliega la versión del backend')
  expect(screen.getByRole('button', { name: 'Comprobar conexión' })).toBeInTheDocument()
})
it('connects and saves default club settings without retaining credentials', async () => {
  vi.mocked(kivlyApi.getAccountConnection)
    .mockResolvedValueOnce({ connected: false, locationId: null, locations: [] }).mockResolvedValue(connected)
  vi.mocked(kivlyApi.connectAccount).mockResolvedValue(false)
  await mount('Desconectado')
  fireEvent.change(screen.getByLabelText('client_id'), { target: { value: 'id' } })
  fireEvent.change(screen.getByLabelText('client_secret'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: 'Conectar Kivly' }))
  await waitFor(() => expect(kivlyApi.connectAccount).toHaveBeenCalledWith('id', 'secret'))
  await screen.findByText('Conexión actualizada.')
  expect(kivlyApi.saveClubSettings).toHaveBeenCalledWith({
    clubName: 'Test club', privacyUrl: `${window.location.origin}/pages/privacy-es.html`,
    termsUrl: `${window.location.origin}/pages/legal.html`,
  })
  expect(screen.queryByLabelText('client_secret')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('location_id')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Nombre del club')).not.toBeInTheDocument()
})
it('shows a compact connected entry without credential editing', async () => {
  await mount()
  expect(screen.getByText('Test club')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Cambiar credenciales' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Acceder a Kivly' })).toHaveAttribute('href', 'https://getkivly.com/auth/login')
  expect(kivlyApi.connectAccount).not.toHaveBeenCalled()
})
it('saves the shared storefront without overwriting existing legal settings', async () => {
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
    ...connected, clubSettings: { clubName: 'Saved', privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms' },
  })
  await mount()
  fireEvent.change(screen.getByLabelText('Web oficial del club Kivly'), { target: { value: 'https://club.kivly.store' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar web del club' }))
  await screen.findByText('Web del club guardada para todos tus STACK.')
  expect(kivlyApi.saveClubSettings).toHaveBeenCalledWith({
    clubName: 'Saved', privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms', storefrontUrl: 'https://club.kivly.store',
  })
})
it('clears unsent credentials when the entry is collapsed', async () => {
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({ connected: false, locationId: null, locations: [] })
  await mount('Desconectado')
  fireEvent.change(screen.getByLabelText('client_secret'), { target: { value: 'secret' } })
  const details = screen.getByAltText('Kivly').closest('details')!
  details.open = false
  fireEvent(details, new Event('toggle'))
  details.open = true
  expect(screen.getByLabelText('client_secret')).toHaveValue('')
})
it('saves an explicit empty storefront when clearing the shared wallet link', async () => {
  const clubSettings = {
    clubName: 'Saved', privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms',
    storefrontUrl: 'https://club.kivly.store',
  }
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({ ...connected, clubSettings })
  await mount()
  fireEvent.change(screen.getByLabelText('Web oficial del club Kivly'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar web del club' }))
  await screen.findByText('Web del club guardada para todos tus STACK.')
  expect(kivlyApi.saveClubSettings).toHaveBeenCalledWith({ ...clubSettings, storefrontUrl: '' })
  expect(screen.getByLabelText('Web oficial del club Kivly')).toHaveValue('')
})
it('requires confirmation before disconnecting all STACK games', async () => {
  await mount()
  vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({ connected: false, locationId: null, locations: [] })
  fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }))
  expect(kivlyApi.disconnectAccount).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar desconexión' }))
  await screen.findByText('Desconectado')
  expect(kivlyApi.disconnectAccount).toHaveBeenCalledOnce()
})
it('reports failed automatic club setup without reporting successful completion', async () => {
  vi.mocked(kivlyApi.getAccountConnection)
    .mockResolvedValueOnce({ connected: false, locationId: null, locations: [] }).mockResolvedValue(connected)
  vi.mocked(kivlyApi.saveClubSettings).mockRejectedValueOnce(new Error('Unavailable'))
  await mount('Desconectado')
  fireEvent.change(screen.getByLabelText('client_id'), { target: { value: 'id' } })
  fireEvent.change(screen.getByLabelText('client_secret'), { target: { value: 'secret' } })
  fireEvent.click(screen.getByRole('button', { name: 'Conectar Kivly' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Kivly está conectado, pero no se pudo guardar')
  expect(screen.queryByText('Conexión actualizada.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar web del club' }))
  await screen.findByText('Web del club guardada para todos tus STACK.')
})
