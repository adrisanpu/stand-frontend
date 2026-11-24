import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api/api'
import Ranking from './Ranking'
import { OperatorLanguageProvider, OperatorLanguageSelector } from '../shell/operatorLanguage'

vi.mock('../../api/api', () => ({ api: { get: vi.fn() } }))
afterEach(cleanup)

describe('Ranking game score formatting', () => {
  it('hides avatars unless the game asks for profile photos', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [{ rank: 1, username: 'Ana', score: 1, profilePicUrl: '/ana.png' }] })
    const { container } = render(<Ranking gameId="GAME1234" gameType="STACK" />)
    await screen.findByText('Ana')
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.home-ranking-avatar')).toBeNull()
  })

  it.each([true, false])('shows profile photos or initial avatars (compact=%s)', async (compact) => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      results: [
        { rank: 1, username: 'Rosa', score: 3 },
        { rank: 2, username: 'Luis', score: 2, profilePicUrl: '   ' },
        { rank: 3, username: 'Ana', score: 1, profilePicUrl: '/ana.png' },
      ],
    })
    const { container } = render(<Ranking gameId="GAME1234" gameType="STACK" compact={compact} showAvatars />)
    await screen.findByText('Rosa')
    expect(container.querySelectorAll('img')).toHaveLength(1)
    expect(container.querySelector('img')).toHaveAttribute('src', '/ana.png')
    expect(screen.getByText('Rosa').parentElement?.parentElement?.querySelector('.rounded-full')).toHaveTextContent('R')
    expect(screen.getByText('Luis').parentElement?.parentElement?.querySelector('.rounded-full')).toHaveTextContent('L')
    fireEvent.error(container.querySelector('img')!)
    expect(screen.getByText('Ana').parentElement?.parentElement?.querySelector('.rounded-full')).toHaveTextContent('A')
  })

  it.each([true, false])('highlights prize rows without a prize sticker while scrolling (compact=%s)', async (compact) => {
    vi.mocked(api.get).mockResolvedValue({
      ok: true,
      results: Array.from({ length: 12 }, (_, index) => ({ rank: index + 1, username: `Player ${index + 1}`, score: index })),
    })
    render(<Ranking gameId="GAME1234" gameType="STACK" compact={compact}
      prize={{ name: 'Copa', limit: 20, topX: 2, imageUrl: '/cup.png' }} />)
    await screen.findByText('Player 1')
    expect(screen.queryByTestId('prize-sticker')).not.toBeInTheDocument()
    expect(screen.queryByText(/Copa/)).not.toBeInTheDocument()
    expect(screen.queryByText('🎁')).not.toBeInTheDocument()
    expect(document.querySelectorAll('.home-ranking-row.bg-primary\\/10')).toHaveLength(2)
    expect(screen.getByText('+2 más').parentElement).toHaveClass('overflow-y-auto', 'flex-1', 'min-h-0')
    expect(api.get).toHaveBeenCalledWith('/v1/game/score?gameId=GAME1234&limit=20')
  })

  it('translates the panel', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [] })
    render(
      <OperatorLanguageProvider>
        <OperatorLanguageSelector />
        <Ranking gameId="GAME1234" prize={{ name: 'Copa', limit: null, topX: 3 }} />
      </OperatorLanguageProvider>,
    )
    await screen.findByText('No hay puntuaciones aún')
    fireEvent.change(screen.getByRole('combobox', { name: 'Idioma' }), { target: { value: 'en' } })
    expect(screen.getByText('No scores yet')).toBeInTheDocument()
    expect(screen.queryByText(/PRIZE|PREMIO|Copa/)).not.toBeInTheDocument()
  })

  it('shows STACK score as a plain number, including zero, without units', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [{ rank: 1, username: 'Rosa', score: 0 }] })
    render(<Ranking gameId="GAME1234" gameType="STACK" />)
    expect(await screen.findByTestId('ranking-score')).toHaveTextContent(/^0$/)
    expect(screen.queryByText('N/A')).not.toBeInTheDocument()
    expect(screen.queryByText(/ms$/)).not.toBeInTheDocument()
  })

  it('shows T1MER time without units', async () => {
    vi.mocked(api.get).mockResolvedValue({ ok: true, results: [{ rank: 1, username: 'Rosa', timer: 10.1, score: 100 }] })
    render(<Ranking gameId="GAME1234" gameType="T1MER" />)
    expect(await screen.findByTestId('ranking-score')).toHaveTextContent(/^10\.100$/)
    expect(screen.queryByText(/bloques$/)).not.toBeInTheDocument()
  })
})
