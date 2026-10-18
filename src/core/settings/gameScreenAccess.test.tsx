import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Empareja2Screen from '../../games/empareja2/GameScreen'
import T1merScreen from '../../games/t1mer/GameScreen'
import StackScreen from '../../games/stack/GameScreen'
import { getJoinUrl } from '../lib/joinUrl'
import { api } from '../../api/api'

vi.mock('../../api/api', () => ({ api: { get: vi.fn(() => new Promise(() => undefined)) } }))
vi.mock('../input/useGameInput', () => ({ useGameInput: () => undefined }))
vi.mock('../input/useWebOsPointerPrimary', () => ({ useWebOsPointerPrimary: () => undefined }))
vi.mock('../widgets/MobileParticipantsPanel', () => ({ default: () => <div data-testid="mobile-participants" /> }))
vi.mock('../widgets/QRCode', () => ({ default: ({ data }: { data: string }) => <div data-testid="qr" data-url={data} /> }))
afterEach(cleanup)

describe.each([
  ['EMPAREJA2', Empareja2Screen],
  ['T1MER', T1merScreen],
] as const)('%s mobile gameplay', (_type, GameScreen) => {
  it('renders mobile participant validation and always uses the Web QR URL', () => {
    render(<GameScreen gameId="ABC123" orientation="landscape" logoElement={<span>Logo</span>} sidebarElement={<span>Ranking</span>}
      playMode="mobile" joinChannel="instagram" />)
    expect(screen.queryByPlaceholderText(/código/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('qr')).toHaveAttribute('data-url', getJoinUrl('ABC123', 'instagram'))
    expect(screen.getByTestId('qr')).toHaveAttribute('data-url', `${window.location.origin}/play/ABC123`)
  })
})

describe('STACK mobile gameplay', () => {
  it('uses Web participant access without starting an attempt', () => {
    render(<StackScreen gameId="ABC123" orientation="landscape" joinChannel="instagram" />)
    expect(screen.getByTestId('qr')).toHaveAttribute('data-url', `${window.location.origin}/play/ABC123`)
    expect(screen.getByTestId('mobile-participants')).toBeInTheDocument()
    expect(vi.mocked(api.get)).not.toHaveBeenCalled()
  })
})
