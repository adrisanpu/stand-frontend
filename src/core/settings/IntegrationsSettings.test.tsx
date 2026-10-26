import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { kivlyApi } from '../../api/kivlyApi'
import IntegrationsSettings from './IntegrationsSettings'

vi.mock('../../api/kivlyApi', () => ({
  kivlyApi: {
    getAccountConnection: vi.fn(),
    connectAccount: vi.fn(),
    disconnectAccount: vi.fn(),
    saveClubSettings: vi.fn(),
  },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('IntegrationsSettings', () => {
  it('explains when the account endpoint is missing from the backend', async () => {
    vi.mocked(kivlyApi.getAccountConnection).mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))
    render(<IntegrationsSettings onBack={vi.fn()} onClose={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Despliega la versión del backend')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('connects Kivly with credentials without retaining them in the form', async () => {
    vi.mocked(kivlyApi.getAccountConnection)
      .mockResolvedValueOnce({ connected: false, locationId: null, locations: [] })
      .mockResolvedValueOnce({
        connected: true,
        locationId: 'location-1', locations: [{ id: 'location-1', name: 'Test club' }],
      })
    vi.mocked(kivlyApi.connectAccount).mockResolvedValue(false)
    render(<IntegrationsSettings onBack={vi.fn()} onClose={vi.fn()} />)

    await screen.findByText('Desconectado')
    const toggle = screen.getByRole('switch', { name: 'Activar integración Kivly' })
    expect(toggle).not.toBeChecked()
    fireEvent.click(toggle)
    expect(toggle).toBeChecked()
    fireEvent.change(screen.getByLabelText('client_id'), { target: { value: 'client-id' } })
    fireEvent.change(screen.getByLabelText('client_secret'), { target: { value: 'client-secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conectar Kivly' }))

    await waitFor(() => expect(kivlyApi.connectAccount).toHaveBeenCalledWith('client-id', 'client-secret'))
    expect(await screen.findByText('Conectado')).toBeInTheDocument()
    expect(screen.queryByLabelText('client_id')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('client_secret')).not.toBeInTheDocument()
    expect(screen.getByText('Test club')).toBeInTheDocument()
    expect(screen.getByLabelText('location_id')).toHaveValue('location-1')
    expect(screen.getByLabelText('Nombre del club')).toHaveValue('Test club')
    expect(screen.getByLabelText('URL de privacidad')).toHaveValue(`${window.location.origin}/pages/privacy-es.html`)
    expect(screen.getByLabelText('URL de condiciones')).toHaveValue(`${window.location.origin}/pages/legal.html`)
  })

  it('restores the saved location when opening an already connected account', async () => {
    vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
      connected: true,
      locationId: 'saved-location', locations: [{ id: 'saved-location', name: 'Saved club' }],
    })
    render(<IntegrationsSettings onBack={vi.fn()} onClose={vi.fn()} />)
    expect(await screen.findByText('Saved club')).toBeInTheDocument()
    expect(screen.getByLabelText('location_id')).toHaveAttribute('readonly')
    expect(kivlyApi.connectAccount).not.toHaveBeenCalled()
  })

  it('saves shared club details from home without reconnecting', async () => {
    vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
      connected: true, locationId: 'location-1',
      locations: [{ id: 'location-1', name: 'Club' }],
      clubSettings: { clubName: 'Saved club', privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms' },
    })
    vi.mocked(kivlyApi.saveClubSettings).mockResolvedValue()
    render(<IntegrationsSettings onBack={vi.fn()} onClose={vi.fn()} />)
    await screen.findByText('Datos del club')
    expect(screen.getByLabelText('Nombre del club')).toHaveValue('Saved club')
    fireEvent.change(screen.getByLabelText('Nombre del club'), { target: { value: 'Updated club' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar club', hidden: true }))
    expect(await screen.findByText('Club guardado para tus juegos.')).toBeInTheDocument()
    expect(kivlyApi.saveClubSettings).toHaveBeenCalledWith({
      clubName: 'Updated club', privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms',
    })
    expect(kivlyApi.connectAccount).not.toHaveBeenCalled()
  })
})
