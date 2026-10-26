import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publicApi } from '../../api/publicApi'
import ParticipantPlay from './ParticipantPlay'
import { DEFAULT_RULET4_CONFIG, type Rulet4Result, type Rulet4Assignment } from './rulet4Logic'

vi.mock('../../api/publicApi', () => ({ publicApi: { spinRulet4: vi.fn() } }))
vi.mock('./Rulet4Wheel', () => ({
  default: ({ onReadyChange, onComplete, spin }: {
    onReadyChange: (value: boolean) => void; onComplete: (id: number) => void; spin: { id: number; index: number } | null
  }) => <div>
    <button onClick={() => onReadyChange(true)}>Scene ready</button>
    <button onClick={() => onComplete(spin?.id ?? 0)} disabled={!spin}>Complete animation</button>
    <span data-testid="target">{spin?.index}</span>
  </div>,
}))
const result: Rulet4Result = {
  panel: DEFAULT_RULET4_CONFIG.panels[2], index: 8, configSnapshot: DEFAULT_RULET4_CONFIG,
  spunAt: '2026-10-26T12:00:00Z',
}
const assignment: Rulet4Assignment = { gameType: 'RULET4', playerId: 1, displayName: 'Ana', result: null }
const props = { gameId: 'ABC123', playerToken: 'token', config: DEFAULT_RULET4_CONFIG, assignment }

describe('RULET4 participant spins', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(publicApi.spinRulet4).mockResolvedValue(result)
  })
  afterEach(cleanup)

  it('requests a server result once and animates its exact segment before revealing it', async () => {
    render(<ParticipantPlay {...props} />)
    expect(screen.getByRole('button', { name: 'Girar ruleta' })).toBeDisabled()
    fireEvent.click(screen.getByText('Scene ready'))
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Girando...' }))
    await waitFor(() => expect(screen.getByTestId('target')).toHaveTextContent('8'))
    expect(publicApi.spinRulet4).toHaveBeenCalledOnce()
    expect(publicApi.spinRulet4).toHaveBeenCalledWith('ABC123', 'token')
    expect(screen.queryByText('Verde')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Complete animation'))
    expect(screen.getByText('Verde')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Girar ruleta' })).not.toBeInTheDocument()
  })

  it('restores the stored result using its snapshot without another write', () => {
    render(<ParticipantPlay {...props} config={undefined} assignment={{ ...assignment, result }} />)
    expect(screen.getByText('Verde')).toBeInTheDocument()
    expect(publicApi.spinRulet4).not.toHaveBeenCalled()
  })

  it('shows an explicit error and allows idempotent retry after a lost response', async () => {
    vi.mocked(publicApi.spinRulet4).mockRejectedValueOnce(new Error('Network failed'))
    render(<ParticipantPlay {...props} />)
    fireEvent.click(screen.getByText('Scene ready'))
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('mismo resultado')
    fireEvent.click(screen.getByRole('button', { name: 'Girar ruleta' }))
    await waitFor(() => expect(screen.getByTestId('target')).toHaveTextContent('8'))
    expect(publicApi.spinRulet4).toHaveBeenCalledTimes(2)
  })
})
