import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Empareja2Config from '../../games/empareja2/GameConfig'
import T1merConfig from '../../games/t1mer/GameConfig'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }))
vi.mock('../widgets/QRCode', () => ({ default: () => null }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.get).mockResolvedValue({
    ok: true, game: { playMode: 'master', joinChannel: 'instagram', participantFields: { email: { required: true } } },
    settings: { empareja2: { numPairs: 4 } }, empareja2CatalogPairCount: 10,
  })
  vi.mocked(api.put).mockResolvedValue({ ok: true })
})
afterEach(cleanup)

describe.each([
  ['EMPAREJA2', Empareja2Config],
  ['T1MER', T1merConfig],
] as const)('%s specific settings', (_type, Config) => {
  it('translates loaded rules without refetching or saving configuration', async () => {
    const onChange = vi.fn()
    render(
      <OperatorLanguageProvider>
        <OperatorLanguageSelector />
        <Config gameId="ABC123" gameName="Event" settings={{}} onChange={onChange} />
      </OperatorLanguageProvider>
    )
    const save = screen.getByRole('button', { name: 'Guardar configuración' })
    await waitFor(() => expect(save).toBeEnabled())
    const requests = vi.mocked(api.get).mock.calls.length
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    expect(save).toHaveAccessibleName(/^Save/)
    expect(save).toBeEnabled()
    expect(api.get).toHaveBeenCalledTimes(requests)
    expect(api.put).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not overwrite separately saved access when saving rules', async () => {
    const onChange = vi.fn()
    render(<Config gameId="ABC123" gameName="Event" settings={{}} access={{ playMode: 'mobile', joinChannel: 'web' }} onChange={onChange} />)
    const save = screen.getByRole('button', { name: 'Guardar configuración' })
    await waitFor(() => expect(save).toBeEnabled())
    fireEvent.click(save)
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    const body = vi.mocked(api.put).mock.calls[0][1]
    expect(body).not.toHaveProperty('joinChannel')
    expect(body).not.toHaveProperty('playMode')
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('joinChannel')
    expect(screen.queryByRole('button', { name: '1 pantalla' })).not.toBeInTheDocument()
  })

  it('does not allow saving defaults after a failed load', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Sin conexión'))
    render(<Config gameId="ABC123" gameName="Event" settings={{}} onChange={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled()
    expect(api.put).not.toHaveBeenCalled()
  })
})
