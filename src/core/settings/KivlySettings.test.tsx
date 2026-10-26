import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { kivlyApi } from '../../api/kivlyApi'
import KivlySettings, { useKivlyDraft, validKivlySettings } from './KivlySettings'

vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { getAccountConnection: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

const connection = { connected: true }
const realSettings = {
  enabled: true, clubName: 'Club',
  privacyUrl: 'https://club.test/privacy', termsUrl: 'https://club.test/terms',
}

function Panel() {
  const draft = useKivlyDraft('GAME1', true)
  return <KivlySettings draft={draft} />
}

describe('Kivly game connection indicator', () => {
  it('shows only the connected logo and demo status for example links', async () => {
    vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
      ...connection, locationId: 'location', locations: [{ id: 'location', name: 'Club' }],
      clubSettings: { clubName: 'Club', privacyUrl: 'https://example.com/privacy', termsUrl: 'https://example.com/terms' },
    })
    render(<Panel />)
    expect(await screen.findByRole('img', { name: 'Kivly' })).toHaveAttribute('src', '/images/kivly-logo.svg')
    expect(screen.getByText('Conectado')).toBeInTheDocument()
    expect(screen.getByText(/Demo, sin altas reales/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('uses the global club without displaying game settings', async () => {
    vi.mocked(kivlyApi.getAccountConnection).mockResolvedValue({
      ...connection, locationId: 'location', locations: [{ id: 'location', name: 'Club' }],
      clubSettings: realSettings,
    })
    render(<Panel />)
    expect(await screen.findByText('Conectado')).toBeInTheDocument()
    expect(screen.queryByText(/Demo/)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('does not enable registrations with demo links', () => {
    expect(validKivlySettings(realSettings, connection)).toBe(true)
    expect(validKivlySettings({ ...realSettings, privacyUrl: 'https://example.com/privacy' }, connection)).toBe(false)
  })

  it('requires a connection and valid club details', () => {
    expect(validKivlySettings(realSettings, null)).toBe(false)
    expect(validKivlySettings(realSettings, { connected: false })).toBe(false)
    expect(validKivlySettings({ ...realSettings, clubName: ' ' }, connection)).toBe(false)
    expect(validKivlySettings({ ...realSettings, termsUrl: 'invalid' }, connection)).toBe(false)
    expect(validKivlySettings({ ...realSettings, enabled: false }, null)).toBe(true)
  })
})
