import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Ranking from './Ranking'

vi.mock('../../api/api', () => ({ api: { get: vi.fn() } }))
afterEach(cleanup)

describe('Ranking game score formatting', () => {
  it('shows STACK score in bloques, including zero, without timer units', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [{ rank: 1, username: 'Rosa', score: 0 }] })
    render(<Ranking gameId="GAME1234" gameType="STACK" />)
    expect(await screen.findByText('0 bloques')).toBeInTheDocument()
    expect(screen.queryByText('N/A')).not.toBeInTheDocument()
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
  })

  it('keeps T1MER time formatting unchanged', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [{ rank: 1, username: 'Rosa', timer: 10.1, score: 100 }] })
    render(<Ranking gameId="GAME1234" gameType="T1MER" />)
    expect(await screen.findByText('10.100s')).toBeInTheDocument()
    expect(screen.queryByText(/bloques$/)).not.toBeInTheDocument()
  })
})
