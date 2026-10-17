import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Empareja2Screen from '../../games/empareja2/GameScreen'
import T1merScreen from '../../games/t1mer/GameScreen'
import StackScreen from '../../games/stack/GameScreen'
import { CODE_INPUT_PLACEHOLDER } from '../ui/gameValidationCopy'
import { getJoinUrl } from '../lib/joinUrl'

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
