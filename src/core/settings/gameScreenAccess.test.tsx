import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Empareja2Screen from '../../games/empareja2/GameScreen'
import T1merScreen from '../../games/t1mer/GameScreen'
import StackScreen from '../../games/stack/GameScreen'
import { CODE_INPUT_PLACEHOLDER } from '../ui/gameValidationCopy'
import { getJoinUrl } from '../lib/joinUrl'
import { api } from '../../api/api'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(() => new Promise(() => undefined)) } }))
vi.mock('../theme', () => ({ useAvatarsEnabled: () => true }))
vi.mock('../input/useGameInput', () => ({ useGameInput: () => undefined }))
vi.mock('../input/useWebOsPointerPrimary', () => ({ useWebOsPointerPrimary: () => undefined }))
vi.mock('../widgets/GameStateAvatar', () => ({ default: () => <div data-testid="avatar" /> }))
vi.mock('../widgets/MobileParticipantsPanel', () => ({ default: () => <div data-testid="mobile-participants" /> }))
vi.mock('../widgets/QRCode', () => ({ default: ({ data }: { data: string }) => <div data-testid="qr" data-url={data} /> }))
afterEach(cleanup)

describe.each([
  ['EMPAREJA2', Empareja2Screen],
  ['T1MER', T1merScreen],
] as const)('%s mode is independent of QR access', (_type, GameScreen) => {
  it('preserves entered validation codes and the mounted game across language changes', () => {
    render(
      <OperatorLanguageProvider>
        <OperatorLanguageSelector />
        <GameScreen gameId="ABC123" orientation="portrait" playMode="master" joinChannel="web" />
      </OperatorLanguageProvider>
    )
    const input = screen.getAllByPlaceholderText(CODE_INPUT_PLACEHOLDER)[0]
    fireEvent.change(input, { target: { value: '1234' } })
    const requests = vi.mocked(api.get).mock.calls.length
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    expect(screen.getByDisplayValue('1234')).toBe(input)
    expect(api.get).toHaveBeenCalledTimes(requests)
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'es' } })
    expect(screen.getByDisplayValue('1234')).toBe(input)
  })

  it.each(['instagram', 'web'] as const)('keeps master gameplay with %s access', (joinChannel) => {
    render(<GameScreen gameId="ABC123" orientation="landscape" logoElement={<span>Logo</span>} sidebarElement={<span>Ranking</span>}
      playMode="master" joinChannel={joinChannel} />)
    expect(screen.getAllByPlaceholderText(CODE_INPUT_PLACEHOLDER).length).toBeGreaterThan(0)
    expect(screen.getByTestId('qr')).toHaveAttribute('data-url', getJoinUrl('ABC123', joinChannel))
  })

  it.each(['instagram', 'web'] as const)('keeps mobile gameplay with %s access', (joinChannel) => {
    render(<GameScreen gameId="ABC123" orientation="landscape" logoElement={<span>Logo</span>} sidebarElement={<span>Ranking</span>}
      playMode="mobile" joinChannel={joinChannel} />)
    expect(screen.queryAllByPlaceholderText(CODE_INPUT_PLACEHOLDER)).toHaveLength(0)
    expect(screen.getByTestId('avatar')).toBeInTheDocument()
    expect(screen.getByTestId('qr')).toHaveAttribute('data-url', getJoinUrl('ABC123', joinChannel))
  })
})

describe('STACK QR access', () => {
  it.each(['instagram', 'web'] as const)('routes to %s without starting an attempt', (joinChannel) => {
    render(<StackScreen gameId="ABC123" orientation="landscape" joinChannel={joinChannel} />)
    expect(screen.getByTestId('qr')).toHaveAttribute('data-url', getJoinUrl('ABC123', joinChannel))
    expect(screen.getByTestId('mobile-participants')).toBeInTheDocument()
  })
})
