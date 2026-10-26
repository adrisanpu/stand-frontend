import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { kivlyApi } from '../../api/kivlyApi'
import KivlySettings, { KivlyRewardSettings, useKivlyDraft, useKivlyRewardDraft, validKivlySettings } from './KivlySettings'

vi.mock('../../api/kivlyApi', () => ({ kivlyApi: { getAccountConnection: vi.fn(), get: vi.fn(), listRewards: vi.fn(), saveReward: vi.fn() } }))
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

function RewardPanel() {
  const draft = useKivlyRewardDraft('GAME1', true)
  return <><KivlyRewardSettings draft={draft} />
    <button onClick={() => void draft.persist()}>Guardar cambios</button>
  </>
}

it('keeps the reward selection as a draft until saving the game', async () => {
  vi.mocked(kivlyApi.get).mockResolvedValue({ ok: true, settings: { ...realSettings, enabled: false }, connection })
  vi.mocked(kivlyApi.listRewards).mockResolvedValue([{ id: 'reward1', name: 'Coffee' }])
  vi.mocked(kivlyApi.saveReward).mockResolvedValue()
  render(<RewardPanel />)
  const select = await screen.findByLabelText('Premio Kivly al terminar')
  fireEvent.change(select, { target: { value: 'reward1' } })
  expect(kivlyApi.saveReward).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(kivlyApi.saveReward).toHaveBeenCalledWith('GAME1', 'reward1'))
  fireEvent.change(select, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(kivlyApi.saveReward).toHaveBeenLastCalledWith('GAME1', null))
})

it('shows catalog failure instead of presenting an empty saved selection', async () => {
  vi.mocked(kivlyApi.get).mockResolvedValue({ ok: true, settings: { ...realSettings, enabled: false }, connection })
  vi.mocked(kivlyApi.listRewards).mockRejectedValueOnce(new Error('unavailable'))
  render(<RewardPanel />)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar el premio Kivly.')
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  vi.mocked(kivlyApi.listRewards).mockResolvedValueOnce([])
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByRole('combobox')).toHaveValue('')
})

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
